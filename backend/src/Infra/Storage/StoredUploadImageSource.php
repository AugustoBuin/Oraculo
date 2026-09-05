<?php

declare(strict_types=1);

namespace App\Infra\Storage;

use App\Domain\Card\Entity\CardImage;
use App\Domain\Card\Gateway\ImageStorage;
use App\Domain\Card\Service\ImageSource;
use App\Domain\Errors\ValidationError;

/**
 * Uma imagem que JÁ foi enviada, referenciada pelo nome gravado.
 *
 * Existe porque o upload acontece em dois momentos distintos, e conflatá-los
 * era um defeito real:
 *
 * 1. No endpoint de upload, o cliente manda **bytes**, e quem os transforma em
 *    arquivo é `UploadedFileImageSource`.
 * 2. Ao salvar a carta, o cliente manda a **referência** devolvida no passo 1.
 *    Não há bytes para inspecionar; o que se valida é que a referência existe.
 *
 * Separar em duas implementações do mesmo contrato é o que a Strategy permite
 * fazer sem um `if` sobre "veio conteúdo ou veio nome?" no meio da validação.
 *
 * A checagem de existência não é burocracia: sem ela, uma requisição montada à
 * mão gravaria uma carta apontando para um arquivo inexistente, e o erro só
 * apareceria na listagem, como imagem quebrada, muito depois.
 */
final class StoredUploadImageSource implements ImageSource
{
    public function __construct(
        private readonly ImageStorage $storage,
    ) {
    }

    public function resolve(array $input): CardImage
    {
        $reference = $input['reference'] ?? null;

        if (!is_string($reference) || $reference === '') {
            throw ValidationError::field('image', 'Envie o arquivo da imagem antes de salvar.');
        }

        // exists() valida o formato do nome antes de tocar o disco, então uma
        // referência forjada com caminho não chega ao sistema de arquivos.
        if (!$this->storage->exists($reference)) {
            throw ValidationError::field(
                'image',
                'A imagem enviada não foi encontrada. Envie o arquivo novamente.'
            );
        }

        return CardImage::uploaded($reference);
    }
}
