<?php

declare(strict_types=1);

namespace App\Modules;

use App\Infra\Http\Guard;
use App\Infra\Http\Route;
use App\Infra\Http\Routes\Catalog\CreateCatalogItemRoute;
use App\Infra\Http\Routes\Catalog\DeactivateCatalogItemRoute;
use App\Infra\Http\Routes\Catalog\ListEditionsRoute;
use App\Infra\Http\Routes\Catalog\ListGamesRoute;
use App\Infra\Http\Routes\Catalog\ListRaritiesRoute;
use App\Infra\Http\Routes\Catalog\UpdateCatalogItemRoute;
use App\Infra\Repository\Catalog\EditionRepositoryPdo;
use App\Infra\Repository\Catalog\GameRepositoryPdo;
use App\Infra\Repository\Catalog\RarityRepositoryPdo;
use App\Shared\Enum\PermissionLevel;
use App\Shared\Observability\Logger;
use App\UseCases\Catalog\CreateCatalogItemUseCase;
use App\UseCases\Catalog\DeactivateCatalogItemUseCase;
use App\UseCases\Catalog\ListEditionsUseCase;
use App\UseCases\Catalog\ListGamesUseCase;
use App\UseCases\Catalog\ListRaritiesUseCase;
use App\UseCases\Catalog\UpdateCatalogItemUseCase;

/**
 * Composition root do catálogo.
 *
 * As três leituras são o motor da cascata Jogo -> Edição -> Raridade, e exigem
 * apenas VIEWER: quem só consulta cartas precisa enxergar os filtros.
 *
 * As seis escritas são o que dá conteúdo ao nível ADMIN — e a tese do produto
 * em funcionamento: uma edição nova de Pokémon entra em produção por cadastro,
 * não por deploy.
 *
 * **Gestão de jogos ficou fora**, e é decisão consciente: criar um jogo sem
 * raridades cadastradas deixa o sistema num estado pior do que não ter o botão
 * — o primeiro cadastro de carta naquele jogo travaria sem raridade para
 * escolher. Abrir um TCG novo é uma operação estrutural, rara, e melhor
 * atendida por uma migration com o catálogo completo.
 */
final class CatalogModule
{
    /** @return list<Route> */
    public static function routes(\PDO $pdo, Logger $logger): array
    {
        $games = new GameRepositoryPdo($pdo);
        $editions = new EditionRepositoryPdo($pdo);
        $rarities = new RarityRepositoryPdo($pdo);

        return [
            // --- Leitura: o motor da cascata ---------------------------------
            Guard::protect(
                ListGamesRoute::create(ListGamesUseCase::create($games)),
                PermissionLevel::VIEWER
            ),
            Guard::protect(
                ListEditionsRoute::create(ListEditionsUseCase::create($games, $editions)),
                PermissionLevel::VIEWER
            ),
            Guard::protect(
                ListRaritiesRoute::create(ListRaritiesUseCase::create($games, $rarities)),
                PermissionLevel::VIEWER
            ),

            // --- Escrita: o que só o ADMIN alcança ---------------------------
            ...self::writeRoutes('editions', $games, $editions, $logger),
            ...self::writeRoutes('rarities', $games, $rarities, $logger),
        ];
    }

    /**
     * As mesmas três operações, para edições e para raridades.
     *
     * Escrever seis rotas idênticas criaria seis lugares para corrigir o mesmo
     * defeito. A porta CatalogItemGateway existe exatamente para isso.
     *
     * @param \App\Domain\Catalog\Gateway\GameGateway $games
     * @param \App\Domain\Catalog\Gateway\CatalogItemGateway $items
     * @return list<Route>
     */
    private static function writeRoutes(
        string $segment,
        \App\Domain\Catalog\Gateway\GameGateway $games,
        \App\Domain\Catalog\Gateway\CatalogItemGateway $items,
        Logger $logger,
    ): array {
        return [
            Guard::protect(
                CreateCatalogItemRoute::create(
                    '/api/games/{gameId}/' . $segment,
                    CreateCatalogItemUseCase::create($games, $items, $logger)
                ),
                PermissionLevel::ADMIN
            ),
            Guard::protect(
                UpdateCatalogItemRoute::create(
                    '/api/' . $segment . '/{id}',
                    UpdateCatalogItemUseCase::create($items, $logger)
                ),
                PermissionLevel::ADMIN
            ),
            Guard::protect(
                DeactivateCatalogItemRoute::create(
                    '/api/' . $segment . '/{id}',
                    DeactivateCatalogItemUseCase::create($items, $logger)
                ),
                PermissionLevel::ADMIN
            ),
        ];
    }
}
