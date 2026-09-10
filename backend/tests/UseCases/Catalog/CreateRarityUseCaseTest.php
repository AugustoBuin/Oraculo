<?php

declare(strict_types=1);

namespace Tests\UseCases\Catalog;

use App\Domain\Errors\ConflictError;
use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\ValidationError;
use App\Shared\Enum\RarityColor;
use App\UseCases\Catalog\CreateRarityInput;
use App\UseCases\Catalog\CreateRarityUseCase;
use Tests\Doubles\InMemoryGameGateway;
use Tests\Doubles\InMemoryRarityGateway;
use Tests\Doubles\SpyLogger;
use Tests\TestCase;

/**
 * Criar raridade, agora com cor: o que separou a escrita dela da de edição.
 */
final class CreateRarityUseCaseTest extends TestCase
{
    private InMemoryRarityGateway $rarities;

    private function make(): CreateRarityUseCase
    {
        $this->rarities = InMemoryRarityGateway::seeded();

        return CreateRarityUseCase::create(InMemoryGameGateway::seeded(), $this->rarities, new SpyLogger());
    }

    public function testCriaARaridadeComACorEscolhida(): void
    {
        $sut = $this->make();

        $id = $sut->execute(new CreateRarityInput('magic', ' Epic ', ' Épica ', 5, 'tourmaline'));

        $criada = $this->rarities->findById($id);
        $this->assertSame('epic', $criada->code);
        $this->assertSame('Épica', $criada->name);
        $this->assertSame(5, $criada->sortOrder);
        $this->assertSame(RarityColor::TOURMALINE, $criada->color);
        $this->assertTrue($criada->active);
    }

    public function testSemCorEscolhidaARaridadeNasceGrafite(): void
    {
        $sut = $this->make();

        $id = $sut->execute(new CreateRarityInput('magic', 'epic', 'Épica'));

        $this->assertSame(RarityColor::GRAPHITE, $this->rarities->findById($id)->color);
    }

    public function testCorForaDaPaletaERecusadaSemGravar(): void
    {
        $sut = $this->make();
        $antes = count($this->rarities->rarities);

        $error = $this->assertThrows(
            ValidationError::class,
            fn() => $sut->execute(new CreateRarityInput('magic', 'epic', 'Épica', 0, '#ffd700'))
        );

        $this->assertSame(['color'], array_keys($error->fieldErrors()));
        $this->assertCount($antes, $this->rarities->rarities);
    }

    public function testCodigoNomeECorInvalidosVoltamJuntos(): void
    {
        $sut = $this->make();

        $error = $this->assertThrows(
            ValidationError::class,
            fn() => $sut->execute(new CreateRarityInput('magic', 'x y', '', 0, 'dourado'))
        );

        $this->assertSame(['code', 'name', 'color'], array_keys($error->fieldErrors()));
    }

    public function testCodigoRepetidoNoMesmoJogoEConflito(): void
    {
        $sut = $this->make();

        $this->assertThrows(ConflictError::class, fn() => $sut->execute(new CreateRarityInput('magic', 'rare', 'Outra')));
    }

    public function testJogoInexistenteENaoEncontrado(): void
    {
        $sut = $this->make();

        $this->assertThrows(NotFoundError::class, fn() => $sut->execute(new CreateRarityInput('inexistente', 'x', 'X')));
    }
}
