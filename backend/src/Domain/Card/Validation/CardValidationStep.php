<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation;

/**
 * Um elo da cadeia de validação de carta.
 *
 * A segunda Chain of Responsibility do projeto (docs/decisions/ADR-005). Ela
 * elimina o método de oitenta linhas com seis blocos condicionais que cresceria
 * a cada campo novo — e, mais importante, torna cada regra testável sozinha.
 *
 * Cada elo registra o erro do **seu** campo no acumulador e segue. Só quem
 * descobre que uma dependência não existe interrompe a cadeia.
 */
interface CardValidationStep
{
    public function apply(CardDraft $draft, CardValidation $validation): void;
}
