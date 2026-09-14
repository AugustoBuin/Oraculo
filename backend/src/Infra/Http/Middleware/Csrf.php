<?php

declare(strict_types=1);

namespace App\Infra\Http\Middleware;

use App\Domain\Errors\ForbiddenError;
use App\Domain\Session\Entity\Session;
use App\Infra\Http\Request;
use App\Infra\Http\Response;

/**
 * Proteção anti-CSRF nas rotas de escrita.
 *
 * Autenticação por cookie significa **credencial ambiente**: o navegador envia
 * o cookie mesmo numa requisição originada de outro site. `SameSite=Lax` mitiga
 * — não elimina. Por isso toda escrita exige o token no cabeçalho, que só o
 * JavaScript da própria aplicação consegue ler e enviar.
 *
 * Duas decisões que valem leitura:
 *
 * - **Sem sessão, a cadeia segue.** Não havendo cookie, não há credencial
 *   ambiente e não há o que falsificar. Recusar aqui também produziria 403 onde
 *   a resposta correta é 401 — e o frontend levaria o usuário à tela errada.
 *
 * - **A falha é 403, nunca 401.** A sessão pode estar perfeitamente válida;
 *   tratar como 401 deslogaria o usuário por um problema que se resolve
 *   rebuscando o token, trocando um erro recuperável por perda de trabalho.
 */
final class Csrf implements Middleware
{
    public const HEADER = 'X-CSRF-Token';

    /** @param list<string> $exemptPaths caminhos que criam a sessão, e por isso não podem exigir o token */
    public function __construct(
        private readonly array $exemptPaths = [],
    ) {
    }

    public function handle(Request $request, callable $next): Response
    {
        if (!$request->changesState()) {
            return $next($request);
        }

        if (in_array(rtrim($request->path, '/'), $this->exemptPaths, true)) {
            return $next($request);
        }

        $session = $request->attribute(SessionMiddleware::SESSION_ATTRIBUTE);

        if (!$session instanceof Session) {
            return $next($request);
        }

        if (!$session->matchesCsrfToken($request->header(self::HEADER))) {
            throw new ForbiddenError('Requisição inválida. Recarregue a página e tente novamente.');
        }

        return $next($request);
    }
}
