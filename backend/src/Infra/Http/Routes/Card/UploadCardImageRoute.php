<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Card;

use App\Domain\Card\Service\ImageSource;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\HttpStatus;

/**
 * Recebe a imagem enviada e devolve a referência gravada.
 *
 * Endpoint SEPARADO do cadastro de carta, e isso é decisão de produto: permite
 * a pré-visualização imediata que a Decisão de UX nº 4 exige — o usuário
 * arrasta o arquivo e vê a carta antes de salvar — e mantém `POST /api/cards`
 * em JSON puro. Misturar multipart e JSON no mesmo endpoint produziria um
 * handler que precisa saber de dois formatos.
 */
final class UploadCardImageRoute implements Route
{
    private const FIELD = 'file';

    private function __construct(
        private readonly ImageSource $upload,
    ) {
    }

    public static function create(ImageSource $upload): self
    {
        return new self($upload);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::POST;
    }

    public function path(): string
    {
        return '/api/uploads/card-image';
    }

    public function handle(Request $request): Response
    {
        $image = $this->upload->resolve([
            'contents' => $request->uploadedFileContents(self::FIELD) ?? '',
        ]);

        return Response::json(HttpStatus::CREATED, [
            'data' => [
                'type' => $image->type->value,
                'reference' => $image->reference,
                // A URL já pronta, para a pré-visualização não precisar montá-la.
                'url' => '/api/media/' . $image->reference,
            ],
        ]);
    }
}
