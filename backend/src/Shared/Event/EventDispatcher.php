<?php

declare(strict_types=1);

namespace App\Shared\Event;

use App\Shared\Observability\Logger;

/**
 * O barramento de eventos de domínio (Observer + Command, docs/decisions/ADR-005).
 *
 * Existe por um gatilho concreto: "quando uma carta é criada, alterada,
 * excluída ou restaurada, também é preciso registrar quem fez e o quê". A
 * alternativa seria um caso de uso chamando outro — proibido pelo §2.2 — ou
 * cada caso de uso de carta carregando a responsabilidade de escrever
 * auditoria, acoplando duas preocupações que mudam por motivos diferentes.
 *
 * **A regra dura: um handler nunca derruba quem disparou o evento.**
 *
 * O corpo inteiro de cada despacho vai para try/catch, e a falha vira log. Sem
 * isso, uma auditoria que falha faria a carta — já persistida — responder erro
 * ao usuário, que tentaria de novo e criaria uma segunda carta. O padrão
 * registra exatamente esse defeito no §2.4.
 */
final class EventDispatcher
{
    /** @var array<string, list<callable(DomainEvent): void>> */
    private array $handlers = [];

    public function __construct(
        private readonly Logger $logger,
    ) {
    }

    /**
     * @param class-string<DomainEvent> $eventClass
     * @param callable(DomainEvent): void $handler
     */
    public function on(string $eventClass, callable $handler): void
    {
        $this->handlers[$eventClass][] = $handler;
    }

    public function dispatch(DomainEvent $event): void
    {
        foreach ($this->handlers[$event::class] ?? [] as $handler) {
            try {
                $handler($event);
            } catch (\Throwable $error) {
                // A operação principal já aconteceu. Propagar a falha aqui
                // transformaria um problema de efeito colateral em erro para
                // quem acabou de salvar.
                $this->logger->error('Handler de evento falhou', [
                    'event' => $event::class,
                    'error' => $error,
                ]);
            }
        }
    }
}
