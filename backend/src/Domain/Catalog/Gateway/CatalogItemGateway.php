<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Gateway;

/**
 * A escrita de um item de catálogo que pertence a um jogo.
 *
 * Edição e raridade são entidades separadas de propósito — vão divergir —, mas
 * a **escrita** das duas é idêntica: criar dentro de um jogo, renomear, reordenar
 * e desativar. Esta porta expressa esse conceito compartilhado e elimina seis
 * classes quase iguais.
 *
 * É o teste do §1.3 aplicado na direção contrária: separar Edition de Rarity
 * elimina acoplamento entre conceitos que vão divergir; unificar a escrita
 * elimina duplicação de código que não vai divergir. As duas decisões olham
 * para o mesmo critério.
 */
interface CatalogItemGateway
{
    /** Nome legível do tipo, para as mensagens: "edição", "raridade". */
    public function label(): string;

    public function insert(int $gameId, string $code, string $name, int $sortOrder): int;

    public function updateDetails(int $id, string $name, int $sortOrder, bool $active): void;

    public function deactivate(int $id): void;

    public function existsWithCode(int $gameId, string $code, ?int $excludingId): bool;

    /** O item existe? Devolve o jogo dono, ou null se não existe. */
    public function gameIdOf(int $id): ?int;

    /**
     * Alguma carta usa este item?
     *
     * Item em uso não é excluído, apenas desativado: apagar levaria junto as
     * cartas que dependem dele, e um portal administrativo não pode ter um
     * botão cuja consequência real o usuário não consegue prever (RF-43).
     */
    public function isInUse(int $id): bool;
}
