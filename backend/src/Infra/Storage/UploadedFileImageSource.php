<?php

declare(strict_types=1);

namespace App\Infra\Storage;

use App\Domain\Card\Entity\CardImage;
use App\Domain\Card\Gateway\ImageStorage;
use App\Domain\Card\Service\ImageSource;
use App\Domain\Errors\PayloadTooLargeError;
use App\Domain\Errors\UnsupportedMediaTypeError;
use App\Domain\Errors\ValidationError;

/**
 * Imagem enviada como arquivo.
 *
 * O caminho padrão do formulário: arrastar o arquivo e ver a pré-visualização.
 * Pedir uma URL a alguém não técnico é transferir trabalho de engenharia para o
 * usuário — ele teria que hospedar o arquivo em algum lugar e saber extrair o
 * endereço (docs/decisions/ADR-008).
 *
 * Cinco regras de segurança, todas obrigatórias:
 *
 * 1. O tipo é apurado pelo **conteúdo** (finfo), nunca pela extensão. Extensão é
 *    dado do cliente, e dado do cliente mente.
 * 2. SVG fica **fora** da allowlist. SVG é XML e carrega script.
 * 3. O tamanho é verificado **antes** de gravar qualquer byte.
 * 4. O nome é gerado pelo servidor. O nome enviado é dado hostil, tanto ao
 *    gravar (travessia de diretório) quanto ao exibir (XSS).
 * 5. O destino fica fora do document root — garantido pelo ImageStorage.
 */
final class UploadedFileImageSource implements ImageSource
{
    /** Tipo real permitido => extensão que o servidor vai usar. */
    private const ALLOWED_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    private const NAME_BYTES = 16;

    public function __construct(
        private readonly ImageStorage $storage,
        private readonly int $maxBytes,
    ) {
    }

    public function resolve(array $input): CardImage
    {
        $contents = $input['contents'] ?? null;

        if (!is_string($contents) || $contents === '') {
            throw ValidationError::field('image', 'Nenhum arquivo foi enviado.');
        }

        // Antes de qualquer outra coisa: conteúdo grande demais não chega a ser
        // inspecionado nem gravado.
        if (strlen($contents) > $this->maxBytes) {
            throw new PayloadTooLargeError(
                'A imagem precisa ter no máximo ' . $this->humanLimit() . '.'
            );
        }

        $extension = self::ALLOWED_TYPES[$this->detectType($contents)] ?? null;

        if ($extension === null) {
            throw new UnsupportedMediaTypeError(
                'Formato não permitido. Envie uma imagem JPG, PNG, WebP ou GIF.'
            );
        }

        $fileName = bin2hex(random_bytes(self::NAME_BYTES)) . '.' . $extension;

        return CardImage::uploaded($this->storage->store($fileName, $contents));
    }

    /**
     * O tipo real, lido dos bytes iniciais do arquivo.
     *
     * Um `.jpg` cujo conteúdo é PHP é recusado aqui — e é exatamente o arquivo
     * que alguém tentaria enviar.
     */
    private function detectType(string $contents): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);

        if ($finfo === false) {
            throw new UnsupportedMediaTypeError('Não foi possível verificar o tipo do arquivo.');
        }

        $type = finfo_buffer($finfo, $contents);
        finfo_close($finfo);

        return $type === false ? '' : strtolower($type);
    }

    private function humanLimit(): string
    {
        return round($this->maxBytes / 1048576, 1) . ' MB';
    }
}
