<?php

declare(strict_types=1);

namespace App\Domain\Auth\Gateway;

/**
 * Janela deslizante de tentativas de login.
 *
 * O identificador é sempre um **hash** de (e-mail + IP), nunca o e-mail em
 * claro: guardar o e-mail transformaria a tabela numa lista de usuários do
 * sistema, legível por qualquer leitura acidental — um log, um dump, uma
 * consulta de suporte.
 */
interface LoginAttemptGateway
{
    public function countSince(string $identifier, \DateTimeImmutable $since): int;

    public function record(string $identifier, \DateTimeImmutable $at): void;

    /** Chamado no login bem-sucedido: acertar zera o contador. */
    public function clear(string $identifier): void;

    /** @return int quantas linhas foram removidas */
    public function purgeOlderThan(\DateTimeImmutable $before, int $limit): int;
}
