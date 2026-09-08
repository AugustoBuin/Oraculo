<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Gateway;

use App\Domain\Catalog\Entity\Rarity;

interface RarityGateway
{
    /** @return list<Rarity> ativas do jogo, na ordem natural do jogo */
    public function listActiveByGame(int $gameId): array;

    /**
     * Todas do jogo, **inclusive as desativadas**, na ordem de exibição.
     *
     * Existe para a administração de catálogos: sem ela, desativar um item pela
     * interface é porta de mão única — ele some da única listagem que poderia
     * mostrá-lo, e não há de onde chamar o PUT que o reativa. Quem decide se
     * este caminho pode ser usado é o caso de uso, pelo nível de quem pede.
     *
     * @return list<Rarity>
     */
    public function listAllByGame(int $gameId): array;


    /** Ver a nota em EditionGateway: o jogo entra na busca, não depois dela. */
    public function findByGameAndCode(int $gameId, string $code): ?Rarity;

    public function findById(int $id): ?Rarity;
}
