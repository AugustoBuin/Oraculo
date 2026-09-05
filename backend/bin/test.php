<?php

declare(strict_types=1);

/**
 * Micro-runner de testes do Oráculo.
 *
 * Substitui o PHPUnit, que traria Composer e um vendor/ junto — e o desafio
 * exige código 100% autoral (docs/decisions/ADR-001 e ADR-004).
 *
 * Uso:
 *   php bin/test.php              roda tudo
 *   php bin/test.php Card         roda só o que casa com "Card" no nome da classe
 *
 * Sai com código diferente de zero quando algo falha — é isso que permite ao
 * bin/validate.php bloquear o push.
 */

require __DIR__ . '/../src/autoload.php';

$testsDirectory = dirname(__DIR__) . '/tests';

// Autoload dos testes: Tests\Shared\Config\EnvTest -> tests/Shared/Config/EnvTest.php
spl_autoload_register(static function (string $class) use ($testsDirectory): void {
    $prefix = 'Tests\\';

    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $file = $testsDirectory . '/' . str_replace('\\', '/', $relativeClass) . '.php';

    if (is_file($file)) {
        require $file;
    }
});

/**
 * Ativa cor apenas quando a saída é um terminal. Redirecionado para arquivo ou
 * para o log do CI, código de escape vira lixo ilegível.
 */
$useColor = function_exists('posix_isatty') && @posix_isatty(STDOUT);
$paint = static function (string $text, string $code) use ($useColor): string {
    return $useColor ? "\033[{$code}m{$text}\033[0m" : $text;
};

$filter = $argv[1] ?? null;

/**
 * Localiza a linha do TESTE que falhou, não a do helper de asserção.
 *
 * A exceção nasce dentro de TestCase::assertSame, então getFile() aponta sempre
 * para TestCase.php — inútil para quem está depurando. Sobe a pilha até o
 * primeiro quadro fora da infraestrutura de teste, que é a linha que o autor
 * escreveu.
 */
function locateAssertion(\Throwable $failure): string
{
    $infrastructure = ['TestCase.php', 'AssertionFailed.php'];

    foreach ($failure->getTrace() as $frame) {
        if (!isset($frame['file'], $frame['line'])) {
            continue;
        }

        if (!in_array(basename($frame['file']), $infrastructure, true)) {
            return basename($frame['file']) . ':' . $frame['line'];
        }
    }

    return basename($failure->getFile()) . ':' . $failure->getLine();
}

// --- Descoberta ---------------------------------------------------------------

$testFiles = [];
$directory = new RecursiveDirectoryIterator($testsDirectory, FilesystemIterator::SKIP_DOTS);

foreach (new RecursiveIteratorIterator($directory) as $entry) {
    /** @var SplFileInfo $entry */
    if ($entry->isFile() && str_ends_with($entry->getFilename(), 'Test.php')) {
        $testFiles[] = $entry->getPathname();
    }
}

sort($testFiles);

// --- Execução -----------------------------------------------------------------

$passed = 0;
$failed = 0;
$failures = [];
$startedAt = microtime(true);

foreach ($testFiles as $file) {
    $relativePath = substr($file, strlen($testsDirectory) + 1);
    $className = 'Tests\\' . str_replace(['/', '\\', '.php'], ['\\', '\\', ''], $relativePath);

    if (!class_exists($className)) {
        $failed++;
        $failures[] = [
            'test' => $relativePath,
            'message' => "Arquivo não declara a classe esperada {$className}.",
            'expected' => null,
            'actual' => null,
            'where' => $relativePath,
        ];
        continue;
    }

    if ($filter !== null && stripos($className, $filter) === false) {
        continue;
    }

    $reflection = new ReflectionClass($className);

    if ($reflection->isAbstract()) {
        continue;
    }

    echo $paint($className, '1') . PHP_EOL;

    foreach ($reflection->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
        if (!str_starts_with($method->getName(), 'test')) {
            continue;
        }

        // Instância nova por teste: estado deixado por um teste não pode
        // vazar para o próximo (PADROES §10.5).
        $instance = $reflection->newInstance();

        try {
            $instance->{$method->getName()}();
            $passed++;
            echo '  ' . $paint('✓', '32') . ' ' . $method->getName() . PHP_EOL;
        } catch (\Tests\AssertionFailed $assertionFailed) {
            $failed++;
            echo '  ' . $paint('✗', '31') . ' ' . $method->getName() . PHP_EOL;
            $failures[] = [
                'test' => $className . '::' . $method->getName(),
                'message' => $assertionFailed->getMessage(),
                'expected' => $assertionFailed->expected,
                'actual' => $assertionFailed->actual,
                'where' => locateAssertion($assertionFailed),
            ];
        } catch (\Throwable $thrown) {
            // Exceção inesperada é falha do teste, nunca queda do runner: os
            // demais testes precisam continuar rodando.
            $failed++;
            echo '  ' . $paint('✗', '31') . ' ' . $method->getName() . PHP_EOL;
            $failures[] = [
                'test' => $className . '::' . $method->getName(),
                'message' => 'Exceção inesperada: ' . get_class($thrown) . ' — ' . $thrown->getMessage(),
                'expected' => null,
                'actual' => null,
                'where' => basename($thrown->getFile()) . ':' . $thrown->getLine(),
            ];
        }
    }
}

// --- Relatório ----------------------------------------------------------------

$elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);

if ($failures !== []) {
    echo PHP_EOL . $paint('FALHAS', '1;31') . PHP_EOL . PHP_EOL;

    foreach ($failures as $index => $failure) {
        echo sprintf('%d) %s', $index + 1, $failure['test']) . PHP_EOL;
        echo '   ' . $failure['message'] . PHP_EOL;

        if ($failure['expected'] !== null || $failure['actual'] !== null) {
            echo '   esperava: ' . \Tests\AssertionFailed::describe($failure['expected']) . PHP_EOL;
            echo '   recebeu:  ' . \Tests\AssertionFailed::describe($failure['actual']) . PHP_EOL;
        }

        echo '   em ' . $failure['where'] . PHP_EOL . PHP_EOL;
    }
}

$summary = sprintf('%d passou, %d falhou (%d ms)', $passed, $failed, $elapsedMs);
echo PHP_EOL . $paint($summary, $failed === 0 ? '1;32' : '1;31') . PHP_EOL;

exit($failed === 0 ? 0 : 1);
