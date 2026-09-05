<?php

declare(strict_types=1);

namespace Tests\Shared\Config;

use App\Shared\Config\Env;
use App\Shared\Config\EnvironmentError;
use Tests\TestCase;

/**
 * Configuração obrigatória em ponto único.
 *
 * A regra que estes testes protegem: se uma variável faltar, a aplicação falha
 * no boot nomeando a ausente. Um fallback literal ao lado da variável é um
 * segredo commitado com passo extra (PADROES.md §9.1).
 */
final class EnvTest extends TestCase
{
    private const KEY = 'ORACULO_TESTE_VARIAVEL';

    public function testDevolveOValorQuandoAVariavelExiste(): void
    {
        putenv(self::KEY . '=oraculo');

        $this->assertSame('oraculo', Env::required(self::KEY));

        putenv(self::KEY);
    }

    public function testFalhaNomeandoAVariavelAusente(): void
    {
        putenv(self::KEY);

        $error = $this->assertThrows(
            EnvironmentError::class,
            fn() => Env::required(self::KEY)
        );

        // A mensagem precisa dizer QUAL variável falta: "erro de configuração"
        // sem o nome obriga quem faz o deploy a adivinhar.
        $this->assertTrue(str_contains($error->getMessage(), self::KEY));
    }

    public function testTrataVariavelVaziaComoAusente(): void
    {
        putenv(self::KEY . '=');

        $this->assertThrows(EnvironmentError::class, fn() => Env::required(self::KEY));

        putenv(self::KEY);
    }

    public function testTrataVariavelComApenasEspacosComoAusente(): void
    {
        putenv(self::KEY . '=   ');

        $this->assertThrows(EnvironmentError::class, fn() => Env::required(self::KEY));

        putenv(self::KEY);
    }

    public function testConverteVariavelInteira(): void
    {
        putenv(self::KEY . '=43200');

        $this->assertSame(43200, Env::requiredInt(self::KEY));

        putenv(self::KEY);
    }

    public function testRecusaVariavelInteiraMalformada(): void
    {
        putenv(self::KEY . '=12 horas');

        $error = $this->assertThrows(
            EnvironmentError::class,
            fn() => Env::requiredInt(self::KEY)
        );

        $this->assertTrue(str_contains($error->getMessage(), self::KEY));

        putenv(self::KEY);
    }
}
