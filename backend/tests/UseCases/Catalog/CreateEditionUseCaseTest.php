<?php

declare(strict_types=1);

namespace Tests\UseCases\Catalog;

use App\Domain\Errors\ConflictError;
use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\ValidationError;
use App\UseCases\Catalog\CreateEditionInput;
use App\UseCases\Catalog\CreateEditionUseCase;
use Tests\Doubles\InMemoryEditionGateway;
use Tests\Doubles\InMemoryGameGateway;
use Tests\Doubles\SpyLogger;
use Tests\TestCase;

/**
 * Criar edição: é o que faz uma edição nova de Pokémon entrar em produção por
 * cadastro, e não por deploy.
 */
final class CreateEditionUseCaseTest extends TestCase
{
    private InMemoryEditionGateway $editions;

    private function make(): CreateEditionUseCase
    {
        $this->editions = InMemoryEditionGateway::seeded();

        return CreateEditionUseCase::create(InMemoryGameGateway::seeded(), $this->editions, new SpyLogger());
    }

    public function testCriaAEdicaoNoJogoEDevolveOId(): void
    {
        $sut = $this->make();

        $id = $sut->execute(new CreateEditionInput('magic', 'eld', 'Throne of Eldraine', 3));

        $criada = $this->editions->findById($id);
        $this->assertSame(1, $criada->gameId);
        $this->assertSame('eld', $criada->code);
        $this->assertSame('Throne of Eldraine', $criada->name);
        $this->assertSame(3, $criada->sortOrder);
        $this->assertTrue($criada->active);
    }

    public function testNormalizaCodigoENomeAntesDeGravar(): void
    {
        $sut = $this->make();

        $id = $sut->execute(new CreateEditionInput('magic', '  ELD ', '  Throne of Eldraine '));

        $this->assertSame('eld', $this->editions->findById($id)->code);
        $this->assertSame('Throne of Eldraine', $this->editions->findById($id)->name);
    }

    public function testCodigoForaDoPadraoENomeVazioVoltamJuntosSemGravar(): void
    {
        $sut = $this->make();
        $antes = count($this->editions->editions);

        $error = $this->assertThrows(
            ValidationError::class,
            fn() => $sut->execute(new CreateEditionInput('magic', 'dom war', '   '))
        );

        $this->assertSame(['code', 'name'], array_keys($error->fieldErrors()));
        $this->assertCount($antes, $this->editions->editions);
    }

    public function testCodigoRepetidoNoMesmoJogoEConflitoSemGravar(): void
    {
        $sut = $this->make();
        $antes = count($this->editions->editions);

        $this->assertThrows(ConflictError::class, fn() => $sut->execute(new CreateEditionInput('magic', 'dom', 'Outra')));

        $this->assertCount($antes, $this->editions->editions);
    }

    public function testMesmoCodigoEmOutroJogoEAceito(): void
    {
        $sut = $this->make();

        $id = $sut->execute(new CreateEditionInput('magic', 'base1', 'Homônima'));

        $this->assertSame(1, $this->editions->findById($id)->gameId);
    }

    public function testJogoInexistenteENaoEncontrado(): void
    {
        $sut = $this->make();

        $this->assertThrows(NotFoundError::class, fn() => $sut->execute(new CreateEditionInput('inexistente', 'x', 'X')));
    }
}
