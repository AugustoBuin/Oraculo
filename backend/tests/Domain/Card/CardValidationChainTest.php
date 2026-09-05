<?php

declare(strict_types=1);

namespace Tests\Domain\Card;

use App\Domain\Card\Validation\CardDraft;
use App\Domain\Card\Validation\CardValidationChain;
use App\Domain\Errors\ValidationError;
use App\Infra\Storage\RemoteUrlImageSource;
use App\Infra\Storage\UploadedFileImageSource;
use App\Shared\Enum\ImageType;
use Tests\Doubles\InMemoryEditionGateway;
use Tests\Doubles\InMemoryGameGateway;
use Tests\Doubles\InMemoryImageStorage;
use Tests\Doubles\InMemoryRarityGateway;
use Tests\TestCase;

/**
 * A cadeia de validação de carta (docs/decisions/ADR-005).
 *
 * Cada elo é testado isoladamente pelo comportamento que ele barra, e a cadeia
 * inteira pela ordem e pela acumulação de erros.
 */
final class CardValidationChainTest extends TestCase
{
    private InMemoryGameGateway $games;
    private InMemoryEditionGateway $editions;
    private InMemoryRarityGateway $rarities;

    private function makeSut(): CardValidationChain
    {
        $this->games = InMemoryGameGateway::seeded();
        $this->editions = InMemoryEditionGateway::seeded();
        $this->rarities = InMemoryRarityGateway::seeded();

        return CardValidationChain::default(
            games: $this->games,
            editions: $this->editions,
            rarities: $this->rarities,
            upload: new UploadedFileImageSource(new InMemoryImageStorage(), 3145728),
            remote: new RemoteUrlImageSource(),
        );
    }

    /** @param array<string,mixed>|null $image */
    private function draft(
        string $nameEn = 'Black Lotus',
        ?string $namePt = null,
        string $game = 'magic',
        string $edition = 'dom',
        string $rarity = 'mythic',
        ?array $image = null,
    ): CardDraft {
        return new CardDraft($nameEn, $namePt, $game, $edition, $rarity, $image);
    }

    // --- caminho feliz --------------------------------------------------------

    public function testResolveOsIdentificadoresPublicosParaEntidades(): void
    {
        $validada = $this->makeSut()->validate($this->draft());

        $this->assertSame('Black Lotus', $validada->nameEn);
        $this->assertSame(1, $validada->game->id);
        $this->assertSame('dom', $validada->edition->code);
        $this->assertSame('mythic', $validada->rarity->code);
        $this->assertNull($validada->image);
    }

    public function testAceitaCartaSemNomeEmPortugues(): void
    {
        // "Pode existir ou não", nas palavras do enunciado.
        $validada = $this->makeSut()->validate($this->draft(namePt: null));

        $this->assertNull($validada->namePt);
    }

    public function testTrataNomeEmPortuguesVazioComoAusente(): void
    {
        // Quem apaga o campo quer removê-lo, não gravar string vazia que
        // apareceria como nome em branco na listagem.
        $validada = $this->makeSut()->validate($this->draft(namePt: '   '));

        $this->assertNull($validada->namePt);
    }

    public function testRemoveEspacosDoNome(): void
    {
        $validada = $this->makeSut()->validate($this->draft(nameEn: '  Black Lotus  '));

        $this->assertSame('Black Lotus', $validada->nameEn);
    }

    // --- campos ---------------------------------------------------------------

    public function testRecusaNomeEmInglesVazio(): void
    {
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate($this->draft(nameEn: '   '))
        );

        $this->assertTrue(array_key_exists('nameEn', $erro->fieldErrors()));
    }

    public function testRecusaNomeAcimaDoLimite(): void
    {
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate($this->draft(nameEn: str_repeat('a', 151)))
        );

        $this->assertTrue(array_key_exists('nameEn', $erro->fieldErrors()));
    }

    // --- as duas regras de negócio que dão sentido à cadeia --------------------

    public function testRecusaEdicaoDeOutroJogo(): void
    {
        // "base1" é do Pokémon. Selecionado Magic, precisa ser recusada — RN-01.
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate($this->draft(game: 'magic', edition: 'base1'))
        );

        $this->assertTrue(array_key_exists('editionId', $erro->fieldErrors()));
    }

    public function testRecusaRaridadeDeOutroJogo(): void
    {
        // "rare-holo" é do Pokémon; "mythic" só existe em Magic. É este elo que
        // impede cadastrar carta de Magic como raridade de outro TCG — RN-02.
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate($this->draft(game: 'magic', rarity: 'rare-holo'))
        );

        $this->assertTrue(array_key_exists('rarityId', $erro->fieldErrors()));
    }

    public function testRecusaEdicaoDesativada(): void
    {
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate($this->draft(edition: 'antiga'))
        );

        $this->assertTrue(array_key_exists('editionId', $erro->fieldErrors()));
    }

    public function testRecusaJogoInexistente(): void
    {
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate($this->draft(game: 'inexistente'))
        );

        $this->assertTrue(array_key_exists('game', $erro->fieldErrors()));
    }

    public function testRecusaJogoInativo(): void
    {
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate($this->draft(game: 'lorcana'))
        );

        $this->assertTrue(array_key_exists('game', $erro->fieldErrors()));
    }

    // --- ordem e acumulação ---------------------------------------------------

    public function testInterrompeACadeiaQuandoOJogoNaoExiste(): void
    {
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate(
                $this->draft(game: 'inexistente', edition: 'qualquer', rarity: 'qualquer')
            )
        );

        // Sem o jogo, "a edição não pertence ao jogo" seria um erro derivado que
        // aponta para o campo errado. Só o problema real é reportado.
        $campos = $erro->fieldErrors();
        $this->assertTrue(array_key_exists('game', $campos));
        $this->assertFalse(array_key_exists('editionId', $campos));
        $this->assertFalse(array_key_exists('rarityId', $campos));
    }

    public function testAcumulaErrosDeCamposIndependentes(): void
    {
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate(
                $this->draft(nameEn: '', edition: 'base1', rarity: 'rare-holo')
            )
        );

        // Três problemas independentes precisam sair juntos: corrigir o
        // formulário de uma vez, em vez de descobrir um por tentativa.
        $campos = $erro->fieldErrors();
        $this->assertCount(3, $campos);
        $this->assertTrue(array_key_exists('nameEn', $campos));
        $this->assertTrue(array_key_exists('editionId', $campos));
        $this->assertTrue(array_key_exists('rarityId', $campos));
    }

    // --- imagem ---------------------------------------------------------------

    public function testAceitaImagemPorUrl(): void
    {
        $validada = $this->makeSut()->validate($this->draft(image: [
            'type' => 'remote',
            'reference' => 'https://cards.scryfall.io/normal/exemplo.jpg',
        ]));

        $this->assertSame(ImageType::REMOTE, $validada->image->type);
    }

    public function testRecusaUrlComEsquemaPerigoso(): void
    {
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate($this->draft(image: [
                'type' => 'remote',
                'reference' => 'javascript:alert(1)',
            ]))
        );

        $this->assertTrue(array_key_exists('image', $erro->fieldErrors()));
    }

    public function testRecusaTipoDeImagemDesconhecido(): void
    {
        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $this->makeSut()->validate($this->draft(image: [
                'type' => 'ftp',
                'reference' => 'ftp://exemplo.com/x.png',
            ]))
        );

        $this->assertTrue(array_key_exists('image', $erro->fieldErrors()));
    }
}
