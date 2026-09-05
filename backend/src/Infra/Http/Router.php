<?php

declare(strict_types=1);

namespace App\Infra\Http;

use App\Domain\Errors\MethodNotAllowedError;
use App\Domain\Errors\NotFoundError;

/**
 * Casa caminho e verbo com uma rota registrada.
 *
 * Recebe as rotas já protegidas pelos composition roots das features — o Router
 * não sabe o que é permissão, e não deve saber: ele casa caminho, o guard
 * decide acesso (PADROES.md §5.1).
 */
final class Router
{
    /** Um segmento que é inteiro um parâmetro: `{id}`, `{gameId}`. */
    private const PARAMETER_PATTERN = '/^\{([a-zA-Z][a-zA-Z0-9_]*)\}$/';

    /** @var list<Route> */
    private readonly array $routes;

    /** @param list<Route> $routes */
    public function __construct(array $routes)
    {
        $this->routes = self::staticFirst($routes);
    }

    public function dispatch(Request $request): Response
    {
        $path = self::normalize($request->path);
        $pathExists = false;

        foreach ($this->routes as $route) {
            $params = self::match($route->path(), $path);

            if ($params === null) {
                continue;
            }

            $pathExists = true;

            if ($route->method() === $request->method) {
                return $route->handle($request->withRouteParams($params));
            }
        }

        if ($pathExists) {
            throw new MethodNotAllowedError('Método não permitido para este recurso.');
        }

        throw new NotFoundError('Recurso não encontrado.');
    }

    /**
     * Rota sem parâmetro é avaliada antes de rota com parâmetro.
     *
     * Sem isso, `/api/cards/recentes` cairia no handler de `/api/cards/{id}`
     * com id="recentes" caso a rota estática fosse declarada depois — e a ordem
     * de declaração num composition root não deveria mudar comportamento.
     *
     * @param list<Route> $routes
     * @return list<Route>
     */
    private static function staticFirst(array $routes): array
    {
        $static = [];
        $parametric = [];

        foreach ($routes as $route) {
            if (str_contains($route->path(), '{')) {
                $parametric[] = $route;
            } else {
                $static[] = $route;
            }
        }

        return [...$static, ...$parametric];
    }

    /**
     * Casa segmento a segmento, em vez de montar um regex do caminho inteiro.
     *
     * Duas vantagens sobre a versão com regex: não há questão de escape (montar
     * o padrão exige quotar o literal sem quotar o parâmetro, e errar isso é
     * silencioso), e a regra "um parâmetro casa exatamente um segmento" cai por
     * construção — `/api/cards/12/history` não pode cair em `/api/cards/{id}`.
     *
     * @return array<string,string>|null os parâmetros, ou null se não casou
     */
    private static function match(string $template, string $path): ?array
    {
        $templateSegments = explode('/', self::normalize($template));
        $pathSegments = explode('/', $path);

        if (count($templateSegments) !== count($pathSegments)) {
            return null;
        }

        $params = [];

        foreach ($templateSegments as $index => $segment) {
            if (preg_match(self::PARAMETER_PATTERN, $segment, $matches) === 1) {
                // Segmento vazio não é valor de parâmetro: `/api/cards//history`
                // não pode virar id = "".
                if ($pathSegments[$index] === '') {
                    return null;
                }

                $params[$matches[1]] = rawurldecode($pathSegments[$index]);
                continue;
            }

            if ($segment !== $pathSegments[$index]) {
                return null;
            }
        }

        return $params;
    }

    /**
     * Barra final não muda recurso: `/api/cards` e `/api/cards/` são o mesmo.
     */
    private static function normalize(string $path): string
    {
        $trimmed = rtrim($path, '/');

        return $trimmed === '' ? '/' : $trimmed;
    }
}
