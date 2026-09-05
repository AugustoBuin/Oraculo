<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation;

use App\Domain\Card\Service\ImageSource;
use App\Domain\Card\Validation\Step\EditionBelongsToGame;
use App\Domain\Card\Validation\Step\GameExists;
use App\Domain\Card\Validation\Step\ImageIsValid;
use App\Domain\Card\Validation\Step\NameEnRequired;
use App\Domain\Card\Validation\Step\NamePtLength;
use App\Domain\Card\Validation\Step\RarityBelongsToGame;
use App\Domain\Catalog\Gateway\EditionGateway;
use App\Domain\Catalog\Gateway\GameGateway;
use App\Domain\Catalog\Gateway\RarityGateway;

/**
 * A cadeia de validação de carta.
 *
 * **A ordem é significativa**, e não uma questão de estilo: não se valida a
 * edição antes de saber que o jogo existe, porque a mensagem resultante
 * apontaria para o campo errado.
 *
 * A verificação de duplicidade NÃO está aqui, e isso é deliberado. Ela depende
 * de saber se a operação é criação ou edição — na edição, a própria carta não
 * conta como duplicata —, e esse contexto vive no caso de uso, não no rascunho.
 * Colocá-la na cadeia exigiria passar o id da carta corrente adiante só por
 * causa dela.
 */
final class CardValidationChain
{
    /** @param list<CardValidationStep> $steps */
    private function __construct(
        private readonly array $steps,
    ) {
    }

    /** @param list<CardValidationStep> $steps */
    public static function of(array $steps): self
    {
        return new self($steps);
    }

    public static function default(
        GameGateway $games,
        EditionGateway $editions,
        RarityGateway $rarities,
        ImageSource $upload,
        ImageSource $remote,
    ): self {
        return new self([
            new NameEnRequired(),
            new NamePtLength(),
            new GameExists($games),
            new EditionBelongsToGame($editions),
            new RarityBelongsToGame($rarities),
            ImageIsValid::with($upload, $remote),
        ]);
    }

    /**
     * @throws \App\Domain\Errors\ValidationError com o mapa completo de campos
     */
    public function validate(CardDraft $draft): ValidatedCard
    {
        $validation = new CardValidation();

        foreach ($this->steps as $step) {
            if ($validation->isHalted()) {
                break;
            }

            $step->apply($draft, $validation);
        }

        return $validation->result(trim($draft->nameEn), $this->normalizeNamePt($draft->namePt));
    }

    /**
     * Vazio vira ausente.
     *
     * Quem apaga o campo no formulário quer removê-lo, não gravar uma string
     * vazia que depois apareceria como um nome em branco na listagem.
     */
    private function normalizeNamePt(?string $namePt): ?string
    {
        if ($namePt === null) {
            return null;
        }

        $trimmed = trim($namePt);

        return $trimmed === '' ? null : $trimmed;
    }
}
