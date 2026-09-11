<?php

declare(strict_types=1);

namespace Tests\Domain\Catalog;

use App\Domain\Catalog\Entity\Rarity;
use App\Shared\Enum\RarityColor;
use Tests\TestCase;

final class RarityTest extends TestCase
{
    public function testRaridadeGuardaACorDoMaterial(): void
    {
        $rara = Rarity::with(32, 1, 'rare', 'Rara', true, 3, RarityColor::GOLD);

        $this->assertSame(RarityColor::GOLD, $rara->color);
    }

    public function testRaridadeSemCorEscolhidaEGrafite(): void
    {
        // Grafite é o selo neutro de hoje: raridade que ninguém pintou continua
        // com a mesma cara de antes da paleta existir.
        $comum = Rarity::with(30, 1, 'common', 'Comum', true, 1);

        $this->assertSame(RarityColor::GRAPHITE, $comum->color);
    }
}
