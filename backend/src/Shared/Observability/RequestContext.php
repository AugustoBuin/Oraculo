<?php

declare(strict_types=1);

namespace App\Shared\Observability;

/**
 * Contexto da requisição corrente.
 *
 * Estático de propósito, e isso é explicitamente permitido: em PHP uma
 * requisição é um processo, então nada aqui sobrevive a ela nem vaza entre
 * requisições. Não é o singleton com estado de aplicação proibido pelo
 * PADROES.md §3.2 — esse é o que guarda buffer, cursor ou cache em memória.
 *
 * Existe para que o traceId não precise ser passado adiante na assinatura de
 * todo método que possa querer registrar uma linha de log.
 */
final class RequestContext
{
    private static ?string $traceId = null;

    /**
     * Gerado sob demanda: se a requisição falhar antes do pipeline começar, o
     * log da falha ainda sai correlacionado em vez de sair sem identificador.
     */
    public static function traceId(): string
    {
        return self::$traceId ??= bin2hex(random_bytes(16));
    }
}
