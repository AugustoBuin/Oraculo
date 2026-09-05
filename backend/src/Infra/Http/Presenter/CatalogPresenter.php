<?php

declare(strict_types=1);

namespace App\Infra\Http\Presenter;

use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Entity\Game;
use App\Domain\Catalog\Entity\Rarity;

/**
 * A forma pública dos itens de catálogo: `{ "id": "dom", "name": "Dominaria" }`.
 *
 * Essa forma não é escolha de estilo — é **o contrato que o enunciado publicou**
 * no JSON de edições. O frontend consome exatamente o que o desafio especificou.
 *
 * O `id` exposto é sempre o slug ou o código, nunca o id numérico: id de
 * catálogo é detalhe de armazenamento, e expô-lo amarraria o contrato público à
 * ordem de inserção do seed.
 */
final class CatalogPresenter
{
    /**
     * @param list<Game> $games
     * @return list<array{id: string, name: string}>
     */
    public static function games(array $games): array
    {
        return array_map(
            static fn(Game $game): array => ['id' => $game->slug, 'name' => $game->name],
            $games
        );
    }

    /**
     * @param list<Edition> $editions
     * @return list<array{id: string, name: string}>
     */
    public static function editions(array $editions): array
    {
        return array_map(
            static fn(Edition $edition): array => ['id' => $edition->code, 'name' => $edition->name],
            $editions
        );
    }

    /**
     * @param list<Rarity> $rarities
     * @return list<array{id: string, name: string}>
     */
    public static function rarities(array $rarities): array
    {
        return array_map(
            static fn(Rarity $rarity): array => ['id' => $rarity->code, 'name' => $rarity->name],
            $rarities
        );
    }
}
