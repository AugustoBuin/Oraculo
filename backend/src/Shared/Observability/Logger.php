<?php

declare(strict_types=1);

namespace App\Shared\Observability;

/**
 * Barramento único de log.
 *
 * Regras que a existência desta interface torna possíveis (PADROES.md §6):
 *
 * - Nada de `echo`, `var_dump` ou `print_r` em fluxo instrumentado. Eles seguem
 *   válidos apenas em scripts de linha de comando e no boot, antes de a
 *   composição existir.
 * - O logger é **injetado por construtor**, pedido no composition root. Pedir o
 *   logger de dentro de um caso de uso é Service Locator e não passa na revisão.
 * - O contexto é estruturado. Mensagem com dado interpolado não se filtra nem
 *   se agrega depois.
 */
interface Logger
{
    /** @param array<string,mixed> $context */
    public function error(string $message, array $context = []): void;

    /** @param array<string,mixed> $context */
    public function warning(string $message, array $context = []): void;

    /** @param array<string,mixed> $context */
    public function info(string $message, array $context = []): void;

    /** @param array<string,mixed> $context */
    public function debug(string $message, array $context = []): void;
}
