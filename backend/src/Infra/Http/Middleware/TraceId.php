<?php

declare(strict_types=1);

namespace App\Infra\Http\Middleware;

use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Shared\Observability\RequestContext;

/**
 * Identificador de correlação da requisição.
 *
 * Sem ele não há como reconstruir o que aconteceu numa requisição específica
 * quando o log tem milhares de linhas de dezenas de requisições intercaladas
 * (PADROES.md §6, regra 6).
 *
 * O identificador é anexado ao contexto estático — em PHP uma requisição é um
 * processo, então isso não sobrevive a ela e não é o singleton com estado
 * proibido pelo §3.2 — e também à requisição, para quem precisar carregá-lo
 * adiante sem depender do estático.
 */
final class TraceId implements Middleware
{
    public const ATTRIBUTE = 'traceId';

    public function handle(Request $request, callable $next): Response
    {
        return $next($request->withAttribute(self::ATTRIBUTE, RequestContext::traceId()));
    }
}
