<?php

declare(strict_types=1);

namespace App\Shared\Enum;

/**
 * Os status HTTP que este sistema emite.
 *
 * Enum em vez de número solto: um `http_response_code(403)` no meio do código
 * não diz se aquilo é "sem sessão" ou "sem permissão", e a diferença entre os
 * dois decide o que o frontend faz (docs/decisions/ADR-007).
 *
 * A lista é fechada de propósito. Status que o sistema não emite não entra aqui
 * — enum grande vira catálogo, e catálogo ninguém lê.
 */
enum HttpStatus: int
{
    case OK = 200;
    case CREATED = 201;
    case NO_CONTENT = 204;

    case BAD_REQUEST = 400;
    case UNAUTHORIZED = 401;
    case FORBIDDEN = 403;
    case NOT_FOUND = 404;
    case METHOD_NOT_ALLOWED = 405;
    case CONFLICT = 409;
    case PAYLOAD_TOO_LARGE = 413;
    case UNSUPPORTED_MEDIA_TYPE = 415;
    case TOO_MANY_REQUESTS = 429;

    case INTERNAL_SERVER_ERROR = 500;

    /**
     * Resposta sem corpo. Usado pelo Response para não serializar `null` em
     * uma resposta que, por definição, não tem o que serializar.
     */
    public function hasBody(): bool
    {
        return $this !== self::NO_CONTENT;
    }
}
