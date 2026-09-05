<?php

declare(strict_types=1);

namespace App\Domain\Card\Entity;

use App\Domain\Card\Validation\ValidatedCard;
use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Entity\Game;
use App\Domain\Catalog\Entity\Rarity;

/**
 * Uma carta.
 *
 * Carrega as entidades de catálogo — Game, Edition, Rarity — e não apenas os
 * ids. Isso elimina a separação entre modelo de escrita e modelo de leitura que
 * um catálogo por id exigiria, e tem uma consequência melhor: **só é possível
 * construir uma carta a partir de um ValidatedCard**, que por sua vez só sai da
 * cadeia de validação. A coerência entre jogo, edição e raridade deixa de ser
 * uma checagem esquecível e vira condição de existência do objeto.
 *
 * `id` é nulo antes da primeira gravação. É a única forma de distinguir uma
 * carta nova de uma existente sem um sinalizador booleano à parte.
 */
final class Card
{
    private function __construct(
        public readonly ?int $id,
        public readonly string $nameEn,
        public readonly ?string $namePt,
        public readonly Game $game,
        public readonly Edition $edition,
        public readonly Rarity $rarity,
        public readonly ?CardImage $image,
        public readonly int $createdBy,
        public readonly ?int $updatedBy,
        public readonly \DateTimeImmutable $createdAt,
        public readonly ?\DateTimeImmutable $updatedAt,
        public readonly ?\DateTimeImmutable $deletedAt,
    ) {
    }

    public static function create(ValidatedCard $validated, int $authorId, \DateTimeImmutable $now): self
    {
        return new self(
            id: null,
            nameEn: $validated->nameEn,
            namePt: $validated->namePt,
            game: $validated->game,
            edition: $validated->edition,
            rarity: $validated->rarity,
            image: $validated->image,
            createdBy: $authorId,
            updatedBy: null,
            createdAt: $now,
            updatedAt: null,
            deletedAt: null,
        );
    }

    /** Reconstrói uma carta vinda do banco. */
    public static function with(
        int $id,
        string $nameEn,
        ?string $namePt,
        Game $game,
        Edition $edition,
        Rarity $rarity,
        ?CardImage $image,
        int $createdBy,
        ?int $updatedBy,
        \DateTimeImmutable $createdAt,
        ?\DateTimeImmutable $updatedAt,
        ?\DateTimeImmutable $deletedAt,
    ): self {
        return new self(
            $id,
            $nameEn,
            $namePt,
            $game,
            $edition,
            $rarity,
            $image,
            $createdBy,
            $updatedBy,
            $createdAt,
            $updatedAt,
            $deletedAt,
        );
    }

    /**
     * Aplica uma edição.
     *
     * `createdBy` e `createdAt` são preservados de propósito: quem criou a carta
     * não muda porque outra pessoa a corrigiu, e sobrescrever isso apagaria a
     * única informação de origem que o registro tem.
     */
    public function updatedWith(ValidatedCard $validated, int $editorId, \DateTimeImmutable $now): self
    {
        return new self(
            id: $this->id,
            nameEn: $validated->nameEn,
            namePt: $validated->namePt,
            game: $validated->game,
            edition: $validated->edition,
            rarity: $validated->rarity,
            image: $validated->image,
            createdBy: $this->createdBy,
            updatedBy: $editorId,
            createdAt: $this->createdAt,
            updatedAt: $now,
            deletedAt: $this->deletedAt,
        );
    }

    public function isDeleted(): bool
    {
        return $this->deletedAt !== null;
    }

    /**
     * As diferenças entre esta carta e outra, para a trilha de auditoria.
     *
     * Devolve valores **apresentáveis** — nomes, não ids internos. É o que se
     * quer ler seis meses depois: "Raridade: Rara -> Mítica", e não
     * "rarity_id: 32 -> 31".
     *
     * @return array<string,array{from: string|null, to: string|null}>
     */
    public function changesTo(self $other): array
    {
        $before = $this->comparable();
        $after = $other->comparable();
        $changes = [];

        foreach ($after as $field => $value) {
            if ($before[$field] !== $value) {
                $changes[$field] = ['from' => $before[$field], 'to' => $value];
            }
        }

        return $changes;
    }

    /** @return array<string,string|null> */
    private function comparable(): array
    {
        return [
            'nameEn' => $this->nameEn,
            'namePt' => $this->namePt,
            'game' => $this->game->name,
            'edition' => $this->edition->name,
            'rarity' => $this->rarity->name,
            'image' => $this->image?->reference,
        ];
    }
}
