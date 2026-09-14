<?php

declare(strict_types=1);

namespace App\Domain\Card\Service;

use App\Domain\Card\Entity\CardImage;

/**
 * Uma origem de imagem.
 *
 * A Strategy do projeto (docs/decisions/ADR-005). Elimina o `if (enviouArquivo)
 * { … } else { … }` que cresceria a cada origem nova, e satisfaz o teto de duas
 * implementações que o padrão exige: com uma só, o certo seria uma função pura.
 *
 * O contrato é: **transforme esta entrada numa referência de imagem utilizável,
 * ou falhe com uma mensagem em português.**
 */
interface ImageSource
{
    /**
     * @param array<string,mixed> $input o que o cliente mandou para esta origem
     * @throws \App\Domain\Errors\DomainError quando a entrada não serve
     */
    public function resolve(array $input): CardImage;
}
