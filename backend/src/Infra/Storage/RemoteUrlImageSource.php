<?php

declare(strict_types=1);

namespace App\Infra\Storage;

use App\Domain\Card\Entity\CardImage;
use App\Domain\Card\Service\ImageSource;
use App\Domain\Errors\ValidationError;

/**
 * Imagem informada por URL.
 *
 * A alternativa para quem já tem o link do CDN — o caso da própria LigaMagic,
 * cujas imagens de carta vivem em CDN próprio.
 *
 * A validação aqui é de **esquema**, e é o que impede que o campo vire um vetor:
 * `javascript:` num atributo `src` executa, e `data:` permite embutir conteúdo
 * arbitrário que foge da política de segurança da página.
 */
final class RemoteUrlImageSource implements ImageSource
{
    /** Apenas os dois esquemas que o navegador busca como imagem por rede. */
    private const ALLOWED_SCHEMES = ['http', 'https'];

    private const MAX_LENGTH = 2048;

    public function resolve(array $input): CardImage
    {
        $url = $input['reference'] ?? null;

        if (!is_string($url) || trim($url) === '') {
            throw ValidationError::field('image', 'Informe o endereço da imagem.');
        }

        $url = trim($url);

        if (mb_strlen($url) > self::MAX_LENGTH) {
            throw ValidationError::field('image', 'O endereço da imagem é longo demais.');
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);

        if (!is_string($scheme) || !in_array(strtolower($scheme), self::ALLOWED_SCHEMES, true)) {
            throw ValidationError::field(
                'image',
                'O endereço da imagem precisa começar com http:// ou https://.'
            );
        }

        // parse_url aceita coisas que não são URL utilizável; FILTER_VALIDATE_URL
        // fecha o resto.
        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            throw ValidationError::field('image', 'O endereço da imagem não é válido.');
        }

        return CardImage::remote($url);
    }
}
