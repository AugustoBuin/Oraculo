<?php

declare(strict_types=1);

/**
 * A cadeia de validação do projeto, do mais barato ao mais caro — para falhar
 * rápido (PADROES.md §15.1).
 *
 *   1. Marcadores de conflito   instantâneo, e pega o que tipo nenhum vê
 *   2. Sintaxe (php -l)         rápido, e erro de sintaxe invalida o resto
 *   3. Fronteiras de camada     estático
 *   4. Placeholders de SQL      estático, e pega defeito invisível até a execução
 *   5. Testes                   o mais caro
 *
 * Se a regra depende de alguém lembrar, ela não existe. Este script é o que
 * torna as regras deste repositório verificáveis por comando, e não por
 * disciplina.
 */

$projectRoot = dirname(__DIR__, 2);
$binDirectory = __DIR__;

/**
 * Marcadores de conflito de merge.
 *
 * Barato, instantâneo, e pega uma classe de erro que verificação de sintaxe não
 * vê: um arquivo de dados ou de documentação com marcador não quebra o build,
 * mas quebra qualquer leitor em runtime.
 *
 * Só o marcador de ABERTURA e o de FECHAMENTO são procurados. O do meio,
 * sozinho, é sublinhado válido de título em Markdown — procurá-lo produziria
 * falso positivo em toda a documentação.
 */
$checkConflictMarkers = static function (string $root): array {
    $opening = '<<<<' . '<<<';
    $closing = '>>>>' . '>>>';
    $found = [];

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $entry) {
        /** @var SplFileInfo $entry */
        $path = str_replace('\\', '/', $entry->getPathname());

        if (!$entry->isFile() || $entry->getSize() > 2_000_000) {
            continue;
        }

        foreach (['/.git/', '/vendor/', '/node_modules/', '/storage/uploads/'] as $skip) {
            if (str_contains($path, $skip)) {
                continue 2;
            }
        }

        $lines = file($entry->getPathname(), FILE_IGNORE_NEW_LINES);

        if ($lines === false) {
            continue;
        }

        foreach ($lines as $number => $line) {
            if (str_starts_with($line, $opening) || str_starts_with($line, $closing)) {
                $found[] = substr($path, strlen($root) + 1) . ':' . ($number + 1);
            }
        }
    }

    return $found;
};

$steps = [];

// --- 1. Marcadores de conflito ------------------------------------------------

$steps[] = ['marcadores de conflito', static function () use ($checkConflictMarkers, $projectRoot): bool {
    $found = $checkConflictMarkers($projectRoot);

    foreach ($found as $location) {
        fwrite(STDERR, '  marcador de conflito em ' . $location . PHP_EOL);
    }

    return $found === [];
}];

// --- 2. Sintaxe ---------------------------------------------------------------

$steps[] = ['sintaxe (php -l)', static function () use ($projectRoot): bool {
    $ok = true;

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($projectRoot . '/backend', FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $entry) {
        /** @var SplFileInfo $entry */
        if (!$entry->isFile() || $entry->getExtension() !== 'php') {
            continue;
        }

        exec('php -l ' . escapeshellarg($entry->getPathname()) . ' 2>&1', $output, $status);

        if ($status !== 0) {
            fwrite(STDERR, '  ' . implode(PHP_EOL . '  ', $output) . PHP_EOL);
            $ok = false;
        }

        $output = [];
    }

    return $ok;
}];

// --- 3. Fronteiras de camada --------------------------------------------------

$steps[] = ['fronteiras de camada', static function () use ($binDirectory): bool {
    passthru('php ' . escapeshellarg($binDirectory . '/check-boundaries.php'), $status);

    return $status === 0;
}];

// --- 4. Placeholders de SQL ---------------------------------------------------

$steps[] = ['placeholders de SQL', static function () use ($binDirectory): bool {
    passthru('php ' . escapeshellarg($binDirectory . '/check-sql-placeholders.php'), $status);

    return $status === 0;
}];

// --- 5. Testes ----------------------------------------------------------------

$steps[] = ['testes', static function () use ($binDirectory): bool {
    passthru('php ' . escapeshellarg($binDirectory . '/test.php'), $status);

    return $status === 0;
}];

// --- Execução -----------------------------------------------------------------

foreach ($steps as $index => [$name, $run]) {
    echo PHP_EOL . '[' . ($index + 1) . '/' . count($steps) . '] ' . $name . PHP_EOL;

    if (!$run()) {
        fwrite(STDERR, PHP_EOL . 'validate FALHOU em: ' . $name . PHP_EOL);
        exit(1);
    }
}

echo PHP_EOL . 'validate OK' . PHP_EOL;
exit(0);
