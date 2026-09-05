<?php

declare(strict_types=1);

namespace App\UseCases\Card;

use App\Domain\Card\Gateway\CardGateway;
use App\Domain\Card\Gateway\CardQuery;
use App\Domain\Catalog\Gateway\EditionGateway;
use App\Domain\Catalog\Gateway\GameGateway;
use App\Domain\Catalog\Gateway\RarityGateway;
use App\Domain\Errors\ValidationError;

/**
 * Lista cartas com busca, filtros e paginação.
 *
 * Os filtros chegam como identificadores públicos — slug do jogo, código da
 * edição e da raridade — e são resolvidos aqui para ids. É o mesmo princípio da
 * cadeia de validação: o cliente nunca vê nem informa id de catálogo.
 *
 * Filtro que não resolve é **erro de validação**, não filtro ignorado: ignorar
 * devolveria uma lista que não corresponde ao que a interface está mostrando
 * como selecionado, e o usuário acharia que o filtro não funciona.
 */
final class ListCardsUseCase
{
    private function __construct(
        private readonly CardGateway $cards,
        private readonly GameGateway $games,
        private readonly EditionGateway $editions,
        private readonly RarityGateway $rarities,
    ) {
    }

    public static function create(
        CardGateway $cards,
        GameGateway $games,
        EditionGateway $editions,
        RarityGateway $rarities,
    ): self {
        return new self($cards, $games, $editions, $rarities);
    }

    /**
     * @return array{items: list<\App\Domain\Card\Entity\Card>, total: int, page: int, perPage: int}
     */
    public function execute(ListCardsInput $input): array
    {
        $gameId = null;
        $editionId = null;
        $rarityId = null;

        if ($input->gameSlug !== null) {
            $game = $this->games->findBySlug($input->gameSlug);

            if ($game === null) {
                throw ValidationError::field('game', 'Card game desconhecido.');
            }

            $gameId = $game->id;

            // Edição e raridade só fazem sentido dentro de um jogo: filtrar por
            // edição sem dizer de qual jogo é ambíguo, porque dois jogos podem
            // usar a mesma sigla.
            if ($input->editionCode !== null) {
                $edition = $this->editions->findByGameAndCode($gameId, $input->editionCode);

                if ($edition === null) {
                    throw ValidationError::field('edition', 'Edição desconhecida para este Card Game.');
                }

                $editionId = $edition->id;
            }

            if ($input->rarityCode !== null) {
                $rarity = $this->rarities->findByGameAndCode($gameId, $input->rarityCode);

                if ($rarity === null) {
                    throw ValidationError::field('rarity', 'Raridade desconhecida para este Card Game.');
                }

                $rarityId = $rarity->id;
            }
        } elseif ($input->editionCode !== null || $input->rarityCode !== null) {
            throw ValidationError::field('game', 'Selecione um Card Game para filtrar por edição ou raridade.');
        }

        $query = CardQuery::create(
            page: $input->page,
            perPage: $input->perPage,
            search: $input->search,
            gameId: $gameId,
            editionId: $editionId,
            rarityId: $rarityId,
            sort: $input->sort,
        );

        $result = $this->cards->search($query);

        return [
            'items' => $result['items'],
            'total' => $result['total'],
            'page' => $query->page,
            'perPage' => $query->perPage,
        ];
    }
}
