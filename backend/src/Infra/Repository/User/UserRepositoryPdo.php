<?php

declare(strict_types=1);

namespace App\Infra\Repository\User;

use App\Domain\User\Entity\User;
use App\Domain\User\Entity\UserCredentials;
use App\Domain\User\Gateway\UserGateway;
use App\Shared\Enum\PermissionLevel;

/**
 * Persistência de usuários em MySQL.
 *
 * O hash da senha é lido em UM único método — `findCredentialsByEmail` — e sai
 * daqui embrulhado em UserCredentials, que só o caso de uso de autenticação
 * recebe. `findById`, usado por todo o resto do sistema, nunca o carrega:
 * é isso que impede o hash de aparecer num log de contexto ou numa resposta.
 */
final class UserRepositoryPdo implements UserGateway
{
    /** Sem SELECT *: é o que protege o código de uma coluna nova sensível entrar de carona. */
    private const PUBLIC_COLUMNS = 'id, name, email, role_level, active';

    public function __construct(
        private readonly \PDO $pdo,
    ) {
    }

    public function findById(int $id): ?User
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::PUBLIC_COLUMNS . '
             FROM users
             WHERE id = :id AND deleted_at IS NULL
             LIMIT 1'
        );
        $statement->execute(['id' => $id]);

        $row = $statement->fetch();

        return $row === false ? null : $this->toEntity($row);
    }

    public function findCredentialsByEmail(string $email): ?UserCredentials
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::PUBLIC_COLUMNS . ', password_hash
             FROM users
             WHERE email = :email AND deleted_at IS NULL
             LIMIT 1'
        );
        $statement->execute(['email' => $email]);

        $row = $statement->fetch();

        if ($row === false) {
            return null;
        }

        return new UserCredentials($this->toEntity($row), (string) $row['password_hash']);
    }

    public function updatePasswordHash(int $userId, string $passwordHash): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE users SET password_hash = :hash, updated_at = :now WHERE id = :id'
        );

        $statement->execute([
            'hash' => $passwordHash,
            'now' => date('Y-m-d H:i:s'),
            'id' => $userId,
        ]);
    }

    /** @param array<string,mixed> $row */
    private function toEntity(array $row): User
    {
        $level = PermissionLevel::tryFrom((int) $row['role_level']);

        if ($level === null) {
            // Nível fora do enum não vira um default permissivo: explode.
            // Um usuário com role_level corrompido não pode virar VIEWER por
            // conveniência — nem, muito pior, ADMIN.
            throw new \RuntimeException(
                'Nível de permissão inválido gravado para o usuário ' . (int) $row['id'] . '.'
            );
        }

        return User::with(
            id: (int) $row['id'],
            name: (string) $row['name'],
            email: (string) $row['email'],
            level: $level,
            active: (bool) $row['active'],
        );
    }
}
