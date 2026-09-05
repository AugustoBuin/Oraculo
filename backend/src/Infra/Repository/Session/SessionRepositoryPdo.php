<?php

declare(strict_types=1);

namespace App\Infra\Repository\Session;

use App\Domain\Session\Entity\Session;
use App\Domain\Session\Gateway\SessionGateway;

/**
 * Persistência de sessões em MySQL.
 *
 * Só traduz domínio para banco e de volta. Nenhuma regra de negócio mora aqui:
 * decidir se a sessão vale é do domínio, não do repositório.
 */
final class SessionRepositoryPdo implements SessionGateway
{
    private const DATE_FORMAT = 'Y-m-d H:i:s';

    /** Colunas listadas explicitamente — nunca SELECT *. */
    private const COLUMNS = 'id, user_id, csrf_token, ip_address, user_agent, created_at, last_activity_at, expires_at';

    public function __construct(
        private readonly \PDO $pdo,
    ) {
    }

    public function findById(string $id): ?Session
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM sessions WHERE id = :id LIMIT 1'
        );
        $statement->execute(['id' => $id]);

        $row = $statement->fetch();

        return $row === false ? null : $this->toEntity($row);
    }

    public function save(Session $session): void
    {
        // Upsert: a mesma operação serve para abrir e para renovar. Só os
        // campos que mudam com o uso são atualizados — id, dono e token
        // permanecem os da abertura.
        $statement = $this->pdo->prepare(
            'INSERT INTO sessions
                (id, user_id, csrf_token, ip_address, user_agent, created_at, last_activity_at, expires_at)
             VALUES
                (:id, :user_id, :csrf_token, :ip_address, :user_agent, :created_at, :last_activity_at, :expires_at)
             ON DUPLICATE KEY UPDATE
                last_activity_at = VALUES(last_activity_at),
                expires_at = VALUES(expires_at)'
        );

        $statement->execute([
            'id' => $session->id,
            'user_id' => $session->userId,
            'csrf_token' => $session->csrfToken,
            'ip_address' => $session->ipAddress,
            'user_agent' => $session->userAgent,
            'created_at' => $session->createdAt->format(self::DATE_FORMAT),
            'last_activity_at' => $session->lastActivityAt->format(self::DATE_FORMAT),
            'expires_at' => $session->expiresAt->format(self::DATE_FORMAT),
        ]);
    }

    public function deleteById(string $id): void
    {
        $statement = $this->pdo->prepare('DELETE FROM sessions WHERE id = :id');
        $statement->execute(['id' => $id]);
    }

    public function deleteAllForUser(int $userId): void
    {
        // A operação que justifica a sessão viver no banco: encerrar o acesso
        // em todos os dispositivos, de uma vez (PADROES.md §5.4).
        $statement = $this->pdo->prepare('DELETE FROM sessions WHERE user_id = :user_id');
        $statement->execute(['user_id' => $userId]);
    }

    public function collectExpired(\DateTimeImmutable $now, int $limit): int
    {
        // LIMIT não é detalhe: limpeza sem teto trava a tabela por segundos no
        // primeiro milhão de linhas, no meio de uma requisição de usuário.
        // O limite é interpolado porque MySQL não aceita parâmetro em LIMIT —
        // e é um inteiro do próprio código, nunca entrada do cliente.
        $statement = $this->pdo->prepare(
            'DELETE FROM sessions WHERE expires_at <= :now LIMIT ' . max(1, $limit)
        );
        $statement->execute(['now' => $now->format(self::DATE_FORMAT)]);

        return $statement->rowCount();
    }

    /** @param array<string,mixed> $row */
    private function toEntity(array $row): Session
    {
        return Session::with(
            id: (string) $row['id'],
            userId: (int) $row['user_id'],
            csrfToken: (string) $row['csrf_token'],
            createdAt: new \DateTimeImmutable((string) $row['created_at']),
            lastActivityAt: new \DateTimeImmutable((string) $row['last_activity_at']),
            expiresAt: new \DateTimeImmutable((string) $row['expires_at']),
            ipAddress: $row['ip_address'] === null ? null : (string) $row['ip_address'],
            userAgent: $row['user_agent'] === null ? null : (string) $row['user_agent'],
        );
    }
}
