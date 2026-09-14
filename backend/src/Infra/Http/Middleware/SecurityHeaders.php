<?php

declare(strict_types=1);

namespace App\Infra\Http\Middleware;

use App\Infra\Http\Request;
use App\Infra\Http\Response;

/**
 * Cabeçalhos de segurança em TODA resposta, inclusive nas de erro.
 *
 * A resposta de erro é o caminho menos exercitado e o mais fácil de esquecer —
 * e uma resposta de erro sem estes cabeçalhos é uma superfície inteira
 * desprotegida.
 */
final class SecurityHeaders implements Middleware
{
    /**
     * A política é restritiva por padrão. `img-src` aceita https externo porque
     * carta pode ter imagem informada por URL (RF-31) — é a única concessão.
     *
     * Sem `unsafe-inline` e sem `unsafe-eval`: com eles, script injetado
     * executa igual e a CSP vira decoração. A ausência obriga todo script e
     * todo estilo a virem de arquivo, que é bom padrão de qualquer forma.
     */
    private const CONTENT_SECURITY_POLICY =
        "default-src 'self'; "
        . "img-src 'self' https: data:; "
        . "script-src 'self'; "
        . "style-src 'self'; "
        . "font-src 'self'; "
        . "connect-src 'self'; "
        . "object-src 'none'; "
        . "base-uri 'none'; "
        . "form-action 'self'; "
        . "frame-ancestors 'none'";

    public function handle(Request $request, callable $next): Response
    {
        return $next($request)->withDefaultHeaders([
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'same-origin',
            'Content-Security-Policy' => self::CONTENT_SECURITY_POLICY,
        ]);
    }
}
