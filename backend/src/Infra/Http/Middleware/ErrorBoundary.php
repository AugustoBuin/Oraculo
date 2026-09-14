<?php

declare(strict_types=1);

namespace App\Infra\Http\Middleware;

use App\Infra\Http\ErrorHandler;
use App\Infra\Http\Request;
use App\Infra\Http\Response;

/**
 * Converte qualquer Throwable levantado adiante numa Response.
 *
 * Fica DEPOIS do middleware de cabeçalhos de segurança na cadeia, e isso é
 * deliberado: assim a resposta de erro que ele produz ainda sobe pelo elo de
 * segurança e recebe os cabeçalhos. Se a ordem fosse invertida, toda resposta
 * de erro sairia sem CSP, sem nosniff e sem X-Frame-Options — justamente o
 * caminho menos exercitado do sistema.
 */
final class ErrorBoundary implements Middleware
{
    public function __construct(
        private readonly ErrorHandler $errorHandler,
    ) {
    }

    public function handle(Request $request, callable $next): Response
    {
        try {
            return $next($request);
        } catch (\Throwable $error) {
            return $this->errorHandler->toResponse($error);
        }
    }
}
