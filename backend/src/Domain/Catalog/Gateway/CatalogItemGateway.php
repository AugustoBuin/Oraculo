<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Gateway;

/**
 * O que edição e raridade compartilham como itens de catálogo: desativar,
 * conferir código repetido, saber o jogo dono e se alguma carta usa o item.
 *
 * Criar e alterar já moraram aqui, quando a escrita das duas era idêntica. A
 * raridade ganhou cor, a escrita divergiu, e cada uma passou a declarar a sua
 * (EditionGateway, RarityGateway). É o mesmo critério nas duas direções: unir
 * o que não diverge, separar o que diverge. Desativar continua comum porque é
 * a mesma operação para as duas.
 */
interface CatalogItemGateway
{
    /** Nome legível do tipo, para as mensagens: "edição", "raridade". */
    public function label(): string;

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
