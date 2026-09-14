<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Card;

use App\Domain\Card\Gateway\ImageStorage;
use App\Domain\Errors\NotFoundError;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;

/**
 * Entrega uma imagem enviada.
 *
 * Custa uma passagem pelo PHP e devolve três coisas em troca: o arquivo fica
 * **fora do document root** (não há caminho que o execute), o acesso respeita a
 * sessão, e o `Content-Type` sai do tipo que foi verificado na gravação — não
 * de um palpite baseado na extensão (docs/decisions/ADR-008).
 *
 * O nome do arquivo é o único ponto do sistema em que um valor da URL vira
 * caminho de disco, então ele é validado contra uma expressão estrita **antes**
 * de qualquer acesso — dentro do próprio LocalImageStorage.
 */
final class ServeCardImageRoute implements Route
{
    /** Nome gerado pelo servidor: 32 hexadecimais e uma extensão conhecida. */
    private const NAME_PATTERN = '/^[a-f0-9]{32}\.(jpg|png|webp|gif)$/';

    private const CONTENT_TYPES = [
        'jpg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
    ];

    private function __construct(
        private readonly ImageStorage $storage,
    ) {
    }

    public static function create(ImageStorage $storage): self
    {
        return new self($storage);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::GET;
    }

    public function path(): string
    {
        return '/api/media/{reference}';
    }

    public function handle(Request $request): Response
    {
        $reference = (string) $request->param('reference');

        if (preg_match(self::NAME_PATTERN, $reference, $matches) !== 1) {
            // Mesma resposta de "não existe": dizer que o nome é inválido
            // ensinaria ao curioso qual formato tentar em seguida.
            throw new NotFoundError('Imagem não encontrada.');
        }

        $contents = $this->storage->read($reference);

        if ($contents === null) {
            throw new NotFoundError('Imagem não encontrada.');
        }

        return Response::binary(
            contents: $contents,
            contentType: self::CONTENT_TYPES[$matches[1]],
            headers: [
                // O nome é aleatório e o arquivo nunca muda depois de gravado:
                // o próprio nome serve de ETag, e o cache pode ser longo.
                'Cache-Control' => 'private, max-age=31536000, immutable',
                'ETag' => '"' . $reference . '"',
                'Content-Length' => (string) strlen($contents),
            ]
        );
    }
}
