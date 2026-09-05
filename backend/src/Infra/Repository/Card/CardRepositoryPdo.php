<?php

declare(strict_types=1);

namespace App\Infra\Repository\Card;

use App\Domain\Card\Entity\Card;
use App\Domain\Card\Entity\CardImage;
use App\Domain\Card\Gateway\CardGateway;
use App\Domain\Card\Gateway\CardQuery;
use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Entity\Game;
use App\Domain\Catalog\Entity\Rarity;
use App\Shared\Enum\ImageType;

/**
 * Persistência de cartas em MySQL.
 *
 * Duas regras que o §7.3 do padrão impõe e que este arquivo cumpre por
 * construção:
 *
 * - **Sem N+1.** Jogo, edição e raridade vêm por JOIN na mesma consulta. Uma
 *   listagem de vinte cartas faz UMA consulta, não sessenta e uma.
 * - **Sem leitura ilimitada.** Toda listagem é paginada, e nenhuma consulta usa
 *   `SELECT *` — colunas explícitas são o que protege o código de uma coluna
 *   nova sensível entrar de carona na resposta.
 */
final class CardRepositoryPdo implements CardGateway
{
    private const DATE_FORMAT = 'Y-m-d H:i:s';

    /**
     * As colunas das quatro tabelas, com prefixo para não colidirem.
     * Escrito uma vez e reaproveitado por todas as leituras.
     */
    private const COLUMNS = '
        c.id, c.name_en, c.name_pt, c.image_type, c.image_reference,
        c.created_by, c.updated_by, c.created_at, c.updated_at, c.deleted_at,
        g.id AS g_id, g.slug AS g_slug, g.name AS g_name, g.active AS g_active, g.sort_order AS g_sort,
        e.id AS e_id, e.game_id AS e_game_id, e.code AS e_code, e.name AS e_name,
        e.active AS e_active, e.sort_order AS e_sort,
        r.id AS r_id, r.game_id AS r_game_id, r.code AS r_code, r.name AS r_name,
        r.active AS r_active, r.sort_order AS r_sort
    ';

    private const JOINS = '
        FROM cards c
        INNER JOIN games g ON g.id = c.game_id
        INNER JOIN editions e ON e.id = c.edition_id
        INNER JOIN rarities r ON r.id = c.rarity_id
    ';

    public function __construct(
        private readonly \PDO $pdo,
    ) {
    }

    public function findById(int $id): ?Card
    {
        return $this->fetchOne('c.id = :id AND c.deleted_at IS NULL', ['id' => $id]);
    }

    public function findByIdIncludingDeleted(int $id): ?Card
    {
        return $this->fetchOne('c.id = :id', ['id' => $id]);
    }

    public function search(CardQuery $query): array
    {
        [$where, $params] = $this->buildFilters($query);

        // A contagem usa exatamente os mesmos filtros da listagem. Duplicar a
        // cláusula seria a origem clássica de "a paginação diz 3 páginas e a
        // terceira vem vazia".
        $countStatement = $this->pdo->prepare('SELECT COUNT(*) ' . self::JOINS . ' WHERE ' . $where);
        $countStatement->execute($params);
        $total = (int) $countStatement->fetchColumn();

        // LIMIT e OFFSET são interpolados porque MySQL não aceita parâmetro
        // neles. Os dois vêm de CardQuery, que já os normalizou para inteiros
        // dentro de faixas fixas — nunca do cliente diretamente.
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . self::JOINS
            . ' WHERE ' . $where
            . ' ORDER BY ' . $query->orderByClause()
            . ' LIMIT ' . $query->perPage . ' OFFSET ' . $query->offset()
        );
        $statement->execute($params);

        return [
            'items' => array_map($this->toEntity(...), $statement->fetchAll()),
            'total' => $total,
        ];
    }

    public function insert(Card $card): int
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO cards
                (game_id, edition_id, rarity_id, name_en, name_pt,
                 image_type, image_reference, created_by, created_at)
             VALUES
                (:game_id, :edition_id, :rarity_id, :name_en, :name_pt,
                 :image_type, :image_reference, :created_by, :created_at)'
        );

        $statement->execute([
            'game_id' => $card->game->id,
            'edition_id' => $card->edition->id,
            'rarity_id' => $card->rarity->id,
            'name_en' => $card->nameEn,
            'name_pt' => $card->namePt,
            'image_type' => $card->image?->type->value,
            'image_reference' => $card->image?->reference,
            'created_by' => $card->createdBy,
            'created_at' => $card->createdAt->format(self::DATE_FORMAT),
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function update(Card $card): void
    {
        // created_by e created_at ficam de fora: quem criou a carta não muda
        // porque outra pessoa a corrigiu.
        $statement = $this->pdo->prepare(
            'UPDATE cards SET
                game_id = :game_id, edition_id = :edition_id, rarity_id = :rarity_id,
                name_en = :name_en, name_pt = :name_pt,
                image_type = :image_type, image_reference = :image_reference,
                updated_by = :updated_by, updated_at = :updated_at
             WHERE id = :id'
        );

        $statement->execute([
            'game_id' => $card->game->id,
            'edition_id' => $card->edition->id,
            'rarity_id' => $card->rarity->id,
            'name_en' => $card->nameEn,
            'name_pt' => $card->namePt,
            'image_type' => $card->image?->type->value,
            'image_reference' => $card->image?->reference,
            'updated_by' => $card->updatedBy,
            'updated_at' => $card->updatedAt?->format(self::DATE_FORMAT),
            'id' => $card->id,
        ]);
    }

    public function softDelete(int $id, int $userId, \DateTimeImmutable $at): void
    {
        // deleted_at e updated_at recebem o mesmo instante, mas por
        // placeholders DISTINTOS: com ATTR_EMULATE_PREPARES desligado o MySQL
        // prepara de verdade, e o protocolo nativo não aceita o mesmo nome duas
        // vezes na mesma instrução.
        $statement = $this->pdo->prepare(
            'UPDATE cards SET deleted_at = :deleted_at, updated_by = :user_id, updated_at = :updated_at
             WHERE id = :id AND deleted_at IS NULL'
        );

        $timestamp = $at->format(self::DATE_FORMAT);

        $statement->execute([
            'deleted_at' => $timestamp,
            'updated_at' => $timestamp,
            'user_id' => $userId,
            'id' => $id,
        ]);
    }

    public function restore(int $id, int $userId, \DateTimeImmutable $at): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE cards SET deleted_at = NULL, updated_by = :user_id, updated_at = :at
             WHERE id = :id AND deleted_at IS NOT NULL'
        );

        $statement->execute([
            'user_id' => $userId,
            'at' => $at->format(self::DATE_FORMAT),
            'id' => $id,
        ]);
    }

    public function findDuplicate(int $editionId, string $nameEn, ?int $excludingId): ?Card
    {
        $where = 'c.edition_id = :edition_id AND c.name_en = :name_en AND c.deleted_at IS NULL';
        $params = ['edition_id' => $editionId, 'name_en' => $nameEn];

        if ($excludingId !== null) {
            // Numa edição, a própria carta não pode contar como duplicata de si.
            $where .= ' AND c.id <> :excluding';
            $params['excluding'] = $excludingId;
        }

        return $this->fetchOne($where, $params);
    }

    /** @param array<string,mixed> $params */
    private function fetchOne(string $where, array $params): ?Card
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . self::JOINS . ' WHERE ' . $where . ' LIMIT 1'
        );
        $statement->execute($params);

        $row = $statement->fetch();

        return $row === false ? null : $this->toEntity($row);
    }

    /**
     * @return array{0: string, 1: array<string,mixed>}
     */
    private function buildFilters(CardQuery $query): array
    {
        $conditions = ['c.deleted_at IS NULL'];
        $params = [];

        if ($query->search !== null) {
            // LIKE com curinga à esquerda não usa índice. É a escolha certa na
            // escala atual — dezenas a milhares de cartas — e é o que o usuário
            // espera de uma busca. Gatilho para trocar por índice FULLTEXT:
            // ~100 mil cartas (docs/database-schema.md, seção 3.8).
            // Dois placeholders distintos para o mesmo valor, e não `:search`
            // repetido: com ATTR_EMULATE_PREPARES desligado — como o §7.2
            // exige — o MySQL prepara de verdade, e o protocolo nativo não
            // aceita o mesmo nome duas vezes. Com emulação ligada isto
            // funcionaria, o que é justamente o tipo de defeito que a emulação
            // esconde até chegar em produção.
            $conditions[] = '(c.name_en LIKE :search_en OR c.name_pt LIKE :search_pt)';
            $term = '%' . $this->escapeLike($query->search) . '%';
            $params['search_en'] = $term;
            $params['search_pt'] = $term;
        }

        foreach (['gameId' => 'c.game_id', 'editionId' => 'c.edition_id', 'rarityId' => 'c.rarity_id'] as $field => $column) {
            if ($query->{$field} !== null) {
                $conditions[] = $column . ' = :' . $field;
                $params[$field] = $query->{$field};
            }
        }

        return [implode(' AND ', $conditions), $params];
    }

    /**
     * Escapa os curingas do LIKE.
     *
     * Sem isto, buscar por "100%" traria tudo, e um "_" digitado casaria com
     * qualquer caractere. Não é falha de segurança — o valor continua
     * parametrizado —, é resultado errado.
     */
    private function escapeLike(string $term): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term);
    }

    /** @param array<string,mixed> $row */
    private function toEntity(array $row): Card
    {
        $imageType = $row['image_type'] === null
            ? null
            : ImageType::tryFrom((string) $row['image_type']);

        return Card::with(
            id: (int) $row['id'],
            nameEn: (string) $row['name_en'],
            namePt: $row['name_pt'] === null ? null : (string) $row['name_pt'],
            game: Game::with(
                (int) $row['g_id'],
                (string) $row['g_slug'],
                (string) $row['g_name'],
                (bool) $row['g_active'],
                (int) $row['g_sort'],
            ),
            edition: Edition::with(
                (int) $row['e_id'],
                (int) $row['e_game_id'],
                (string) $row['e_code'],
                (string) $row['e_name'],
                (bool) $row['e_active'],
                (int) $row['e_sort'],
            ),
            rarity: Rarity::with(
                (int) $row['r_id'],
                (int) $row['r_game_id'],
                (string) $row['r_code'],
                (string) $row['r_name'],
                (bool) $row['r_active'],
                (int) $row['r_sort'],
            ),
            image: $imageType === null ? null : CardImage::with($imageType, (string) $row['image_reference']),
            createdBy: (int) $row['created_by'],
            updatedBy: $row['updated_by'] === null ? null : (int) $row['updated_by'],
            createdAt: new \DateTimeImmutable((string) $row['created_at']),
            updatedAt: $row['updated_at'] === null ? null : new \DateTimeImmutable((string) $row['updated_at']),
            deletedAt: $row['deleted_at'] === null ? null : new \DateTimeImmutable((string) $row['deleted_at']),
        );
    }
}
