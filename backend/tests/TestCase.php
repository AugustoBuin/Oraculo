<?php

declare(strict_types=1);

namespace Tests;

/**
 * Base dos testes do Oráculo.
 *
 * Substitui o PHPUnit, que traria Composer e um diretório vendor/ junto
 * (docs/decisions/ADR-004). Oferece só as asserções que os testes deste
 * projeto realmente usam — asserção que ninguém chama é código morto.
 *
 * Toda falha lança AssertionFailed, que o runner captura com arquivo e linha.
 */
abstract class TestCase
{
    public function assertSame(mixed $expected, mixed $actual, string $message = ''): void
    {
        if ($expected !== $actual) {
            throw new AssertionFailed(
                $message !== '' ? $message : 'Esperava identidade estrita.',
                $expected,
                $actual
            );
        }
    }

    public function assertEquals(mixed $expected, mixed $actual, string $message = ''): void
    {
        if ($expected != $actual) {
            throw new AssertionFailed(
                $message !== '' ? $message : 'Esperava igualdade.',
                $expected,
                $actual
            );
        }
    }

    public function assertTrue(mixed $actual, string $message = ''): void
    {
        $this->assertSame(true, $actual, $message !== '' ? $message : 'Esperava true.');
    }

    public function assertFalse(mixed $actual, string $message = ''): void
    {
        $this->assertSame(false, $actual, $message !== '' ? $message : 'Esperava false.');
    }

    public function assertNull(mixed $actual, string $message = ''): void
    {
        $this->assertSame(null, $actual, $message !== '' ? $message : 'Esperava null.');
    }

    public function assertNotNull(mixed $actual, string $message = ''): void
    {
        if ($actual === null) {
            throw new AssertionFailed(
                $message !== '' ? $message : 'Esperava valor não nulo.',
                'não nulo',
                null
            );
        }
    }

    public function assertCount(int $expected, array $actual, string $message = ''): void
    {
        $this->assertSame(
            $expected,
            count($actual),
            $message !== '' ? $message : 'Quantidade de itens diferente da esperada.'
        );
    }

    public function assertContains(mixed $needle, array $haystack, string $message = ''): void
    {
        if (!in_array($needle, $haystack, true)) {
            throw new AssertionFailed(
                $message !== '' ? $message : 'Valor ausente na lista.',
                $needle,
                $haystack
            );
        }
    }

    /**
     * Verifica que a chamada lança a exceção esperada, e devolve a exceção para
     * que o teste possa inspecionar a mensagem ou o status.
     *
     * @param class-string<\Throwable> $expectedClass
     */
    public function assertThrows(string $expectedClass, callable $callable): \Throwable
    {
        try {
            $callable();
        } catch (\Throwable $thrown) {
            if ($thrown instanceof $expectedClass) {
                return $thrown;
            }

            throw new AssertionFailed(
                'Lançou exceção de tipo diferente do esperado.',
                $expectedClass,
                get_class($thrown) . ': ' . $thrown->getMessage()
            );
        }

        throw new AssertionFailed('Esperava exceção, mas nada foi lançado.', $expectedClass, 'nenhuma');
    }

    public function fail(string $message): never
    {
        throw new AssertionFailed($message, null, null);
    }
}
