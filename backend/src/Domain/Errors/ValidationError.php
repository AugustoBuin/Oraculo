<?php

declare(strict_types=1);

namespace App\Domain\Errors;

use App\Shared\Enum\HttpStatus;

/**
 * Entrada inválida.
 *
 * Carrega opcionalmente um mapa de erro por campo, para que o frontend ancore a
 * mensagem no input certo. Sem esse mapa, a interface só consegue mostrar um
 * aviso genérico no topo do formulário — e o usuário fica procurando qual dos
 * seis campos está errado.
 *
 * O mapa vai para o corpo da resposta sob a chave `errors`, conforme
 * docs/api-contract.md §1.3.
 */
final class ValidationError extends DomainError
{
    private const DEFAULT_MESSAGE = 'Verifique os campos destacados.';
    private const DETAILS_KEY = 'errors';

    /**
     * Erro em um campo específico. É a forma que os elos da cadeia de validação
     * usam, porque cada elo conhece exatamente um campo.
     */
    public static function field(string $field, string $message): self
    {
        return self::fields([$field => $message]);
    }

    /**
     * Vários campos de uma vez.
     *
     * @param array<string,string> $errors campo => mensagem em português
     */
    public static function fields(array $errors, string $message = self::DEFAULT_MESSAGE): self
    {
        // Mapa vazio não vira chave vazia no corpo: `"errors": {}` obrigaria o
        // cliente a distinguir ausência de vazio sem ganho nenhum.
        $details = $errors === [] ? [] : [self::DETAILS_KEY => $errors];

        return new self($message, $details);
    }

    public function status(): HttpStatus
    {
        return HttpStatus::BAD_REQUEST;
    }

    /**
     * O mapa por campo, para quem precisa inspecioná-lo sem passar pelo corpo
     * da resposta — os testes dos elos de validação, principalmente.
     *
     * @return array<string,string>
     */
    public function fieldErrors(): array
    {
        /** @var array<string,string> */
        return $this->details()[self::DETAILS_KEY] ?? [];
    }
}
