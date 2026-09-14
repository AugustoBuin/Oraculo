<?php

declare(strict_types=1);

namespace App\UseCases\Auth;

use App\Domain\Session\Gateway\SessionGateway;
use App\Shared\Observability\Logger;

/**
 * Encerra uma sessão no servidor.
 *
 * Existe como caso de uso, e não como uma linha dentro da rota, porque é o
 * ponto onde a revogação acontece de fato — e um dia vai precisar registrar
 * auditoria de saída, ou invalidar cache do usuário. Rota fina, regra no lugar
 * certo.
 */
final class EndSessionUseCase
{
    private function __construct(
        private readonly SessionGateway $sessions,
        private readonly Logger $logger,
    ) {
    }

    public static function create(SessionGateway $sessions, Logger $logger): self
    {
        return new self($sessions, $logger);
    }

    public function execute(string $sessionId): void
    {
        $this->sessions->deleteById($sessionId);

        // O id da sessão NÃO é registrado: ele é a credencial. Um log com o id
        // vira uma lista de sessões utilizáveis para quem lê o log.
        $this->logger->info('Sessão encerrada');
    }
}
