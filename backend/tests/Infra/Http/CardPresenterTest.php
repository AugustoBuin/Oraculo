<?php

declare(strict_types=1);

namespace Tests\Infra\Http;

use App\Domain\Card\Entity\Card;
use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Entity\Game;
use App\Domain\Catalog\Entity\Rarity;
use App\Infra\Http\Presenter\CardPresenter;
use App\Shared\Enum\RarityColor;
use Tests\TestCase;

/**
 * A forma pública de uma carta. Sob TDD estrito pelo mesmo motivo do
 * CatalogPresenter (ADR-004): é aqui que id interno não pode vazar.
 */
final class CardPresenterTest extends TestCase
{
    private function card(): Card
    {
        return Card::with(
            12,
            'Black Lotus',
            null,
            Game::with(1, 'magic', 'Magic: The Gathering', true, 1),
            Edition::with(10, 1, 'dom', 'Dominaria', true, 1),
            Rarity::with(31, 1, 'mythic', 'Mítica', true, 4, RarityColor::COPPER),
            null,
            1,
            null,
            new \DateTimeImmutable('2026-09-04T12:00:00-03:00'),
            null,
            null,
        );
    }

    public function testCatalogosSaemPeloIdentificadorPublicoNuncaPeloNumero(): void
    {
        $saida = CardPresenter::toArray($this->card());

        $this->assertSame(['id' => 'magic', 'name' => 'Magic: The Gathering'], $saida['game']);
        $this->assertSame(['id' => 'dom', 'name' => 'Dominaria'], $saida['edition']);
        $this->assertSame('mythic', $saida['rarity']['id']);
    }

    public function testARaridadeLevaACorDoSelo(): void
    {
        $saida = CardPresenter::toArray($this->card());

        $this->assertSame(['id' => 'mythic', 'name' => 'Mítica', 'color' => 'copper'], $saida['rarity']);
    }
}
