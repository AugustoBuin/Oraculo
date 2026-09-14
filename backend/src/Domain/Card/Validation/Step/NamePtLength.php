<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation\Step;

use App\Domain\Card\Validation\CardDraft;
use App\Domain\Card\Validation\CardValidation;
use App\Domain\Card\Validation\CardValidationStep;

/**
 * Nome em português: opcional, e essa opcionalidade é requisito do enunciado
 * ("pode existir ou não").
 *
 * Ausente e vazio são a mesma coisa aqui — quem apaga o campo no formulário
 * quer removê-lo, não gravar uma string vazia que depois apareceria como um
 * nome em branco na listagem.
 */
final class NamePtLength implements CardValidationStep
{
    private const MAX_LENGTH = 150;

    public function apply(CardDraft $draft, CardValidation $validation): void
    {
        if ($draft->namePt === null || trim($draft->namePt) === '') {
            return;
        }

        if (mb_strlen(trim($draft->namePt)) > self::MAX_LENGTH) {
            $validation->addError(
                'namePt',
                'O nome em português precisa ter no máximo ' . self::MAX_LENGTH . ' caracteres.'
            );
        }
    }
}
