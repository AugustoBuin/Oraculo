<?php

declare(strict_types=1);

namespace Tests\Shared\Quality;

use Tests\TestCase;

/**
 * O seed não desfaz o que o ADMIN editou.
 *
 * O seed roda a cada boot (`docker/app/entrypoint.sh`), e as edições e
 * raridades que ele planta são editáveis pela interface. Um `ON DUPLICATE KEY
 * UPDATE` que reescreva nome, ordem, cor ou estado devolve o valor da massa a
 * cada `docker compose up` — sem erro, sem log, e só depois de alguém ter
 * confiado na edição.
 *
 * O teste lê o próprio `bin/seed.php`: o defeito mora no texto do SQL, e o
 * seed não tem banco de teste (ADR-004).
 */
final class SeedPreservesAdminEditsTest extends TestCase
{
    private const EDITABLE_COLUMNS = ['name', 'sort_order', 'color', 'active'];

    public function testSeedNaoReescreveEdicaoQueOAdminEditou(): void
    {
        $this->assertSame([], $this->rewrittenColumns('editions'));
    }

    public function testSeedNaoReescreveRaridadeQueOAdminEditou(): void
    {
        $this->assertSame([], $this->rewrittenColumns('rarities'));
    }

    /**
     * @return list<string> as colunas editáveis que o upsert da tabela reescreve
     */
    private function rewrittenColumns(string $table): array
    {
        $source = file_get_contents(__DIR__ . '/../../../bin/seed.php');
        $pattern = '/INSERT INTO ' . $table . '\b.*?ON DUPLICATE KEY UPDATE\s+([^\']*)\'/s';

        if (preg_match($pattern, $source, $match) !== 1) {
            $this->fail("o seed não tem mais o upsert de {$table}; reveja este teste");
        }

        $assigned = array_map(
            static fn (string $assignment): string => trim(explode('=', $assignment)[0]),
            explode(',', $match[1])
        );

        return array_values(array_intersect($assigned, self::EDITABLE_COLUMNS));
    }
}
