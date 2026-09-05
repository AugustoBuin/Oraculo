<?php

declare(strict_types=1);

namespace Tests\UseCases\Catalog;

use App\Domain\Errors\NotFoundError;
use App\UseCases\Catalog\ListEditionsUseCase;
use App\UseCases\Catalog\ListGamesUseCase;
use App\UseCases\Catalog\ListRaritiesUseCase;
use Tests\Doubles\InMemoryEditionGateway;
use Tests\Doubles\InMemoryGameGateway;
use Tests\Doubles\InMemoryRarityGateway;
use Tests\TestCase;

/**
 * As três leituras que movem a cascata Jogo -> Edição -> Raridade.
 */
final class ListCatalogUseCasesTest extends TestCase
{
    private InMemoryGameGateway $games;
    private InMemoryEditionGateway $editions;
    private InMemoryRarityGateway $rarities;

    private function makeGames(): ListGamesUseCase
    {
        $this->games = InMemoryGameGateway::seeded();

        return ListGamesUseCase::create($this->games);
    }

    private function makeEditions(): ListEditionsUseCase
    {
        $this->games = InMemoryGameGateway::seeded();
        $this->editions = InMemoryEditionGateway::seeded();

        return ListEditionsUseCase::create($this->games, $this->editions);
    }

    private function makeRarities(): ListRaritiesUseCase
    {
        $this->games = InMemoryGameGateway::seeded();
        $this->rarities = InMemoryRarityGateway::seeded();

        return ListRaritiesUseCase::create($this->games, $this->rarities);
    }

    // --- jogos ----------------------------------------------------------------

    public function testListaApenasJogosAtivos(): void
    {
        $jogos = $this->makeGames()->execute();

        $this->assertCount(2, $jogos);
        $this->assertSame('magic', $jogos[0]->slug);
        $this->assertSame('pokemon', $jogos[1]->slug);
    }

    public function testOrdenaJogosPelaOrdemDeExibicao(): void
    {
        $sut = $this->makeGames();
        $this->games->games = array_reverse($this->games->games);

        $jogos = $sut->execute();

        $this->assertSame('magic', $jogos[0]->slug);
    }

    // --- edições --------------------------------------------------------------

    public function testListaAsEdicoesAtivasDoJogo(): void
    {
        $edicoes = $this->makeEditions()->execute('magic');

        $this->assertCount(2, $edicoes);
        $this->assertSame('dom', $edicoes[0]->code);
        $this->assertSame('war', $edicoes[1]->code);
    }

    public function testNaoVazaEdicaoDeOutroJogoComOMesmoCodigo(): void
    {
        // O código "dom" existe nos dois jogos do dublê. Se a busca ignorasse o
        // jogo, a edição errada entraria na lista — e a validação de "a edição
        // pertence ao jogo" passaria por acidente.
        $edicoes = $this->makeEditions()->execute('pokemon');

        foreach ($edicoes as $edicao) {
            $this->assertSame(2, $edicao->gameId);
        }
    }

    public function testJogoInexistenteNaoDevolveListaVazia(): void
    {
        // Lista vazia diria ao usuário "este jogo não tem edições" — que é uma
        // informação diferente, e falsa.
        $sut = $this->makeEditions();

        $this->assertThrows(NotFoundError::class, fn() => $sut->execute('inexistente'));
    }

    public function testJogoInativoRespondeComoInexistente(): void
    {
        $sut = $this->makeEditions();

        $this->assertThrows(NotFoundError::class, fn() => $sut->execute('lorcana'));
    }

    public function testJogoSemEdicoesDevolveListaVazia(): void
    {
        $sut = $this->makeEditions();
        $this->editions->editions = [];

        $this->assertCount(0, $sut->execute('magic'));
    }

    // --- raridades ------------------------------------------------------------

    public function testListaRaridadesNaOrdemNaturalDoJogo(): void
    {
        $raridades = $this->makeRarities()->execute('magic');

        // Comum, Rara, Mítica — e não a ordem alfabética, que produziria
        // Comum, Mítica, Rara.
        $this->assertSame(
            ['Comum', 'Rara', 'Mítica'],
            array_map(static fn($rarity): string => $rarity->name, $raridades)
        );
    }

    public function testNaoVazaRaridadeDeOutroJogo(): void
    {
        $raridades = $this->makeRarities()->execute('pokemon');

        $this->assertCount(1, $raridades);
        $this->assertSame('rare-holo', $raridades[0]->code);
    }

    public function testRaridadeDeJogoInexistenteFalha(): void
    {
        $sut = $this->makeRarities();

        $this->assertThrows(NotFoundError::class, fn() => $sut->execute('inexistente'));
    }
}
