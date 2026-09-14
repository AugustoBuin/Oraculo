<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Entity\Rarity;
use App\Domain\Catalog\Gateway\GameGateway;
use App\Domain\Catalog\Gateway\RarityGateway;
use App\Domain\Errors\NotFoundError;
use App\Shared\Enum\PermissionLevel;

/**
 * As raridades de um jogo.
 *
 * O enunciado não pede este endpoint: ele pede a cascata só para a edição. Ele
 * existe porque raridade também é específica de cada TCG, e um campo livre
 * permitiria cadastrar carta de Magic como "Secret Rare" (docs/PRD.md, seção 6,
 * decisão 1). Reaproveita exatamente o mecanismo já construído para as edições.
 */
final class ListRaritiesUseCase
{
    private function __construct(
        private readonly GameGateway $games,
        private readonly RarityGateway $rarities,
    ) {
    }

    public static function create(GameGateway $games, RarityGateway $rarities): self
    {
        return new self($games, $rarities);
    }

    /**
     * @param PermissionLevel $requesterLevel o nível de quem pede, vindo da sessão
     * @param bool $includeInactive pedido do cliente, honrado só para ADMIN
     * @return list<Rarity>
     */
    public function execute(
        string $gameSlug,
        PermissionLevel $requesterLevel,
        bool $includeInactive = false,
    ): array {
        $game = $this->games->findBySlug($gameSlug);

        if ($game === null || !$game->active) {
            throw new NotFoundError('Card game não encontrado.');
        }

        /*
         * A decisão de nível mora AQUI, e não na rota.
         *
         * `$includeInactive` vem da query string, que é dado do cliente: sem
         * esta checagem, qualquer sessão veria o catálogo desativado
         * acrescentando um parâmetro na barra do navegador. Deixar a regra no
         * caso de uso é o que a coloca sob teste unitário, com o efeito que
         * não pode acontecer coberto (ADR-004).
         *
         * O padrão continua sendo só ativos: a cascata do cadastro usa esta
         * mesma rota, e oferecer um item desativado para carta nova seria o
         * oposto do que o RF-43 pede.
         */
        if ($includeInactive && $requesterLevel->allows(PermissionLevel::ADMIN)) {
            return $this->rarities->listAllByGame($game->id);
        }

        return $this->rarities->listActiveByGame($game->id);
    }
}
