<?php

declare(strict_types=1);

namespace App\Modules;

use App\Infra\Http\Guard;
use App\Infra\Http\Route;
use App\Infra\Http\Routes\Catalog\ListEditionsRoute;
use App\Infra\Http\Routes\Catalog\ListGamesRoute;
use App\Infra\Http\Routes\Catalog\ListRaritiesRoute;
use App\Infra\Repository\Catalog\EditionRepositoryPdo;
use App\Infra\Repository\Catalog\GameRepositoryPdo;
use App\Infra\Repository\Catalog\RarityRepositoryPdo;
use App\Shared\Enum\PermissionLevel;
use App\UseCases\Catalog\ListEditionsUseCase;
use App\UseCases\Catalog\ListGamesUseCase;
use App\UseCases\Catalog\ListRaritiesUseCase;

/**
 * Composition root do catálogo.
 *
 * As três leituras são o motor da cascata Jogo -> Edição -> Raridade, e todas
 * exigem apenas VIEWER: quem só consulta cartas precisa enxergar os filtros.
 */
final class CatalogModule
{
    /** @return list<Route> */
    public static function routes(\PDO $pdo): array
    {
        $games = new GameRepositoryPdo($pdo);
        $editions = new EditionRepositoryPdo($pdo);
        $rarities = new RarityRepositoryPdo($pdo);

        return [
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
        ];
    }
}
