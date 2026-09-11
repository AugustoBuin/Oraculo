<?php

declare(strict_types=1);

namespace Tests\UseCases\Catalog;

use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\ValidationError;
use App\UseCases\Catalog\UpdateEditionInput;
use App\UseCases\Catalog\UpdateEditionUseCase;
use Tests\Doubles\InMemoryEditionGateway;
use Tests\Doubles\SpyLogger;
use Tests\TestCase;

/**
 * Alterar edição: nome, ordem e estado. O código não está na entrada — é o
 * identificador público, e identificador público não muda.
 */
final class UpdateEditionUseCaseTest extends TestCase
{
    private InMemoryEditionGateway $editions;

    private function make(): UpdateEditionUseCase
    {
        $this->editions = InMemoryEditionGateway::seeded();

        return UpdateEditionUseCase::create($this->editions, new SpyLogger());
    }

    public function testTrocaNomeOrdemEEstadoEMantemOCodigo(): void
    {
        $sut = $this->make();

        $sut->execute(new UpdateEditionInput(10, ' Dominária ', 5, false));

        $alterada = $this->editions->findById(10);
        $this->assertSame('Dominária', $alterada->name);
        $this->assertSame(5, $alterada->sortOrder);
        $this->assertFalse($alterada->active);
        $this->assertSame('dom', $alterada->code);
    }

    public function testNomeEmBrancoERecusadoSemAlterar(): void
    {
        $sut = $this->make();

        $error = $this->assertThrows(ValidationError::class, fn() => $sut->execute(new UpdateEditionInput(10, '  ', 1, true)));

        $this->assertSame(['name'], array_keys($error->fieldErrors()));
        $this->assertSame('Dominaria', $this->editions->findById(10)->name);
    }

    public function testItemInexistenteENaoEncontrado(): void
    {
        $sut = $this->make();

        $this->assertThrows(NotFoundError::class, fn() => $sut->execute(new UpdateEditionInput(999, 'X', 1, true)));
    }
}
