<?php

declare(strict_types=1);

namespace App\Infra\Http;

use App\Domain\Errors\ForbiddenError;
use App\Domain\Errors\UnauthorizedError;
use App\Domain\User\Entity\User;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\PermissionLevel;

/**
 * Proteção aplicada no REGISTRO da rota, não dentro dela.
 *
 * O `PADROES.md` §5.1 marca este como o item de maior valor do documento, com
 * uma justificativa vinda de incidente real: no projeto de origem, a maioria
 * das rotas REST nasceu sem guard, e o resultado foi leitura e exclusão não
 * autenticadas de dados pessoais de clientes — um achado crítico que levou
 * meses para fechar.
 *
 * Envolver a rota, em vez de checar dentro dela, muda a natureza do erro: uma
 * rota desprotegida deixa de ser "alguém esqueceu uma linha no meio de um
 * método" e passa a ser visível na leitura do composition root, onde as rotas
 * são listadas lado a lado.
 *
 * Uso no composition root:
 *
 *     return [
 *         Guard::protect(ListCardsRoute::create($listCards), PermissionLevel::VIEWER),
 *         Guard::protect(DeleteCardRoute::create($deleteCard), PermissionLevel::EDITOR),
 *     ];
 *
 * Rota pública é exceção deliberada: não passa por aqui e precisa de comentário
 * justificando. Neste projeto existe uma só — `POST /api/auth/login`.
 */
final class Guard implements Route
{
    /** Onde o middleware de sessão deposita o usuário autenticado. */
    public const USER_ATTRIBUTE = 'authenticatedUser';

    private function __construct(
        private readonly Route $route,
        private readonly PermissionLevel $minimum,
    ) {
    }

    public static function protect(Route $route, PermissionLevel $minimum): self
    {
        return new self($route, $minimum);
    }

    /**
     * Método e caminho são delegados: o roteador precisa continuar enxergando a
     * rota original, senão o guard a tornaria inalcançável.
     */
    public function method(): HttpMethod
    {
        return $this->route->method();
    }

    public function path(): string
    {
        return $this->route->path();
    }

    public function minimumLevel(): PermissionLevel
    {
        return $this->minimum;
    }

    public function handle(Request $request): Response
    {
        $user = $request->attribute(self::USER_ATTRIBUTE);

        if (!$user instanceof User || !$user->active) {
            // Usuário inativo é tratado como ausente de propósito: dizer
            // "sua conta foi desativada" confirmaria a existência da conta.
            throw new UnauthorizedError('Sessão expirada. Entre novamente.');
        }

        if (!$user->can($this->minimum)) {
            // A mensagem não diz qual nível falta nem qual o usuário tem:
            // informar isso mapeia a estrutura de permissões para quem sonda.
            throw new ForbiddenError('Você não tem permissão para esta operação.');
        }

        return $this->route->handle($request);
    }
}
