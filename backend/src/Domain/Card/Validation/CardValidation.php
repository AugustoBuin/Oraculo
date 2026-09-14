<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation;

use App\Domain\Card\Entity\CardImage;
use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Entity\Game;
use App\Domain\Catalog\Entity\Rarity;
use App\Domain\Errors\ValidationError;

/**
 * O acumulador que atravessa a cadeia.
 *
 * Mutável de propósito, e é a escolha certa aqui: o objetivo é **juntar** os
 * erros de todos os campos independentes antes de responder, para que o usuário
 * corrija o formulário de uma vez em vez de descobrir um problema por tentativa.
 *
 * A exceção são as dependências: sem o jogo resolvido não há como validar a
 * edição nem a raridade, e nesse caso a cadeia para (`halt`). Continuar
 * produziria erros derivados que confundem mais do que ajudam.
 */
final class CardValidation
{
    /** @var array<string,string> campo => mensagem */
    private array $errors = [];

    private bool $halted = false;

    private ?Game $game = null;
    private ?Edition $edition = null;
    private ?Rarity $rarity = null;
    private ?CardImage $image = null;

    public function addError(string $field, string $message): void
    {
        $this->errors[$field] = $message;
    }

    /**
     * Interrompe a cadeia: uma dependência necessária não existe.
     *
     * Só é chamado depois de registrar o erro que motivou a parada.
     */
    public function halt(): void
    {
        $this->halted = true;
    }

    public function isHalted(): bool
    {
        return $this->halted;
    }

    public function resolveGame(Game $game): void
    {
        $this->game = $game;
    }

    public function resolveEdition(Edition $edition): void
    {
        $this->edition = $edition;
    }

    public function resolveRarity(Rarity $rarity): void
    {
        $this->rarity = $rarity;
    }

    public function resolveImage(?CardImage $image): void
    {
        $this->image = $image;
    }

    public function game(): ?Game
    {
        return $this->game;
    }

    /**
     * Fecha a validação.
     *
     * @throws ValidationError com o mapa completo de campos, para o frontend
     *         ancorar cada mensagem no input certo
     */
    public function result(string $nameEn, ?string $namePt): ValidatedCard
    {
        if ($this->errors !== []) {
            throw ValidationError::fields($this->errors);
        }

        if ($this->game === null || $this->edition === null || $this->rarity === null) {
            // Invariante interna: chegar aqui sem erro e sem resolução
            // significaria que um elo da cadeia sumiu do encadeamento.
            throw new \LogicException('A cadeia de validação terminou sem resolver o catálogo.');
        }

        return new ValidatedCard(
            nameEn: $nameEn,
            namePt: $namePt,
            game: $this->game,
            edition: $this->edition,
            rarity: $this->rarity,
            image: $this->image,
        );
    }
}
