<?php

declare(strict_types=1);

namespace App\Infra\Http\Middleware;

use App\Domain\Session\Entity\Session;
use App\Domain\Session\Gateway\SessionGateway;
use App\Domain\User\Gateway\UserGateway;
use App\Infra\Http\Guard;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Shared\Clock\Clock;

/**
 * Resolve a sessão a partir do cookie e anexa o usuário à requisição.
 *
 * **Este elo não decide nada.** Ele apenas disponibiliza: quem recusa acesso é
 * o guard, no registro da rota. Separar assim é o que permite `GET
 * /api/auth/session` responder 401 como caminho normal, em vez de tratar
 * "ainda não logou" como incidente.
 */
final class SessionMiddleware implements Middleware
{
    /**
     * Nome do cookie. Não menciona PHP nem a tecnologia: `PHPSESSID` entrega de
     * graça a stack para quem sonda.
     */
    public const COOKIE_NAME = 'ORACULOSID';

    public const SESSION_ATTRIBUTE = 'session';

    public function __construct(
        private readonly SessionGateway $sessions,
        private readonly UserGateway $users,
        private readonly Clock $clock,
        private readonly int $ttlSeconds,
    ) {
    }

    public function handle(Request $request, callable $next): Response
    {
        $session = $this->resolveSession($request);

        if ($session === null) {
            return $next($request);
        }

        $user = $this->users->findById($session->userId);

        if ($user === null || !$user->active) {
            // Usuário excluído ou desativado enquanto a sessão vivia: a sessão
            // morre junto, na hora. Sem isso, desativar um usuário não teria
            // efeito nenhum até a sessão dele vencer sozinha.
            $this->sessions->deleteById($session->id);

            return $next($request);
        }

        return $next(
            $request
                ->withAttribute(Guard::USER_ATTRIBUTE, $user)
                ->withAttribute(self::SESSION_ATTRIBUTE, $this->renewIfStale($session))
        );
    }

    private function resolveSession(Request $request): ?Session
    {
        $id = $request->cookie(self::COOKIE_NAME);

        if ($id === null || $id === '') {
            return null;
        }

        $session = $this->sessions->findById($id);

        if ($session === null) {
            return null;
        }

        if ($session->hasExpired($this->clock->now())) {
            // Aproveita a passagem para limpar. A coleta em lote continua
            // existindo para as sessões cujo dono nunca mais voltou.
            $this->sessions->deleteById($session->id);

            return null;
        }

        return $session;
    }

    /**
     * Renova a validade, mas não a cada requisição.
     *
     * Gravar em toda requisição transformaria cada `GET` numa escrita no banco.
     * Renovar só depois de passada metade do prazo mantém quem está trabalhando
     * logado e reduz a escrita a uma vez a cada seis horas, com TTL de doze.
     */
    private function renewIfStale(Session $session): Session
    {
        $now = $this->clock->now();
        $halfLife = $now->modify('-' . intdiv($this->ttlSeconds, 2) . ' seconds');

        if ($session->lastActivityAt > $halfLife) {
            return $session;
        }

        $renewed = $session->renewed($this->ttlSeconds, $now);
        $this->sessions->save($renewed);

        return $renewed;
    }
}
