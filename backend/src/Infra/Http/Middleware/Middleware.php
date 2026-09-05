<?php

declare(strict_types=1);

namespace App\Infra\Http\Middleware;

use App\Infra\Http\Request;
use App\Infra\Http\Response;

/**
 * Um elo da Chain of Responsibility do pipeline HTTP (docs/decisions/ADR-005).
 *
 * Chamar `$next($request)` segue a cadeia; devolver uma Response sem chamar
 * interrompe. É esse curto-circuito que faz o guard existir: quem não passa na
 * autenticação ou na autorização não alcança a rota.
 *
 * A requisição é imutável: um elo que precisa acrescentar informação deriva uma
 * nova com `withAttribute()` e a repassa adiante.
 */
interface Middleware
{
    public function handle(Request $request, callable $next): Response;
}
