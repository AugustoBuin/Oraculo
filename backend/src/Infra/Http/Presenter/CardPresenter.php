<?php

declare(strict_types=1);

namespace App\Infra\Http\Presenter;

use App\Domain\Card\Entity\Card;
use App\Shared\Enum\ImageType;

/**
 * A forma pública de uma carta.
 *
 * Duas coisas que este apresentador garante e que valem a leitura:
 *
 * - **O cliente nunca vê o par (image_type, image_reference).** Recebe uma
 *   `imageUrl` pronta para usar: a rota de mídia quando o arquivo foi enviado,
 *   a própria URL quando é remota, `null` quando não há imagem. Como a origem
 *   da imagem é armazenamento, e não contrato, trocar o destino dos uploads
 *   amanhã não muda uma linha do frontend.
 *
 * - **Nenhum id de catálogo escapa.** Jogo, edição e raridade saem com o
 *   identificador público — slug ou código —, na mesma forma `{id, name}` dos
 *   endpoints de catálogo. O frontend usa a mesma chave para exibir a carta e
 *   para preencher o `<select>` do formulário.
 */
final class CardPresenter
{
    private const MEDIA_PATH = '/api/media/';

    /** @return array<string,mixed> */
    public static function toArray(Card $card): array
    {
        return [
            'id' => $card->id,
            'nameEn' => $card->nameEn,
            'namePt' => $card->namePt,
            'game' => ['id' => $card->game->slug, 'name' => $card->game->name],
            'edition' => ['id' => $card->edition->code, 'name' => $card->edition->name],
            'rarity' => ['id' => $card->rarity->code, 'name' => $card->rarity->name],
            'imageUrl' => self::imageUrl($card),
            'createdAt' => $card->createdAt->format(DATE_ATOM),
            'updatedAt' => $card->updatedAt?->format(DATE_ATOM),
        ];
    }

    /**
     * @param list<Card> $cards
     * @return list<array<string,mixed>>
     */
    public static function collection(array $cards): array
    {
        return array_map(self::toArray(...), $cards);
    }

    private static function imageUrl(Card $card): ?string
    {
        if ($card->image === null) {
            return null;
        }

        return match ($card->image->type) {
            ImageType::UPLOAD => self::MEDIA_PATH . $card->image->reference,
            ImageType::REMOTE => $card->image->reference,
        };
    }
}
