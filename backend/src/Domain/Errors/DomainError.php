<?php

declare(strict_types=1);

namespace App\Domain\Errors;

use App\Shared\Enum\HttpStatus;

/**
 * Erro de negócio, com mensagem em português JÁ SEGURA para o cliente.
 *
 * O status mora na classe, e não na rota, porque quem sabe o tipo da falha é o
 * domínio; a borda apenas traduz. Um `http_response_code()` no meio de um
 * handler é exatamente o que cria envelopes de erro divergentes (PADROES.md §4.2).
 *
 * Erro que NÃO descende daqui vira 500 com mensagem genérica, e o texto cru
 * fica apenas no log. Ou seja: lançar uma exceção genérica é uma **decisão** —
 * a de que o usuário não deve ler aquilo —, nunca um default por descuido.
 *
 * Regra que acompanha: nunca injete valor do banco na mensagem. `NotFoundError`
 * diz "Carta não encontrada.", nunca "Carta id=42 não encontrada" — id alheio
 * na resposta é vazamento de informação.
 */
class DomainError extends \RuntimeException
{
    /**
     * @param array<string,mixed> $details Campos extras que a borda deve expor
     *                                     junto da mensagem (ex.: o mapa de
     *                                     erros por campo, o registro duplicado).
     *                                     Precisa ser seguro para o cliente.
     */
    public function __construct(
        string $message,
        private readonly array $details = [],
    ) {
        parent::__construct($message);
    }

    public function status(): HttpStatus
    {
        return HttpStatus::BAD_REQUEST;
    }

    /** @return array<string,mixed> */
    public function details(): array
    {
        return $this->details;
    }
}
