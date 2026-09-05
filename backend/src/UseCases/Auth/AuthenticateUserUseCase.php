<?php

declare(strict_types=1);

namespace App\UseCases\Auth;

use App\Domain\Auth\Gateway\LoginAttemptGateway;
use App\Domain\Errors\TooManyRequestsError;
use App\Domain\Errors\UnauthorizedError;
use App\Domain\Session\Entity\Session;
use App\Domain\Session\Gateway\SessionGateway;
use App\Domain\User\Entity\UserCredentials;
use App\Domain\User\Gateway\UserGateway;
use App\Shared\Clock\Clock;
use App\Shared\Observability\Logger;

/**
 * Confere a credencial e abre a sessão.
 *
 * Três defesas trabalham juntas aqui, e nenhuma funciona sozinha:
 *
 * 1. **A mesma resposta para os três casos de falha** — usuário inexistente,
 *    senha errada e conta inativa. Distinguir entrega uma lista de usuários
 *    válidos a quem tentar (PADROES.md §5.4).
 * 2. **O hash é conferido mesmo quando o usuário não existe.** Sem isso, a
 *    resposta para um e-mail desconhecido volta em microssegundos e a de senha
 *    errada leva o tempo do bcrypt: o relógio vira o oráculo que a mensagem
 *    idêntica tentou fechar.
 * 3. **Limite de tentativas por (e-mail, IP)** — e ele vale inclusive para a
 *    credencial correta. Se a senha certa passasse por cima do bloqueio, o
 *    limite não atrapalharia em nada um ataque de força bruta, que é
 *    justamente quando a senha certa aparece.
 */
final class AuthenticateUserUseCase
{
    private const MAX_ATTEMPTS = 5;
    private const WINDOW_SECONDS = 900; // 15 minutos

    /**
     * Hash descartável, usado só para gastar o mesmo tempo de CPU quando o
     * e-mail não existe. É um bcrypt válido de uma senha que ninguém conhece.
     */
    private const DUMMY_HASH = '$2y$12$C6UzMDM.H6dfI/f/IKcEe.7Rlp1IhxMy2AeMNRLmnPtaQXUCwCEQm';

    private const GENERIC_FAILURE = 'E-mail ou senha inválidos.';

    private function __construct(
        private readonly UserGateway $users,
        private readonly SessionGateway $sessions,
        private readonly LoginAttemptGateway $attempts,
        private readonly Clock $clock,
        private readonly Logger $logger,
        private readonly int $sessionTtlSeconds,
    ) {
    }

    public static function create(
        UserGateway $users,
        SessionGateway $sessions,
        LoginAttemptGateway $attempts,
        Clock $clock,
        Logger $logger,
        int $sessionTtlSeconds,
    ): self {
        return new self($users, $sessions, $attempts, $clock, $logger, $sessionTtlSeconds);
    }

    public function execute(AuthenticateUserInput $input): AuthenticateUserOutput
    {
        $now = $this->clock->now();
        $identifier = $this->identifierFor($input);

        $this->assertWithinAttemptLimit($identifier, $now);

        $credentials = $this->users->findCredentialsByEmail($input->email);

        if (!$this->isValid($credentials, $input->password)) {
            $this->attempts->record($identifier, $now);

            // O log guarda o e-mail tentado — é o que permite investigar um
            // ataque —, mas nunca a senha nem o hash: o logger redige por nome
            // de campo, e aqui nem chegam a ser passados.
            $this->logger->warning('Tentativa de autenticação recusada', [
                'email' => $input->email,
                'ip' => $input->ipAddress,
            ]);

            throw new UnauthorizedError(self::GENERIC_FAILURE);
        }

        // Acertar zera o contador: quem errou duas vezes antes de lembrar a
        // senha não pode continuar a dois erros do bloqueio.
        $this->attempts->clear($identifier);

        $session = Session::start(
            userId: $credentials->user->id,
            ttlSeconds: $this->sessionTtlSeconds,
            now: $now,
            ipAddress: $input->ipAddress,
            userAgent: $input->userAgent,
        );

        $this->sessions->save($session);

        $this->logger->info('Sessão aberta', [
            'userId' => $credentials->user->id,
            'ip' => $input->ipAddress,
        ]);

        return $this->present($credentials, $session);
    }

    /**
     * Verdadeiro só quando o usuário existe, está ativo e a senha confere.
     *
     * A conferência do hash acontece nos três casos — inclusive quando não há
     * usuário — para que o tempo de resposta não denuncie qual deles ocorreu.
     */
    private function isValid(?UserCredentials $credentials, string $password): bool
    {
        if ($credentials === null) {
            password_verify($password, self::DUMMY_HASH);

            return false;
        }

        $passwordMatches = $credentials->matches($password);

        return $passwordMatches && $credentials->user->active;
    }

    private function assertWithinAttemptLimit(string $identifier, \DateTimeImmutable $now): void
    {
        $since = $now->modify('-' . self::WINDOW_SECONDS . ' seconds');

        if ($this->attempts->countSince($identifier, $since) >= self::MAX_ATTEMPTS) {
            throw new TooManyRequestsError('Muitas tentativas. Tente novamente em alguns minutos.');
        }
    }

    /**
     * A janela é por (e-mail, IP), e o identificador é o hash dos dois.
     *
     * Por IP apenas, um escritório inteiro atrás de um NAT seria bloqueado por
     * causa de um colega distraído. Por e-mail apenas, qualquer pessoa poderia
     * trancar a conta alheia de propósito.
     */
    private function identifierFor(AuthenticateUserInput $input): string
    {
        return hash('sha256', strtolower(trim($input->email)) . '|' . ($input->ipAddress ?? ''));
    }

    private function present(UserCredentials $credentials, Session $session): AuthenticateUserOutput
    {
        return new AuthenticateUserOutput($credentials->user, $session);
    }
}
