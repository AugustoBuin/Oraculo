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
     * @return list<array{id: string, name: string, active?: bool}>
     */
    public static function editions(array $editions, bool $withState = false): array
    {
        return array_map(
            static fn(Edition $e): array => self::item($e->code, $e->name, $e->active, $withState),
            $editions
        );
    }

    /**
     * @param list<Rarity> $rarities
     * @return list<array{id: string, name: string, active?: bool}>
     */
    public static function rarities(array $rarities, bool $withState = false): array
    {
        return array_map(
            static fn(Rarity $r): array => self::item($r->code, $r->name, $r->active, $withState),
            $rarities
        );
    }

    /**
     * A forma do item.
     *
     * `active` é ACRESCENTADO, nunca substituído: a forma publicada pelo
     * enunciado continua sendo `{id, name}` para todo mundo que não pediu a
     * lista completa — e é ela que a cascata consome. O campo a mais só
     * aparece para quem administra o catálogo, que precisa saber o que está
     * desativado para poder reativar.
     *
     * @return array{id: string, name: string, active?: bool}
     */
    private static function item(string $code, string $name, bool $active, bool $withState): array
    {
        $item = ['id' => $code, 'name' => $name];

        if ($withState) {
            $item['active'] = $active;
        }

        return $item;
    }
}
