<?php

declare(strict_types=1);

namespace Tests\Shared\Enum;

use App\Shared\Enum\RarityColor;
use Tests\TestCase;

/**
 * A paleta de cores de raridade: dez materiais, e só eles.
 *
 * É uma allowlist, não um hexadecimal livre: cada chave corresponde a um par
 * de fundo e tinta medido nos dois temas (`docs/design.md` §3). Um hexadecimal
 * que passa no claro reprovaria no escuro, e quem escolhe não teria como saber.
 */
final class RarityColorTest extends TestCase
{
    public function testSaoDezMateriaisNaOrdemDaPaleta(): void
    {
        $this->assertSame(
            ['graphite', 'silver', 'copper', 'gold', 'olivine', 'patina', 'aquamarine', 'tourmaline', 'rose-quartz', 'obsidian'],
            array_map(static fn(RarityColor $c): string => $c->value, RarityColor::cases())
        );
    }

    public function testChaveDaPaletaViraCor(): void
    {
        $this->assertSame(RarityColor::GOLD, RarityColor::tryFrom('gold'));
        $this->assertSame(RarityColor::ROSE_QUARTZ, RarityColor::tryFrom('rose-quartz'));
    }

    public function testQualquerOutraCoisaNaoVira(): void
    {
        $this->assertNull(RarityColor::tryFrom('#ffd700'));
        $this->assertNull(RarityColor::tryFrom('GOLD'));
        $this->assertNull(RarityColor::tryFrom(''));
    }

    public function testOPadraoEOGrafiteONeutroDeHoje(): void
    {
        $this->assertSame(RarityColor::GRAPHITE, RarityColor::DEFAULT);
    }
}
