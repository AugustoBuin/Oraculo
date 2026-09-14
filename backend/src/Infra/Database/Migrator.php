<?php

declare(strict_types=1);

namespace App\Infra\Database;

use App\Shared\Observability\Logger;

/**
 * Aplica as migrations pendentes, em ordem, uma única vez cada.
 *
 * Roda no boot do contêiner a cada `docker compose up`, portanto **precisa ser
 * idempotente**: rodar duas vezes não pode produzir efeito nem erro
 * (PADROES.md §7.5 e §16.3).
 *
 * Migration já aplicada nunca é editada. Correção é sempre uma migration nova —
 * editar uma que já rodou deixa os ambientes divergentes em silêncio.
 */
final class Migrator
{
    /** Arquivo de migration: quatro dígitos, sublinhado, nome, .sql */
    private const FILENAME_PATTERN = '/^(\d{4})_[a-z0-9_]+\.sql$/';

    private const REGISTRY_TABLE = 'schema_migrations';

    public function __construct(
        private readonly \PDO $pdo,
        private readonly string $directory,
        private readonly Logger $logger,
    ) {
    }

    /**
     * @return list<string> as versões aplicadas nesta execução
     */
    public function run(): array
    {
        $this->ensureRegistry();

        $pending = self::pending($this->availableFiles(), $this->appliedVersions());
        $applied = [];

        foreach ($pending as $file) {
            $this->apply($file);
            $applied[] = $file;
            $this->logger->info('Migration aplicada', ['migration' => $file]);
        }

        return $applied;
    }

    /**
     * Quais migrations ainda faltam, em ordem de versão.
     *
     * Parte pura, separada do banco de propósito: é onde um erro seria caro e
     * silencioso — aplicar 0008 antes de 0002 quebraria a chave estrangeira de
     * cards para users, e o sistema de arquivos não garante ordem alguma.
     *
     * @param list<string> $available
     * @param list<string> $applied
     * @return list<string>
     */
    public static function pending(array $available, array $applied): array
    {
        $migrations = array_values(array_filter(
            $available,
            static fn(string $file): bool => preg_match(self::FILENAME_PATTERN, $file) === 1
        ));

        // Ordena pelo NÚMERO, não pelo texto: depender do zero à esquerda é o
        // tipo de suposição que quebra na migration de número 100.
        usort($migrations, static fn(string $a, string $b): int => self::version($a) <=> self::version($b));

        $done = array_flip($applied);

        return array_values(array_filter(
            $migrations,
            static fn(string $file): bool => !isset($done[$file])
        ));
    }

    private static function version(string $file): int
    {
        preg_match(self::FILENAME_PATTERN, $file, $matches);

        return (int) ($matches[1] ?? 0);
    }

    /**
     * O migrador precisa da tabela de registro para saber o que já rodou, e ela
     * é criada por uma migration. Criar aqui resolve o problema do ovo e da
     * galinha; a migration 0001 usa IF NOT EXISTS e vira um no-op.
     */
    private function ensureRegistry(): void
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS ' . self::REGISTRY_TABLE . ' ('
            . 'version VARCHAR(64) NOT NULL,'
            . 'applied_at DATETIME NOT NULL,'
            . 'PRIMARY KEY (version)'
            . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    /** @return list<string> */
    private function appliedVersions(): array
    {
        $statement = $this->pdo->query('SELECT version FROM ' . self::REGISTRY_TABLE);

        if ($statement === false) {
            return [];
        }

        /** @var list<string> */
        return $statement->fetchAll(\PDO::FETCH_COLUMN);
    }

    /** @return list<string> */
    private function availableFiles(): array
    {
        $entries = scandir($this->directory);

        return $entries === false ? [] : array_values(array_diff($entries, ['.', '..']));
    }

    private function apply(string $file): void
    {
        $sql = file_get_contents($this->directory . '/' . $file);

        if ($sql === false) {
            throw new \RuntimeException("Não foi possível ler a migration {$file}.");
        }

        // DDL em MySQL provoca commit implícito, então envolver em transação
        // daria falsa sensação de atomicidade. A proteção real é outra: todo
        // CREATE usa IF NOT EXISTS, de modo que uma execução interrompida no
        // meio pode ser repetida sem colidir com o que já foi criado.
        $this->pdo->exec($sql);

        $statement = $this->pdo->prepare(
            'INSERT INTO ' . self::REGISTRY_TABLE . ' (version, applied_at) VALUES (:version, :applied_at)'
        );

        $statement->execute([
            'version' => $file,
            'applied_at' => date('Y-m-d H:i:s'),
        ]);
    }
}
