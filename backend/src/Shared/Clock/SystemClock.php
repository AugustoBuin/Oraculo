<?php

declare(strict_types=1);

namespace App\Shared\Clock;

/**
 * O relógio do sistema. A implementação de produção.
 */
final class SystemClock implements Clock
{
    public function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable();
    }
}
