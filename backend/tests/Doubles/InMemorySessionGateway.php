<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Domain\Session\Entity\Session;
use App\Domain\Session\Gateway\SessionGateway;

/**
 * Sessões em memória.
 *
 * Dublê no nível do gateway — que é a fronteira que o domínio define para isso.
 * Substituir a camada de banco por um dublê testa o dublê; substituir a porta
 * deixa o código real rodar inteiro (PADROES.md §10.4).
 */
final class InMemorySessionGateway implements SessionGateway
{
    /** @var array<string,Session> */
    public array $sessions = [];

    public function findById(string $id): ?Session
    {
        return $this->sessions[$id] ?? null;
    }

    public function save(Session $session): void
    {
        $this->sessions[$session->id] = $session;
    }

    public function deleteById(string $id): void
    {
        unset($this->sessions[$id]);
    }

    public function deleteAllForUser(int $userId): void
    {
        foreach ($this->sessions as $id => $session) {
            if ($session->userId === $userId) {
                unset($this->sessions[$id]);
            }
        }
    }

    public function collectExpired(\DateTimeImmutable $now, int $limit): int
    {
        $removed = 0;

        foreach ($this->sessions as $id => $session) {
            if ($removed >= $limit) {
                break;
            }

            if ($session->hasExpired($now)) {
                unset($this->sessions[$id]);
                $removed++;
            }
        }

        return $removed;
    }
}
