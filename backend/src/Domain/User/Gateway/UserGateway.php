<?php

declare(strict_types=1);

namespace App\Domain\User\Gateway;

use App\Domain\User\Entity\User;
use App\Domain\User\Entity\UserCredentials;

interface UserGateway
{
    /**
     * O usuário sem o hash — é este que circula pela aplicação.
     */
    public function findById(int $id): ?User;

    /**
     * O usuário COM o hash, para conferência de credencial.
     *
     * Só o caso de uso de autenticação chama este método. Se aparecer em outro
     * lugar, o hash ganhou um segundo caminho e a regra se perdeu.
     */
    public function findCredentialsByEmail(string $email): ?UserCredentials;

    /**
     * O mesmo, por id. Usado pela troca de senha, que identifica o usuario pela
     * sessao e nao por e-mail digitado.
     */
    public function findCredentialsById(int $id): ?UserCredentials;

    public function updatePasswordHash(int $userId, string $passwordHash): void;
}
