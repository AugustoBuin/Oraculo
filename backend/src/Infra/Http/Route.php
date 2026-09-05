<?php

declare(strict_types=1);

namespace App\Infra\Http;

use App\Shared\Enum\HttpMethod;

/**
 * Uma rota HTTP.
 *
 * A rota é fina: lê o que precisa da requisição, monta o DTO de entrada campo a
 * campo, chama o caso de uso, mapeia a saída e devolve a Response. Sem `if`
 * além de apresentação, sem regra de negócio, e **sem escolher o status de erro
 * na mão** (PADROES.md §2.3).
 *
 * A proteção não mora aqui: ela é aplicada no REGISTRO da rota, pelo guard, no
 * composition root da feature (PADROES.md §5.1).
 */
interface Route
{
    public function method(): HttpMethod;

    /** Caminho público, com parâmetros entre chaves: '/api/cards/{id}'. */
    public function path(): string;

    public function handle(Request $request): Response;
}
