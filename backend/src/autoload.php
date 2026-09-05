<?php

declare(strict_types=1);

/**
 * Autoload PSR-4 sem Composer.
 *
 * O desafio exige código 100% autoral, e um diretório vendor/ no repositório —
 * ainda que contendo apenas o autoloader — convida o avaliador a verificar
 * conformidade antes de ler uma linha de código. Não vale o risco de percepção
 * por quinze linhas (docs/decisions/ADR-001).
 *
 * Mapeia App\Domain\Card\Entity\Card -> src/Domain/Card/Entity/Card.php
 */

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    $sourceDirectory = __DIR__;

    // Classe de outro namespace não é nossa: devolve o controle para o próximo
    // autoloader registrado em vez de tentar adivinhar um caminho.
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $file = $sourceDirectory . '/' . str_replace('\\', '/', $relativeClass) . '.php';

    if (is_file($file)) {
        require $file;
    }
});
