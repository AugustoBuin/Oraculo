<?php

declare(strict_types=1);

namespace Tests;

/**
 * Verifica o próprio runner.
 *
 * Sem isto, um bug nas asserções faria toda a suíte passar em silêncio — e uma
 * suíte que não sabe falhar é pior que suíte nenhuma, porque dá confiança falsa.
 */
final class RunnerTest extends TestCase
{
    public function testAceitaAsercoesDeIgualdadeQuandoOsValoresBatem(): void
    {
        $this->assertSame('mythic', 'mythic');
        $this->assertEquals(4, '4');
        $this->assertTrue(true);
        $this->assertFalse(false);
        $this->assertNull(null);
        $this->assertNotNull(0);
        $this->assertCount(3, ['dom', 'war', 'eld']);
        $this->assertContains('dom', ['dom', 'war']);
    }

    public function testRecusaIdentidadeQuandoOsTiposDiferem(): void
    {
        // assertEquals aceita 4 == '4'; assertSame não pode aceitar.
        $failure = $this->assertThrows(
            AssertionFailed::class,
            fn() => $this->assertSame(4, '4')
        );

        $this->assertSame(4, $failure->expected);
        $this->assertSame('4', $failure->actual);
    }

    public function testDevolveAExcecaoLancadaParaInspecao(): void
    {
        $thrown = $this->assertThrows(
            \InvalidArgumentException::class,
            fn() => throw new \InvalidArgumentException('A edicao nao pertence ao jogo.')
        );

        $this->assertSame('A edicao nao pertence ao jogo.', $thrown->getMessage());
    }

    public function testFalhaQuandoNenhumaExcecaoEhLancada(): void
    {
        $this->assertThrows(
            AssertionFailed::class,
            fn() => $this->assertThrows(\RuntimeException::class, fn() => null)
        );
    }

    public function testFalhaQuandoOTipoLancadoEhOutro(): void
    {
        $this->assertThrows(
            AssertionFailed::class,
            fn() => $this->assertThrows(
                \InvalidArgumentException::class,
                fn() => throw new \RuntimeException('outra coisa')
            )
        );
    }

    public function testDescreveValoresDeFormaLegivel(): void
    {
        $this->assertSame('null', AssertionFailed::describe(null));
        $this->assertSame('true', AssertionFailed::describe(true));
        $this->assertSame('"dom"', AssertionFailed::describe('dom'));
        $this->assertSame('7', AssertionFailed::describe(7));
    }
}
