<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Card;

use App\Domain\Card\Entity\CardAuditEntry;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Card\GetCardHistoryUseCase;

/**
 * Quem mexeu nesta carta, o quê e quando.
 *
 * O par (RBAC, exclusão reversível) só faz sentido com isto: saber que alguém
 * pode excluir é diferente de saber quem excluiu.
 */
final class CardHistoryRoute implements Route
{
    private function __construct(
        private readonly GetCardHistoryUseCase $useCase,
    ) {
    }

    public static function create(GetCardHistoryUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::GET;
    }

    public function path(): string
    {
        return '/api/cards/{id}/history';
    }

    public function handle(Request $request): Response
    {
        $entries = $this->useCase->execute((int) $request->param('id'));

        return Response::ok(array_map(
            static fn(CardAuditEntry $entry): array => [
                'action' => $entry->action->value,
                'actionLabel' => $entry->action->label(),
                'user' => [
                    'id' => $entry->userId,
                    // Nome ausente só se o usuário sumir; a interface mostra um
                    // rótulo neutro em vez de um espaço em branco.
                    'name' => $entry->userName ?? 'Usuário removido',
                ],
                'changes' => $entry->changes,
                'createdAt' => $entry->createdAt->format(DATE_ATOM),
            ],
            $entries
        ));
    }
}
