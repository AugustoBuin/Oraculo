<?php

declare(strict_types=1);

namespace App\Infra\Repository\Auth;

use App\Domain\Auth\Gateway\LoginAttemptGateway;

final class LoginAttemptRepositoryPdo implements LoginAttemptGateway
{
    private const DATE_FORMAT = 'Y-m-d H:i:s';

    public function __construct(
        private readonly \PDO $pdo,
    ) {
    }

    public function countSince(string $identifier, \DateTimeImmutable $since): int
    {
        // Usa idx_attempts_window (identifier, attempted_at): sem esse índice,
        // toda tentativa de login varreria a tabela inteira.
        $statement = $this->pdo->prepare(
            'SELECT COUNT(*) FROM login_attempts
             WHERE identifier = :identifier AND attempted_at >= :since'
        );

        $statement->execute([
            'identifier' => $identifier,
            'since' => $since->format(self::DATE_FORMAT),
        ]);

        return (int) $statement->fetchColumn();
    }

    public function record(string $identifier, \DateTimeImmutable $at): void
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO login_attempts (identifier, attempted_at) VALUES (:identifier, :at)'
        );

        $statement->execute([
            'identifier' => $identifier,
            'at' => $at->format(self::DATE_FORMAT),
        ]);
    }

    public function clear(string $identifier): void
    {
        $statement = $this->pdo->prepare('DELETE FROM login_attempts WHERE identifier = :identifier');
        $statement->execute(['identifier' => $identifier]);
    }

    public function purgeOlderThan(\DateTimeImmutable $before, int $limit): int
    {
        // LIMIT interpolado porque MySQL não aceita parâmetro em LIMIT. É um
        // inteiro do próprio código, nunca entrada do cliente.
        $statement = $this->pdo->prepare(
            'DELETE FROM login_attempts WHERE attempted_at < :before LIMIT ' . max(1, $limit)
        );

        $statement->execute(['before' => $before->format(self::DATE_FORMAT)]);

        return $statement->rowCount();
    }
}
