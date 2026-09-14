<?php

declare(strict_types=1);

namespace App\Infra\EventHandlers;

use App\Domain\Card\Event\CardChanged;
use App\Domain\Card\Gateway\CardAuditGateway;
use App\Shared\Clock\Clock;
use App\Shared\Observability\Logger;
use App\Shared\Observability\RequestContext;

/**
 * Grava a trilha de auditoria quando uma carta muda.
 *
 * O único ouvinte do projeto, e a justificativa inteira do Observer: sem ele,
 * cada caso de uso de carta carregaria a responsabilidade de escrever auditoria
 * — acoplando duas preocupações que mudam por motivos completamente diferentes.
 *
 * **Este handler nunca lança.** A regra vem do PADROES.md §2.4 e existe por uma
 * razão concreta: quando ele roda, a carta JÁ foi persistida. Deixar uma falha
 * de auditoria subir faria o usuário receber erro numa operação que deu certo,
 * tentar de novo, e criar uma segunda carta. O dispatcher também protege, mas a
 * proteção mora aqui primeiro — quem escreve o handler é quem sabe o que pode
 * falhar nele.
 */
final class WriteCardAuditHandler
{
    public function __construct(
        private readonly CardAuditGateway $audit,
        private readonly Clock $clock,
        private readonly Logger $logger,
    ) {
    }

    public function __invoke(CardChanged $event): void
    {
        try {
            $this->audit->record(
                cardId: $event->cardId,
                userId: $event->userId,
                action: $event->action,
                changes: $event->changes,
                // Liga a linha de auditoria ao log da requisição que a gerou.
                traceId: RequestContext::traceId(),
                at: $this->clock->now(),
            );
        } catch (\Throwable $error) {
            $this->logger->error('Falha ao gravar auditoria de carta', [
                'cardId' => $event->cardId,
                'action' => $event->action->value,
                'error' => $error,
            ]);
        }
    }
}
