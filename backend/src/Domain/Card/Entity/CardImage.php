<?php

declare(strict_types=1);

namespace App\Domain\Card\Entity;

use App\Shared\Enum\ImageType;

/**
 * A imagem de uma carta, como par (tipo, referência).
 *
 * `upload` guarda o nome de arquivo gerado pelo servidor; `remote` guarda a URL
 * http(s) já validada. O par é detalhe de armazenamento: o cliente nunca o vê,
 * recebe sempre uma `imageUrl` pronta para usar.
 *
 * Guardar o par em vez de só uma URL é o que permite servir o arquivo enviado
 * por rota — fora do document root, com o Content-Type do tipo que foi
 * verificado na gravação (docs/decisions/ADR-008).
 */
final class CardImage
{
    private function __construct(
        public readonly ImageType $type,
        public readonly string $reference,
    ) {
    }

    public static function uploaded(string $storedFileName): self
    {
        return new self(ImageType::UPLOAD, $storedFileName);
    }

    public static function remote(string $url): self
    {
        return new self(ImageType::REMOTE, $url);
    }

    /** Reconstrói a partir do banco. */
    public static function with(ImageType $type, string $reference): self
    {
        return new self($type, $reference);
    }
}
