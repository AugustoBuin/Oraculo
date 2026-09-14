<?php

declare(strict_types=1);

namespace App\Modules;

use App\Infra\Http\Guard;
use App\Infra\Http\Route;
use App\Infra\Http\Routes\Auth\ChangePasswordRoute;
use App\Infra\Http\Routes\Auth\CurrentSessionRoute;
use App\Infra\Http\Routes\Auth\LoginRoute;
use App\Infra\Http\Routes\Auth\LogoutRoute;
use App\Infra\Repository\Auth\LoginAttemptRepositoryPdo;
use App\Infra\Repository\Session\SessionRepositoryPdo;
use App\Infra\Repository\User\UserRepositoryPdo;
use App\Shared\Clock\Clock;
use App\Shared\Enum\PermissionLevel;
use App\Shared\Observability\Logger;
use App\UseCases\Auth\AuthenticateUserUseCase;
use App\UseCases\Auth\ChangePasswordUseCase;
use App\UseCases\Auth\EndSessionUseCase;

/**
 * Composition root da autenticação.
 *
 * Instancia repositórios e casos de uso, e devolve as rotas **já protegidas**.
 * A injeção é feita à mão e fica visível: um container esconderia justamente a
 * dependência que a assinatura do caso de uso faz questão de declarar
 * (PADROES.md §3.2 — Service Locator é proibido).
 *
 * Ler este arquivo responde, em quinze linhas, quais rotas existem e em que
 * nível cada uma está. É esse resumo que torna uma rota desprotegida visível na
 * revisão, em vez de escondida no meio de um método.
 */
final class AuthModule
{
    /** @return list<Route> */
    public static function routes(
        \PDO $pdo,
        Clock $clock,
        Logger $logger,
        int $sessionTtlSeconds,
        bool $secureCookie,
    ): array {
        $users = new UserRepositoryPdo($pdo);
        $sessions = new SessionRepositoryPdo($pdo);
        $attempts = new LoginAttemptRepositoryPdo($pdo);

        $authenticate = AuthenticateUserUseCase::create(
            users: $users,
            sessions: $sessions,
            attempts: $attempts,
            clock: $clock,
            logger: $logger,
            sessionTtlSeconds: $sessionTtlSeconds,
        );

        $endSession = EndSessionUseCase::create($sessions, $logger);
        $changePassword = ChangePasswordUseCase::create($users, $sessions, $logger);

        return [
            // PÚBLICA — a única do sistema. Justificativa: é a rota que cria a
            // sessão, então não pode exigir sessão (PADROES.md §5.1).
            LoginRoute::create($authenticate, $secureCookie),

            Guard::protect(CurrentSessionRoute::create(), PermissionLevel::VIEWER),
            Guard::protect(LogoutRoute::create($endSession, $secureCookie), PermissionLevel::VIEWER),

            // VIEWER e não ADMIN: qualquer pessoa troca a PRÓPRIA senha, e o
            // "própria" é garantido pelo userId vir da sessão, não do corpo.
            Guard::protect(ChangePasswordRoute::create($changePassword, $secureCookie), PermissionLevel::VIEWER),
        ];
    }
}
