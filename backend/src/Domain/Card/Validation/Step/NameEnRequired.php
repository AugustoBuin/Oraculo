<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation\Step;

use App\Domain\Card\Validation\CardDraft;
use App\Domain\Card\Validation\CardValidation;
use App\Domain\Card\Validation\CardValidationStep;

/**
 * Nome em inglês: obrigatório.
 *
 * É o único campo de texto que o enunciado marca como obrigatório — o nome em
 * português "pode existir ou não", nas palavras dele.
 */
final class NameEnRequired implements CardValidationStep
{
    private const MAX_LENGTH = 150;

    public function apply(CardDraft $draft, CardValidation $validation): void
    {
        $name = trim($draft->nameEn);

        if ($name === '') {
            $validation->addError('nameEn', 'O nome em inglês é obrigatório.');

            return;
        }

        if (mb_strlen($name) > self::MAX_LENGTH) {
            $validation->addError(
                'nameEn',
                'O nome em inglês precisa ter no máximo ' . self::MAX_LENGTH . ' caracteres.'
            );
        }
    }
}
