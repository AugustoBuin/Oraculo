<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Domain\User\Entity\User;
use App\Domain\User\Entity\UserCredentials;
use App\Domain\User\Gateway\UserGateway;
use App\Shared\Enum\PermissionLevel;

final class InMemoryUserGateway implements UserGateway
{
    /** @var array<int,UserCredentials> */
    public array $users = [];

    /** Quantas vezes o hash foi conferido — para provar a defesa de temporização. */
    public int $verificationCount = 0;

    public function add(
        int $id,
        string $email,
        string $password,
        PermissionLevel $level = PermissionLevel::EDITOR,
        bool $active = true,
        string $name = 'Usuário de Teste',
    ): User {
        $user = User::with($id, $name, $email, $level, $active);

        // Custo 4 nos testes: bcrypt com custo 12 é lento de propósito, e a
        // suíte inteira rodaria em dezenas de segundos.
        $this->users[$id] = new UserCredentials(
            $user,
            password_hash($password, PASSWORD_BCRYPT, ['cost' => 4])
        );

        return $user;
    }

    public function findById(int $id): ?User
    {
        return $this->users[$id]->user ?? null;
    }

    public function findCredentialsByEmail(string $email): ?UserCredentials
    {
        foreach ($this->users as $credentials) {
            if ($credentials->user->email === $email) {
                return $credentials;
            }
        }

        return null;
    }

    public function findCredentialsById(int $id): ?UserCredentials
    {
        return $this->users[$id] ?? null;
    }

    public function updatePasswordHash(int $userId, string $passwordHash): void
    {
        if (!isset($this->users[$userId])) {
            return;
        }

        $this->users[$userId] = new UserCredentials($this->users[$userId]->user, $passwordHash);
    }
}
