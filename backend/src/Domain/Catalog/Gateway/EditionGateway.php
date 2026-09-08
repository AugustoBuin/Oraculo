<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Gateway;

use App\Domain\Catalog\Entity\Edition;

interface EditionGateway
{
    /** @return list<Edition> ativas do jogo, na ordem de exibição */
    public function listActiveByGame(int $gameId): array;

    /**
     * Todas do jogo, **inclusive as desativadas**, na ordem de exibição.
     *
     * Existe para a administração de catálogos: sem ela, desativar um item pela
     * interface é porta de mão única — ele some da única listagem que poderia
     * mostrá-lo, e não há de onde chamar o PUT que o reativa. Quem decide se
     * este caminho pode ser usado é o caso de uso, pelo nível de quem pede.
     *
     * @return list<Edition>
     */
    public function listAllByGame(int $gameId): array;


    /**
     * A edição de um jogo, pelo código.
     *
     * Recebe o jogo junto de propósito: procurar só pelo código encontraria a
     * edição de OUTRO jogo que use a mesma sigla, e a validação de "a edição
     * pertence ao jogo" passaria por acidente.
     */
    public function findByGameAndCode(int $gameId, string $code): ?Edition;

    public function findById(int $id): ?Edition;
}
