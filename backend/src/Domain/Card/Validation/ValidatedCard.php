<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation;

use App\Domain\Card\Entity\CardImage;
use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Entity\Game;
use App\Domain\Catalog\Entity\Rarity;

/**
 * O rascunho depois de validado: identificadores já resolvidos para entidades.
 *
 * Que este objeto exista é a garantia estrutural do domínio — nenhum caso de uso
 * consegue gravar uma carta sem tê-lo em mãos, e ele só é construído pela
 * cadeia. A regra "a edição pertence ao jogo" deixa de ser uma checagem que
 * alguém pode esquecer e passa a ser condição de existência do tipo.
 */
final class ValidatedCard
{
    public function __construct(
        public readonly string $nameEn,
        public readonly ?string $namePt,
        public readonly Game $game,
        public readonly Edition $edition,
        public readonly Rarity $rarity,
        public readonly ?CardImage $image,
    ) {
    }
}
