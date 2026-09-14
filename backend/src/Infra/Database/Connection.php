<?php

declare(strict_types=1);

namespace App\Infra\Database;

use App\Shared\Config\Env;

/**
 * A conexão PDO da aplicação.
 *
 * O handle é único por requisição, e isso **não** é o singleton proibido pelo
 * PADROES.md §3.2: o estado mora no servidor de banco, não aqui. O proibido é o
 * singleton que guarda estado de aplicação — buffer, cursor, cache em memória.
 * Em PHP uma requisição é um processo, então nada disto sobrevive a ela.
 */
final class Connection
{
    private static ?\PDO $pdo = null;

    public static function shared(): \PDO
    {
        return self::$pdo ??= new \PDO(
            self::dsn(
                host: Env::required('DB_HOST'),
                port: Env::requiredInt('DB_PORT'),
                database: Env::required('DB_NAME'),
            ),
            Env::required('DB_USER'),
            Env::required('DB_PASS'),
            self::options(),
        );
    }

    /**
     * O charset vai no DSN, e não só no banco.
     *
     * utf8mb4 no servidor não basta: sem o charset na conexão, o cliente
     * negocia latin1 e a acentuação de nome de carta chega truncada.
     */
    public static function dsn(string $host, int $port, string $database): string
    {
        return "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
    }

    /**
     * As quatro opções obrigatórias (PADROES.md §7.2). Nenhuma é preferência —
     * cada uma remove uma classe inteira de defeito.
     *
     * @return array<int,mixed>
     */
    public static function options(): array
    {
        return [
            // Sem isto, um INSERT que falha devolve false em silêncio e o
            // código segue como se tivesse gravado.
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,

            // Com emulação ligada, o driver interpola os valores no cliente:
            // o prepared statement deixa de ser a proteção que se supõe que é.
            \PDO::ATTR_EMULATE_PREPARES => false,

            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,

            // Com stringify ligado, um INT volta como string e toda comparação
            // estrita do domínio passa a falhar silenciosamente.
            \PDO::ATTR_STRINGIFY_FETCHES => false,
        ];
    }
}
