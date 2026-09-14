<?php

declare(strict_types=1);

namespace Tests\UseCases\Catalog;

use App\Domain\Errors\NotFoundError;
use App\UseCases\Catalog\DeactivateCatalogItemUseCase;
use Tests\Doubles\InMemoryEditionGateway;
use Tests\Doubles\SpyLogger;
use Tests\TestCase;

/**
 * Desativar nunca falha por estar em uso (RF-43): estar em uso é justamente a
 * situação para a qual a operação existe. Ela informa, e a tela avisa depois.
 */
final class DeactivateCatalogItemUseCaseTest extends TestCase
{
    private InMemoryEditionGateway $editions;

    private function make(): DeactivateCatalogItemUseCase
    {
        $this->editions = InMemoryEditionGateway::seeded();

        return DeactivateCatalogItemUseCase::create($this->editions, new SpyLogger());
    }

    public function testDesativaItemEmUsoEInformaQueEstavaEmUso(): void
    {
        $sut = $this->make();
        $this->editions->inUse = [10];

        $this->assertTrue($sut->execute(10));
        $this->assertFalse($this->editions->findById(10)->active);
    }

    public function testDesativaItemSemUsoEInformaQueNaoEstava(): void
    {
        $sut = $this->make();

        $this->assertFalse($sut->execute(11));
        $this->assertFalse($this->editions->findById(11)->active);
    }

    public function testItemInexistenteENaoEncontrado(): void
    {
        $sut = $this->make();

        $error = $this->assertThrows(NotFoundError::class, fn() => $sut->execute(999));

        $this->assertSame('Edição não encontrada.', $error->getMessage());
    }
}
