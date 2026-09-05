<?php

declare(strict_types=1);

namespace App\Domain\Card\Gateway;

use App\Domain\Errors\ValidationError;

/**
 * Os parâmetros de uma busca de cartas, já normalizados.
 *
 * Existe para que o repositório receba valores em que possa confiar: a página
 * nunca é zero, `perPage` nunca ultrapassa o teto, e o campo de ordenação vem
 * de uma **allowlist**.
 *
 * A allowlist é o ponto do sistema onde algo vindo do cliente chega mais perto
 * de um nome de coluna. Um `ORDER BY` montado com texto do cliente é injeção de
 * SQL que nenhum prepared statement pega — parâmetro não vale para nome de
 * coluna (PADROES.md §7.2).
 */
final class CardQuery
{
    public const DEFAULT_PAGE_SIZE = 20;
    public const MAX_PAGE_SIZE = 100;

    /** Valor público => expressão de ordenação. Nada fora daqui alcança o SQL. */
    public const SORTS = [
        'recent' => 'c.id DESC',
        'name' => 'c.name_en ASC, c.id ASC',
        'game' => 'g.sort_order ASC, e.sort_order ASC, c.name_en ASC',
    ];

    private function __construct(
        public readonly int $page,
        public readonly int $perPage,
        public readonly ?string $search,
        public readonly ?int $gameId,
        public readonly ?int $editionId,
        public readonly ?int $rarityId,
        public readonly string $sort,
    ) {
    }

    public static function create(
        ?string $page = null,
        ?string $perPage = null,
        ?string $search = null,
        ?int $gameId = null,
        ?int $editionId = null,
        ?int $rarityId = null,
        ?string $sort = null,
    ): self {
        if ($sort !== null && !array_key_exists($sort, self::SORTS)) {
            throw ValidationError::field('sort', 'Ordenação inválida.');
        }

        $normalizedSearch = $search === null ? null : trim($search);

        return new self(
            page: max(1, (int) ($page ?? 1)),
            // Acima do teto é TRUNCADO, não recusado: rejeitar aqui
            // transformaria um detalhe de cliente em erro visível ao usuário.
            perPage: min(self::MAX_PAGE_SIZE, max(1, (int) ($perPage ?? self::DEFAULT_PAGE_SIZE))),
            search: $normalizedSearch === '' ? null : $normalizedSearch,
            gameId: $gameId,
            editionId: $editionId,
            rarityId: $rarityId,
            sort: $sort ?? 'recent',
        );
    }

    public function offset(): int
    {
        return ($this->page - 1) * $this->perPage;
    }

    public function orderByClause(): string
    {
        return self::SORTS[$this->sort];
    }
}
