<?php

declare(strict_types=1);

namespace Tests\Infra\Database;

use App\Infra\Database\Connection;
use Tests\TestCase;

/**
 * A configuração da conexão, verificada sem abrir conexão.
 *
 * As quatro opções de PDO abaixo não são preferência: cada uma remove uma
 * classe inteira de defeito (PADROES.md §7.2).
 */
final class ConnectionTest extends TestCase
{
    public function testMontaODsnComCharsetUtfMb4(): void
    {
        $dsn = Connection::dsn(host: 'db', port: 3306, database: 'oraculo');

        $this->assertSame('mysql:host=db;port=3306;dbname=oraculo;charset=utf8mb4', $dsn);
    }

    public function testDeclaraCharsetNaConexaoENaoApenasNoBanco(): void
    {
        // utf8mb4 no servidor não basta: sem o charset na conexão, o cliente
        // negocia latin1 e a acentuação de nome de carta chega truncada.
        $this->assertTrue(str_contains(Connection::dsn('db', 3306, 'oraculo'), 'charset=utf8mb4'));
    }

    public function testExigeExcecaoEmErroDeBanco(): void
    {
        // Sem ERRMODE_EXCEPTION, um INSERT que falha devolve false em silêncio
        // e o código segue como se tivesse gravado.
        $this->assertSame(
            \PDO::ERRMODE_EXCEPTION,
            Connection::options()[\PDO::ATTR_ERRMODE]
        );
    }

    public function testDesligaAEmulacaoDePreparedStatement(): void
    {
        // Com emulação ligada, o driver interpola os valores no cliente e o
        // prepared statement deixa de ser a proteção que se supõe que é.
        $this->assertFalse(Connection::options()[\PDO::ATTR_EMULATE_PREPARES]);
    }

    public function testDevolveLinhasAssociativas(): void
    {
        $this->assertSame(
            \PDO::FETCH_ASSOC,
            Connection::options()[\PDO::ATTR_DEFAULT_FETCH_MODE]
        );
    }

    public function testNaoConverteNumeroEmTexto(): void
    {
        // Com STRINGIFY_FETCHES ligado, um INT volta como string e toda
        // comparação estrita do domínio passa a falhar silenciosamente.
        $this->assertFalse(Connection::options()[\PDO::ATTR_STRINGIFY_FETCHES]);
    }
}
