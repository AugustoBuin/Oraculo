<?php

declare(strict_types=1);

namespace App\Shared\Config;

/**
 * Falha de configuração de ambiente.
 *
 * Não descende de DomainError de propósito: não é erro de requisição, é falha
 * de boot. A aplicação não sobe, e nenhuma resposta HTTP chega a existir — por
 * isso a mensagem pode nomear a variável sem risco de vazar nada para usuário.
 */
final class EnvironmentError extends \RuntimeException
{
    public static function missing(string $key): self
    {
        return new self(
            "Variável de ambiente obrigatória ausente ou vazia: {$key}. "
            . 'Confira o .env — não existe valor default para nenhuma variável.'
        );
    }

    public static function malformed(string $key, string $expected): self
    {
        return new self("Variável de ambiente {$key} precisa ser {$expected}.");
    }
}
