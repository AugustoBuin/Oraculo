<?php

declare(strict_types=1);

namespace Tests\UseCases\Catalog;

use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\ValidationError;
use App\Shared\Enum\RarityColor;
use App\UseCases\Catalog\UpdateRarityInput;
use App\UseCases\Catalog\UpdateRarityUseCase;
use Tests\Doubles\InMemoryRarityGateway;
use Tests\Doubles\SpyLogger;
use Tests\TestCase;

/**
 * Alterar raridade. O `PUT` é substituição: a cor vai sempre junto, e cor
 * ausente é erro — nunca um grafite silencioso no lugar da cor que havia.
 */
final class UpdateRarityUseCaseTest extends TestCase
{
    private InMemoryRarityGateway $rarities;

    private function make(): UpdateRarityUseCase
    {
        $this->rarities = InMemoryRarityGateway::seeded();

        return UpdateRarityUseCase::create($this->rarities, new SpyLogger());
    }

    public function testTrocaNomeOrdemEstadoECorEMantemOCodigo(): void
    {
        $sut = $this->make();

        $sut->execute(new UpdateRarityInput(31, ' Mítica Rara ', 7, false, 'obsidian'));

        $alterada = $this->rarities->findById(31);
        $this->assertSame('Mítica Rara', $alterada->name);
        $this->assertSame(7, $alterada->sortOrder);
        $this->assertFalse($alterada->active);
        $this->assertSame(RarityColor::OBSIDIAN, $alterada->color);
        $this->assertSame('mythic', $alterada->code);
    }

    public function testSemCorERecusadoEmVezDeApagarACorQueHavia(): void
    {
        $sut = $this->make();

        $error = $this->assertThrows(ValidationError::class, fn() => $sut->execute(new UpdateRarityInput(31, 'Mítica', 4, true, null)));

        $this->assertSame(['color'], array_keys($error->fieldErrors()));
        $this->assertSame(RarityColor::COPPER, $this->rarities->findById(31)->color);
    }

    public function testNomeEmBrancoECorForaDaPaletaVoltamJuntos(): void
    {
        $sut = $this->make();

        $error = $this->assertThrows(ValidationError::class, fn() => $sut->execute(new UpdateRarityInput(31, ' ', 4, true, 'laranja')));

        $this->assertSame(['name', 'color'], array_keys($error->fieldErrors()));
        $this->assertSame('Mítica', $this->rarities->findById(31)->name);
    }

    public function testItemInexistenteENaoEncontrado(): void
    {
        $sut = $this->make();

        $error = $this->assertThrows(NotFoundError::class, fn() => $sut->execute(new UpdateRarityInput(999, 'X', 1, true, 'gold')));

        $this->assertSame('Raridade não encontrada.', $error->getMessage());
    }
}
