<?php

declare(strict_types=1);

namespace App\Domain\Card\Gateway;

use App\Domain\Card\Entity\Card;

/**
 * A porta de persistência de cartas.
 *
 * Métodos nomeados pelo que o domínio precisa, e não um repositório genérico
 * com `find(array $criteria)`: o genérico aceita qualquer coisa e não documenta
 * nada, enquanto esta interface diz, em sete linhas, tudo o que o sistema faz
 * com uma carta.
 */
interface CardGateway
{
    /** Cartas excluídas NÃO são devolvidas por aqui. */
    public function findById(int $id): ?Card;

    /** Inclui as excluídas — usado pela restauração, que só age sobre elas. */
    public function findByIdIncludingDeleted(int $id): ?Card;

    /**
     * @return array{items: list<Card>, total: int}
     */
    public function search(CardQuery $query): array;

    /** @return int o id gerado */
    public function insert(Card $card): int;

    public function update(Card $card): void;

    /**
     * Exclusão lógica: a carta some das listagens e das contagens, e o
     * histórico é preservado (RN-05).
     */
    public function softDelete(int $id, int $userId, \DateTimeImmutable $at): void;

    public function restore(int $id, int $userId, \DateTimeImmutable $at): void;

    /**
     * Outra carta ativa com o mesmo nome na mesma edição.
     *
     * `$excludingId` existe para a edição: ao salvar uma carta, ela própria não
     * pode contar como duplicata de si mesma.
     */
    public function findDuplicate(int $editionId, string $nameEn, ?int $excludingId): ?Card;
}
