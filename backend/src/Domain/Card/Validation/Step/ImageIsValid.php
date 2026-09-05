<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation\Step;

use App\Domain\Card\Service\ImageSource;
use App\Domain\Card\Validation\CardDraft;
use App\Domain\Card\Validation\CardValidation;
use App\Domain\Card\Validation\CardValidationStep;
use App\Domain\Errors\DomainError;
use App\Shared\Enum\ImageType;

/**
 * A imagem, quando informada.
 *
 * Aqui a Strategy é escolhida: `upload` e `remote` são duas implementações reais
 * do mesmo contrato, e este elo apenas despacha para a certa. É o `if` que
 * cresceria a cada origem nova, substituído por um mapa.
 *
 * Carta **sem** imagem é caso legítimo — a interface mostra um espaço reservado
 * legível (RF-34), nunca um ícone quebrado.
 */
final class ImageIsValid implements CardValidationStep
{
    /** @param array<string,ImageSource> $sources valor de ImageType => estratégia */
    public function __construct(
        private readonly array $sources,
    ) {
    }

    public function apply(CardDraft $draft, CardValidation $validation): void
    {
        if ($draft->image === null) {
            $validation->resolveImage(null);

            return;
        }

        $type = $draft->image['type'] ?? null;
        $source = is_string($type) ? ($this->sources[$type] ?? null) : null;

        if ($source === null) {
            $validation->addError('image', 'Escolha enviar um arquivo ou informar um endereço de imagem.');

            return;
        }

        try {
            $validation->resolveImage($source->resolve($draft->image));
        } catch (DomainError $error) {
            // A estratégia já produziu uma mensagem em português adequada ao
            // usuário; ela vira o erro do campo `image` no mapa da resposta.
            $validation->addError('image', $error->getMessage());
        }
    }

    /**
     * @param ImageSource $upload
     * @param ImageSource $remote
     */
    public static function with(ImageSource $upload, ImageSource $remote): self
    {
        return new self([
            ImageType::UPLOAD->value => $upload,
            ImageType::REMOTE->value => $remote,
        ]);
    }
}
