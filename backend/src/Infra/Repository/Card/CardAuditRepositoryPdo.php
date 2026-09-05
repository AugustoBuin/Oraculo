<?php

declare(strict_types=1);

namespace App\Infra\Repository\Card;

use App\Domain\Card\Entity\CardAuditEntry;
use App\Domain\Card\Gateway\CardAuditGateway;
use App\Shared\Enum\CardAction;

final class CardAuditRepositoryPdo implements CardAuditGateway
{
    private const DATE_FORMAT = 'Y-m-d H:i:s';

    public function __construct(
        private readonly \PDO $pdo,
    ) {
    }

    public function record(
        int $cardId,
        int $userId,
        CardAction $action,
        array $changes,
        ?string $traceId,
        \DateTimeImmutable $at,
    ): void {
        $statement = $this->pdo->prepare(
            'INSERT INTO card_audit (card_id, user_id, action, changes, trace_id, created_at)
             VALUES (:card_id, :user_id, :action, :changes, :trace_id, :created_at)'
        );

        $statement->execute([
            'card_id' => $cardId,
            'user_id' => $userId,
            'action' => $action->value,
            'changes' => $changes === []
                ? null
                : json_encode($changes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'trace_id' => $traceId,
            'created_at' => $at->format(self::DATE_FORMAT),
        ]);
    }

    public function listForCard(int $cardId, int $limit): array
    {
        // O nome de quem agiu vem por JOIN: guardar o nome na linha de
        // auditoria congelaria um valor que muda, e ler o usuário por linha
        // seria N+1.
        // LEFT JOIN porque a restrição da chave estrangeira impede excluir o
        // usuário — mas a consulta não deve depender disso para funcionar.
        $statement = $this->pdo->prepare(
            'SELECT a.action, a.user_id, a.changes, a.created_at, u.name AS user_name
             FROM card_audit a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.card_id = :card_id
             ORDER BY a.created_at DESC, a.id DESC
             LIMIT ' . max(1, $limit)
        );
        $statement->execute(['card_id' => $cardId]);

        return array_map($this->toEntity(...), $statement->fetchAll());
    }

    /** @param array<string,mixed> $row */
    private function toEntity(array $row): CardAuditEntry
    {
        $changes = [];

        if (is_string($row['changes']) && $row['changes'] !== '') {
            $decoded = json_decode($row['changes'], true);
            // Histórico com JSON corrompido não pode derrubar a tela inteira:
            // a entrada aparece sem detalhe, e o resto continua legível.
            $changes = is_array($decoded) ? $decoded : [];
        }

        return CardAuditEntry::with(
            action: CardAction::from((string) $row['action']),
            userId: (int) $row['user_id'],
            userName: $row['user_name'] === null ? null : (string) $row['user_name'],
            changes: $changes,
            createdAt: new \DateTimeImmutable((string) $row['created_at']),
        );
    }
}
