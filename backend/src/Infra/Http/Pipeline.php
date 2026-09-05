<?php

declare(strict_types=1);

namespace App\Infra\Http;

use App\Infra\Http\Middleware\Middleware;

/**
 * Encadeia os middlewares em torno de um destino.
 *
 * A Chain of Responsibility do pipeline HTTP (docs/decisions/ADR-005). Elimina
 * o front controller procedural com condicional aninhada: cada preocupação
 * — correlação, cabeçalho, corpo, sessão, autenticação, autorização, CSRF —
 * vira uma classe com uma responsabilidade, testável isoladamente.
 *
 * Elo que não chama `$next` interrompe a cadeia. É esse curto-circuito que faz
 * o guard funcionar: quem não passa não alcança a rota.
 */
final class Pipeline
{
    /** @param list<Middleware> $middlewares */
    public function __construct(
        private readonly array $middlewares,
    ) {
    }

    /**
     * @param callable(Request): Response $destination
     */
    public function process(Request $request, callable $destination): Response
    {
        // Monta de trás para frente: o último elo fica mais próximo do destino,
        // então a execução acontece na ordem em que foram declarados.
        $next = $destination;

        foreach (array_reverse($this->middlewares) as $middleware) {
            $current = $next;
            $next = static fn(Request $incoming): Response => $middleware->handle($incoming, $current);
        }

        return $next($request);
    }
}
