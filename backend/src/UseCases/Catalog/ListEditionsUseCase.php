<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Gateway\EditionGateway;
use App\Domain\Catalog\Gateway\GameGateway;
use App\Domain\Errors\NotFoundError;
use App\Shared\Enum\PermissionLevel;

/**
 * As edições de um jogo.
 *
 * É o endpoint que o requisito 2.a do enunciado dispara ao selecionar o Card
 * Game. Jogo inexistente ou inativo responde 404 — e não lista vazia: lista
 * vazia diria ao usuário "este jogo não tem edições", que é uma informação
 * diferente e falsa.
 */
final class ListEditionsUseCase
{
    private function __construct(
        private readonly GameGateway $games,
        private readonly EditionGateway $editions,
    ) {
    }

    public static function create(GameGateway $games, EditionGateway $editions): self
    {
        return new self($games, $editions);
    }

    /**
     * @param PermissionLevel $requesterLevel o nível de quem pede, vindo da sessão
     * @param bool $includeInactive pedido do cliente, honrado só para ADMIN
     * @return list<Edition>
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
            return $this->editions->listAllByGame($game->id);
        }

        return $this->editions->listActiveByGame($game->id);
    }
}
