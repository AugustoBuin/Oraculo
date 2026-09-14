<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Shared\Clock\Clock;

/**
 * Relógio parado, que só anda quando o teste manda.
 *
 * É o que torna expiração de sessão e janela de tentativas verificáveis sem
 * esperar de verdade — e sem produzir teste instável.
 */
final class FrozenClock implements Clock
{
    private \DateTimeImmutable $now;

    public function __construct(string $instant = '2026-09-05 12:00:00')
    {
        $this->now = new \DateTimeImmutable($instant);
    }

    public function now(): \DateTimeImmutable
    {
        return $this->now;
    }

    public function advance(string $interval): void
    {
        $this->now = $this->now->modify($interval);
    }
}
