<?php

declare(strict_types=1);

namespace App\Shared\Clock;

/**
 * O relógio, como dependência injetada.
 *
 * Existe para que expiração de sessão e janela de tentativas de login sejam
 * testáveis: teste que depende do tempo real ou é lento, ou é instável, ou não
 * cobre a borda que importa — e teste instável é bug (PADROES.md §13.4).
 */
interface Clock
{
    public function now(): \DateTimeImmutable;
}
