<?php

declare(strict_types=1);

namespace App\UseCases\Auth;

use App\Domain\Errors\UnauthorizedError;
use App\Domain\Errors\ValidationError;
use App\Domain\Session\Gateway\SessionGateway;
use App\Domain\User\Gateway\UserGateway;
use App\Shared\Observability\Logger;

/**
 * Troca a senha e encerra todas as sessões do usuário.
 *
 * A segunda metade é a que importa (RF-05, PADROES.md §5.4): quem troca a senha
 * quase sempre o faz porque desconfia de acesso indevido. Trocar sem revogar
 * deixaria o invasor logado — e daria ao usuário a sensação de estar protegido
 * justamente quando não está.
 *
 * A ordem também importa: conferir primeiro, depois gravar, depois revogar.
 * Revogar antes de conferir permitiria a qualquer pessoa deslogar outra só
 * chutando a senha atual.
 */
final class ChangePasswordUseCase
{
    private const MIN_LENGTH = 8;
    private const BCRYPT_COST = 12;

    private function __construct(
        private readonly UserGateway $users,
        private readonly SessionGateway $sessions,
        private readonly Logger $logger,
    ) {
    }

    public static function create(UserGateway $users, SessionGateway $sessions, Logger $logger): self
    {
        return new self($users, $sessions, $logger);
    }

    public function execute(ChangePasswordInput $input): void
    {
        $this->validate($input);

        $credentials = $this->users->findCredentialsById($input->userId);

        if ($credentials === null || !$credentials->matches($input->currentPassword)) {
            // Mesma mensagem para "usuário sumiu" e "senha atual errada".
            throw new UnauthorizedError('Senha atual incorreta.');
        }

        $this->users->updatePasswordHash(
            $input->userId,
            password_hash($input->newPassword, PASSWORD_BCRYPT, ['cost' => self::BCRYPT_COST])
        );

        $this->sessions->deleteAllForUser($input->userId);

        // Nem a senha antiga nem a nova aparecem aqui — e o logger redigiria
        // por nome de campo mesmo se aparecessem.
        $this->logger->info('Senha alterada; todas as sessões do usuário foram encerradas', [
            'userId' => $input->userId,
        ]);
    }

    private function validate(ChangePasswordInput $input): void
    {
        $errors = [];

        if (mb_strlen($input->newPassword) < self::MIN_LENGTH) {
            $errors['newPassword'] = 'A nova senha precisa ter pelo menos ' . self::MIN_LENGTH . ' caracteres.';
        }

        if ($input->newPassword === $input->currentPassword) {
            // Trocar por ela mesma encerraria as sessões sem trocar nada: o
            // usuário sairia da tela achando que se protegeu.
            $errors['newPassword'] = 'A nova senha precisa ser diferente da atual.';
        }

        if ($errors !== []) {
            throw ValidationError::fields($errors);
        }
    }
}
