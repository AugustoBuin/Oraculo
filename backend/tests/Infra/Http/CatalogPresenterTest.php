<?php

declare(strict_types=1);

namespace Tests\Infra\Http;

use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Entity\Rarity;
use App\Infra\Http\Presenter\CatalogPresenter;
use Tests\TestCase;

/**
 * A forma pública dos itens de catálogo.
 *
 * O apresentador está sob TDD estrito por um motivo específico (ADR-004): é
 * ele que garante que id interno e nome de coluna não vazam para a resposta.
 */
final class CatalogPresenterTest extends TestCase
{
    /** @return list<Edition> */
    private function editions(): array
    {
        return [
            Edition::with(10, 1, 'dom', 'Dominaria', true, 1),
            Edition::with(12, 1, 'antiga', 'Edição Desativada', false, 2),
        ];
    }

    public function testFormaPadraoEhAQuePublicadaPeloEnunciado(): void
    {
        // `{ "id": "dom", "name": "Dominaria" }` — e nada mais. É esta a forma
        // que a cascata consome, e ela não muda para quem não é ADMIN.
        $saida = CatalogPresenter::editions($this->editions());

        $this->assertSame(['id', 'name'], array_keys($saida[0]));
        $this->assertSame('dom', $saida[0]['id']);
    }

    public function testIdPublicoEhOCodigoNuncaOIdNumerico(): void
    {
        $saida = CatalogPresenter::editions($this->editions());

        // O id numérico é detalhe de armazenamento: expô-lo como `id` amarraria
        // o contrato público à ordem de inserção do seed.
        $this->assertSame('dom', $saida[0]['id']);
        // O runner autoral não tem assertNotSame; a comparação estrita basta.
        $this->assertTrue($saida[0]['id'] !== 10, 'o id numérico vazou como id público');
    }

    public function testListagemDeAdministracaoAcrescentaEstadoEReferencia(): void
    {
        $saida = CatalogPresenter::editions($this->editions(), true);

        // `active` para o ADMIN saber o que reativar.
        $this->assertTrue($saida[0]['active']);
        $this->assertFalse($saida[1]['active']);

        // `ref` porque as rotas de escrita são endereçadas pelo id numérico.
        // Sem ele, a tela de administração lista os itens e não consegue
        // apontar para nenhum: o `id` público é o código, e o PUT/DELETE
        // esperam o número.
        $this->assertSame(10, $saida[0]['ref']);
        $this->assertSame(12, $saida[1]['ref']);
    }

    public function testAcrescentaSemSubstituir(): void
    {
        // O campo a mais não pode custar a forma original: quem lê `id` e
        // `name` continua lendo a mesma coisa.
        $saida = CatalogPresenter::editions($this->editions(), true);

        $this->assertSame('dom', $saida[0]['id']);
        $this->assertSame('Dominaria', $saida[0]['name']);
    }

    public function testRaridadesSeguemAMesmaRegra(): void
    {
        $rarities = [Rarity::with(31, 1, 'mythic', 'Mítica', true, 4)];

        $this->assertSame(['id', 'name'], array_keys(CatalogPresenter::rarities($rarities)[0]));

        $comEstado = CatalogPresenter::rarities($rarities, true);
        $this->assertSame(31, $comEstado[0]['ref']);
        $this->assertTrue($comEstado[0]['active']);
    }
}
