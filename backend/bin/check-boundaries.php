<?php

declare(strict_types=1);

/**
 * Verifica as fronteiras de camada do backend e do frontend.
 *
 * Uma ferramenta só para as duas, escrita em PHP porque PHP já está no
 * contêiner — acrescentar Node a um projeto que se apresenta como "zero
 * dependência" pede uma explicação que reescrever torna desnecessária
 * (docs/decisions/ADR-002).
 *
 * Sai com código 1 se houver violação: é o que permite ao validate bloquear.
 */

use App\Shared\Quality\LayerBoundary;

require __DIR__ . '/../src/autoload.php';

$projectRoot = dirname(__DIR__, 2);

$scanned = [
    'backend/src' => '*.php',
    'frontend/src' => '*.js',
];

$violations = [];
$fileCount = 0;

foreach ($scanned as $relativeDirectory => $extension) {
    $directory = $projectRoot . '/' . $relativeDirectory;

    if (!is_dir($directory)) {
        // O frontend chega depois do backend; ausência não é erro.
        continue;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $entry) {
        /** @var SplFileInfo $entry */
        if (!$entry->isFile() || !fnmatch($extension, $entry->getFilename())) {
            continue;
        }

        $fileCount++;

        $path = substr($entry->getPathname(), strlen($projectRoot) + 1);
        $source = (string) file_get_contents($entry->getPathname());

        foreach (LayerBoundary::violations($path, $source) as $violation) {
            $violations[] = $violation;
        }
    }
}

if ($violations !== []) {
    fwrite(STDERR, 'Fronteiras de camada violadas:' . PHP_EOL . PHP_EOL);

    foreach ($violations as $violation) {
        fwrite(STDERR, '  ' . $violation . PHP_EOL);
    }

    fwrite(STDERR, PHP_EOL . count($violations) . ' violação(ões) em ' . $fileCount . ' arquivo(s).' . PHP_EOL);
    exit(1);
}

echo 'Fronteiras de camada respeitadas (' . $fileCount . ' arquivos).' . PHP_EOL;
exit(0);
