<?php

declare(strict_types=1);

namespace App\Shared\Enum;

/**
 * Os verbos que este sistema atende.
 */
enum HttpMethod: string
{
    case GET = 'GET';
    case POST = 'POST';
    case PUT = 'PUT';
    case PATCH = 'PATCH';
    case DELETE = 'DELETE';

    /**
     * Verbo que altera estado.
     *
     * É o que decide se a requisição precisa de token anti-CSRF: leitura não
     * precisa, escrita precisa (PADROES.md §5.4).
     */
    public function changesState(): bool
    {
        return $this !== self::GET;
    }
}
