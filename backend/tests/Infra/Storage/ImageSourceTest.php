<?php

declare(strict_types=1);

namespace Tests\Infra\Storage;

use App\Domain\Errors\PayloadTooLargeError;
use App\Domain\Errors\UnsupportedMediaTypeError;
use App\Domain\Errors\ValidationError;
use App\Infra\Storage\RemoteUrlImageSource;
use App\Infra\Storage\UploadedFileImageSource;
use App\Shared\Enum\ImageType;
use Tests\Doubles\InMemoryImageStorage;
use Tests\TestCase;

/**
 * As duas implementações da Strategy de imagem (docs/decisions/ADR-008).
 */
final class ImageSourceTest extends TestCase
{
    private InMemoryImageStorage $storage;

    private function upload(int $maxBytes = 3145728): UploadedFileImageSource
    {
        $this->storage = new InMemoryImageStorage();

        return new UploadedFileImageSource($this->storage, $maxBytes);
    }

    /** PNG mínimo válido, com a assinatura que o finfo reconhece. */
    private function pngBytes(): string
    {
        return (string) base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );
    }

    private function gifBytes(): string
    {
        return (string) base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    }

    // --- URL remota -----------------------------------------------------------

    public function testAceitaUrlHttps(): void
    {
        $image = (new RemoteUrlImageSource())->resolve([
            'reference' => 'https://cards.scryfall.io/normal/front/0/7/exemplo.jpg',
        ]);

        $this->assertSame(ImageType::REMOTE, $image->type);
        $this->assertSame('https://cards.scryfall.io/normal/front/0/7/exemplo.jpg', $image->reference);
    }

    public function testAceitaUrlHttp(): void
    {
        $image = (new RemoteUrlImageSource())->resolve(['reference' => 'http://exemplo.com/carta.png']);

        $this->assertSame(ImageType::REMOTE, $image->type);
    }

    public function testRecusaEsquemasPerigosos(): void
    {
        $sut = new RemoteUrlImageSource();

        // javascript: num atributo src executa; data: embute conteúdo arbitrário
        // que foge da política de segurança da página; file: alcança o disco.
        foreach ([
            'javascript:alert(1)',
            'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
            'file:///etc/passwd',
            'vbscript:msgbox(1)',
        ] as $perigoso) {
            $this->assertThrows(
                ValidationError::class,
                fn() => $sut->resolve(['reference' => $perigoso]),
                'O esquema ' . $perigoso . ' precisa ser recusado.'
            );
        }
    }

    public function testRecusaUrlVaziaOuAusente(): void
    {
        $sut = new RemoteUrlImageSource();

        $this->assertThrows(ValidationError::class, fn() => $sut->resolve([]));
        $this->assertThrows(ValidationError::class, fn() => $sut->resolve(['reference' => '   ']));
    }

    public function testRecusaUrlSemEsquema(): void
    {
        $sut = new RemoteUrlImageSource();

        $this->assertThrows(
            ValidationError::class,
            fn() => $sut->resolve(['reference' => 'cards.scryfall.io/carta.jpg'])
        );
    }

    // --- upload ---------------------------------------------------------------

    public function testAceitaPngEGravaComNomeGeradoPeloServidor(): void
    {
        $sut = $this->upload();

        $image = $sut->resolve(['contents' => $this->pngBytes(), 'fileName' => 'foto do usuario.png']);

        $this->assertSame(ImageType::UPLOAD, $image->type);
        // 16 bytes em hexadecimal + ".png"
        $this->assertSame(36, strlen($image->reference));
        $this->assertTrue(str_ends_with($image->reference, '.png'));
        $this->assertTrue($this->storage->exists($image->reference));
    }

    public function testIgnoraCompletamenteONomeEnviadoPeloCliente(): void
    {
        $sut = $this->upload();

        // Nome com travessia de diretório e com HTML: nada disso pode
        // sobreviver, porque nada dele é usado.
        $image = $sut->resolve([
            'contents' => $this->gifBytes(),
            'fileName' => '../../../etc/passwd<script>alert(1)</script>.gif',
        ]);

        $this->assertFalse(str_contains($image->reference, '..'));
        $this->assertFalse(str_contains($image->reference, 'script'));
        $this->assertFalse(str_contains($image->reference, 'passwd'));
        $this->assertSame(1, preg_match('/^[a-f0-9]{32}\.gif$/', $image->reference));
    }

    public function testUsaAExtensaoDoTipoRealENaoADoNomeEnviado(): void
    {
        $sut = $this->upload();

        $image = $sut->resolve(['contents' => $this->pngBytes(), 'fileName' => 'carta.jpg']);

        // O conteúdo é PNG; a extensão gravada precisa ser .png, não .jpg.
        $this->assertTrue(str_ends_with($image->reference, '.png'));
    }

    public function testRecusaArquivoCujoConteudoNaoEhImagem(): void
    {
        $sut = $this->upload();

        // O arquivo que alguém de fato tentaria enviar: extensão de imagem,
        // conteúdo executável.
        $this->assertThrows(
            UnsupportedMediaTypeError::class,
            fn() => $sut->resolve([
                'contents' => '<?php system($_GET["c"]); ?>',
                'fileName' => 'inocente.jpg',
            ])
        );
    }

    public function testRecusaSvg(): void
    {
        $sut = $this->upload();

        // SVG é XML e carrega script. Fica fora da allowlist de propósito.
        $this->assertThrows(
            UnsupportedMediaTypeError::class,
            fn() => $sut->resolve([
                'contents' => '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
                'fileName' => 'vetor.svg',
            ])
        );
    }

    public function testRecusaArquivoAcimaDoLimite(): void
    {
        $sut = $this->upload(maxBytes: 100);

        $this->assertThrows(
            PayloadTooLargeError::class,
            fn() => $sut->resolve(['contents' => str_repeat('A', 101), 'fileName' => 'grande.png'])
        );
    }

    public function testNaoGravaNadaQuandoOArquivoEhRecusado(): void
    {
        $sut = $this->upload(maxBytes: 100);

        foreach ([
            ['contents' => str_repeat('A', 101)],
            ['contents' => '<?php echo 1; ?>'],
            ['contents' => ''],
        ] as $entrada) {
            try {
                $sut->resolve($entrada);
            } catch (\Throwable) {
                // esperado
            }
        }

        // O efeito que não pode acontecer: gravar primeiro e validar depois
        // deixaria lixo — e, no caso do PHP, um arquivo executável — em disco.
        $this->assertCount(0, $this->storage->files);
    }

    public function testRecusaEnvioVazio(): void
    {
        $sut = $this->upload();

        $this->assertThrows(ValidationError::class, fn() => $sut->resolve([]));
    }
}
