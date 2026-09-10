<?php

declare(strict_types=1);

namespace Tests\Domain\Catalog;

use App\Domain\Catalog\Validation\CatalogItemRules;
use Tests\TestCase;

/**
 * As regras que edição e raridade compartilham: o formato do código e o nome.
 *
 * Moram num lugar só porque as duas escritas se separaram (a raridade ganhou
 * cor) e as regras não: duplicá-las criaria dois lugares para corrigir o mesmo
 * defeito.
 */
final class CatalogItemRulesTest extends TestCase
{
    public function testNormalizaOCodigoParaMinusculasSemEspacosNasPontas(): void
    {
        $this->assertSame('sv3-a', CatalogItemRules::normalizeCode('  SV3-A '));
    }

    public function testCodigoENomeValidosNaoTemErro(): void
    {
        $this->assertSame([], CatalogItemRules::errors('sv3-a', 'Obsidian Flames'));
    }

    public function testCodigoComEspacoOuAcentoApontaOCampoCode(): void
    {
        $this->assertTrue(isset(CatalogItemRules::errors('dom war', 'Nome')['code']));
        $this->assertTrue(isset(CatalogItemRules::errors('edição', 'Nome')['code']));
    }

    public function testCodigoDeTrintaEDoisCaracteresPassaETrintaETresNao(): void
    {
        $this->assertSame([], CatalogItemRules::errors(str_repeat('a', 32), 'Nome'));
        $this->assertTrue(isset(CatalogItemRules::errors(str_repeat('a', 33), 'Nome')['code']));
    }

    public function testCodigoNaoComecaComHifen(): void
    {
        $this->assertTrue(isset(CatalogItemRules::errors('-dom', 'Nome')['code']));
    }

    public function testNomeEmBrancoApontaOCampoName(): void
    {
        $this->assertSame(['name'], array_keys(CatalogItemRules::nameErrors('')));
    }

    public function testOsDoisErrosVemJuntos(): void
    {
        $this->assertSame(['code', 'name'], array_keys(CatalogItemRules::errors('', '')));
    }
}
