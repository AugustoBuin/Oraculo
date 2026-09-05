<?php

declare(strict_types=1);

namespace Tests\Infra\Database;

use App\Infra\Database\Migrator;
use Tests\TestCase;

/**
 * A parte pura do migrador: decidir o que falta aplicar.
 *
 * O que toca banco é verificado pelo roteiro de integração (ADR-004); a regra
 * de ordenação e de idempotência é lógica pura e fica coberta aqui, porque é
 * onde o erro seria caro e silencioso.
 */
final class MigratorTest extends TestCase
{
    public function testDevolveTudoQuandoNadaFoiAplicado(): void
    {
        $pendentes = Migrator::pending(
            available: ['0001_a.sql', '0002_b.sql'],
            applied: []
        );

        $this->assertSame(['0001_a.sql', '0002_b.sql'], $pendentes);
    }

    public function testOmiteOQueJaFoiAplicado(): void
    {
        $pendentes = Migrator::pending(
            available: ['0001_a.sql', '0002_b.sql', '0003_c.sql'],
            applied: ['0001_a.sql', '0002_b.sql']
        );

        $this->assertSame(['0003_c.sql'], $pendentes);
    }

    public function testNaoDevolveNadaQuandoTudoJaFoiAplicado(): void
    {
        // É isto que torna o migrador idempotente: ele roda a cada boot do
        // contêiner, e rodar duas vezes não pode produzir efeito nem erro.
        $pendentes = Migrator::pending(
            available: ['0001_a.sql', '0002_b.sql'],
            applied: ['0001_a.sql', '0002_b.sql']
        );

        $this->assertCount(0, $pendentes);
    }

    public function testAplicaEmOrdemDeVersaoIndependenteDaOrdemDeEntrada(): void
    {
        // O sistema de arquivos não garante ordem. Aplicar 0008 antes de 0002
        // quebraria a chave estrangeira de cards para users.
        $pendentes = Migrator::pending(
            available: ['0003_c.sql', '0001_a.sql', '0002_b.sql'],
            applied: []
        );

        $this->assertSame(['0001_a.sql', '0002_b.sql', '0003_c.sql'], $pendentes);
    }

    public function testOrdenaPorNumeroENaoPorTexto(): void
    {
        // Ordenação de texto colocaria 0010 antes de 0002. Com prefixo de
        // quatro dígitos isso não acontece, mas depender do zero à esquerda
        // é o tipo de suposição que quebra na migration de número 100.
        $pendentes = Migrator::pending(
            available: ['0010_j.sql', '0002_b.sql'],
            applied: []
        );

        $this->assertSame(['0002_b.sql', '0010_j.sql'], $pendentes);
    }

    public function testIgnoraArquivoQueNaoSejaMigration(): void
    {
        $pendentes = Migrator::pending(
            available: ['0001_a.sql', 'README.md', '.gitkeep', 'rascunho.sql.bak'],
            applied: []
        );

        $this->assertSame(['0001_a.sql'], $pendentes);
    }

    public function testIgnoraArquivoSemPrefixoDeVersao(): void
    {
        $pendentes = Migrator::pending(
            available: ['0001_a.sql', 'ajuste_manual.sql'],
            applied: []
        );

        $this->assertSame(['0001_a.sql'], $pendentes);
    }
}
