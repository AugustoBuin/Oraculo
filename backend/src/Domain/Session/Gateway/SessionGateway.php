<?php

declare(strict_types=1);

namespace App\Domain\Session\Gateway;

use App\Domain\Session\Entity\Session;

/**
 * A porta de persistência de sessões.
 *
 * Vive no domínio e é implementada em Infra: é o que permite testar o caso de
 * uso de autenticação sem banco, e o que torna `deleteAllForUser` uma operação
 * de uma linha em vez de um varredura impossível sobre arquivos de sessão.
 */
interface SessionGateway
{
    public function findById(string $id): ?Session;

    public function save(Session $session): void;

    public function deleteById(string $id): void;

    /**
     * Encerra TODAS as sessões de um usuário.
     *
     * Exigido pelo PADROES.md §5.4 na troca de senha. É a operação que a sessão
     * em arquivo torna inviável, e a razão principal de a sessão viver no banco.
     */
    public function deleteAllForUser(int $userId): void;

    /**
     * Remove sessões vencidas, no máximo `$limit` por execução.
     *
     * O limite não é detalhe: uma limpeza sem teto trava a tabela por segundos
     * no primeiro milhão de linhas, no meio de uma requisição de usuário.
     *
     * @return int quantas foram removidas
     */
    public function collectExpired(\DateTimeImmutable $now, int $limit): int;
}
