<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Card;

use App\Domain\Card\Validation\CardDraft;
use App\Infra\Http\Request;

/**
 * Monta o rascunho de carta a partir da requisição, **campo a campo**.
 *
 * Existe para que criação e edição leiam o corpo do mesmo jeito. Duas leituras
 * paralelas divergiriam no primeiro campo novo, e a edição passaria a aceitar
 * o que o cadastro recusa.
 *
 * A conversão para texto é tolerante de propósito: um corpo com
 * `{"nameEn": {"$ne": null}}` faria um cast direto lançar TypeError e virar 500,
 * quando a resposta correta é a recusa normal de validação.
 */
final class CardRequestReader
{
    public static function draft(Request $request): CardDraft
    {
        return new CardDraft(
            nameEn: self::text($request->body('nameEn')),
            namePt: self::nullableText($request->body('namePt')),
            gameSlug: self::text($request->body('game')),
            editionCode: self::text($request->body('edition')),
            rarityCode: self::text($request->body('rarity')),
            image: self::image($request->body('image')),
        );
    }

    public static function confirmDuplicate(Request $request): bool
    {
        return $request->body('confirmDuplicate') === true;
    }

    /** @return array<string,mixed>|null */
    private static function image(mixed $value): ?array
    {
        if (!is_array($value)) {
            return null;
        }

        // Só os dois campos que as estratégias consomem. O resto do que o
        // cliente mandar dentro de `image` é descartado aqui.
        return [
            'type' => is_string($value['type'] ?? null) ? $value['type'] : null,
            'reference' => is_string($value['reference'] ?? null) ? $value['reference'] : null,
        ];
    }

    private static function text(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }

    private static function nullableText(mixed $value): ?string
    {
        return is_string($value) ? $value : null;
    }
}
