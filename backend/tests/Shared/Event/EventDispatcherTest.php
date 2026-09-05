<?php

declare(strict_types=1);

namespace Tests\Shared\Event;

use App\Domain\Card\Event\CardChanged;
use App\Shared\Enum\CardAction;
use App\Shared\Event\DomainEvent;
use App\Shared\Event\EventDispatcher;
use Tests\Doubles\SpyLogger;
use Tests\TestCase;

/**
 * O dispatcher de eventos de domínio (docs/decisions/ADR-005).
 *
 * A propriedade que estes testes protegem é uma só, e é a que justifica a
 * classe existir: **um handler nunca derruba quem disparou o evento**.
 *
 * Quando um handler roda, a operação principal já aconteceu — a carta já foi
 * gravada. Deixar a falha subir faria o usuário receber erro numa operação que
 * deu certo, tentar de novo, e criar uma segunda carta.
 */
final class EventDispatcherTest extends TestCase
{
    private SpyLogger $logger;

    private function makeSut(): EventDispatcher
    {
        $this->logger = new SpyLogger();

        return new EventDispatcher($this->logger);
    }

    private function event(): CardChanged
    {
        return new CardChanged(cardId: 7, userId: 2, action: CardAction::CREATED);
    }

    public function testEntregaOEventoAoHandlerRegistrado(): void
    {
        $sut = $this->makeSut();
        $recebidos = new \ArrayObject();

        $sut->on(CardChanged::class, static function (CardChanged $event) use ($recebidos): void {
            $recebidos[] = $event->cardId;
        });

        $sut->dispatch($this->event());

        $this->assertSame([7], (array) $recebidos);
    }

    public function testEntregaAVariosHandlersDoMesmoEvento(): void
    {
        $sut = $this->makeSut();
        $trilha = new \ArrayObject();

        $sut->on(CardChanged::class, static function () use ($trilha): void {
            $trilha[] = 'primeiro';
        });
        $sut->on(CardChanged::class, static function () use ($trilha): void {
            $trilha[] = 'segundo';
        });

        $sut->dispatch($this->event());

        $this->assertSame(['primeiro', 'segundo'], (array) $trilha);
    }

    public function testHandlerQueLancaNaoPropagaAExcecao(): void
    {
        $sut = $this->makeSut();

        $sut->on(CardChanged::class, static function (): void {
            throw new \RuntimeException('o banco de auditoria caiu');
        });

        // Sem asserção de exceção: o teste passa justamente por NADA ser
        // lançado. Se esta linha explodir, a operação de quem disparou o evento
        // explodiria junto.
        $sut->dispatch($this->event());

        $this->assertTrue(str_contains($this->logger->everythingLogged(), 'o banco de auditoria caiu'));
    }

    public function testUmHandlerQueFalhaNaoImpedeOsDemais(): void
    {
        $sut = $this->makeSut();
        $trilha = new \ArrayObject();

        $sut->on(CardChanged::class, static function (): void {
            throw new \RuntimeException('falhou');
        });
        $sut->on(CardChanged::class, static function () use ($trilha): void {
            $trilha[] = 'ainda rodei';
        });

        $sut->dispatch($this->event());

        $this->assertSame(['ainda rodei'], (array) $trilha);
    }

    public function testEventoSemHandlerNaoFazNada(): void
    {
        $sut = $this->makeSut();

        $sut->dispatch($this->event());

        $this->assertCount(0, $this->logger->entries);
    }

    public function testNaoEntregaEventoDeOutroTipoAoHandler(): void
    {
        $sut = $this->makeSut();
        $recebidos = new \ArrayObject();

        $outroEvento = new class implements DomainEvent {
        };

        $sut->on($outroEvento::class, static function () use ($recebidos): void {
            $recebidos[] = 'nao deveria';
        });

        $sut->dispatch($this->event());

        $this->assertCount(0, (array) $recebidos);
    }
}
