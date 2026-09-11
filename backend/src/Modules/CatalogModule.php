<?php

declare(strict_types=1);

namespace App\Modules;

use App\Infra\Http\Guard;
use App\Infra\Http\Route;
use App\Infra\Http\Routes\Catalog\CreateEditionRoute;
use App\Infra\Http\Routes\Catalog\CreateRarityRoute;
use App\Infra\Http\Routes\Catalog\DeactivateCatalogItemRoute;
use App\Infra\Http\Routes\Catalog\ListEditionsRoute;
use App\Infra\Http\Routes\Catalog\ListGamesRoute;
use App\Infra\Http\Routes\Catalog\ListRaritiesRoute;
use App\Infra\Http\Routes\Catalog\UpdateEditionRoute;
use App\Infra\Http\Routes\Catalog\UpdateRarityRoute;
use App\Infra\Repository\Catalog\EditionRepositoryPdo;
use App\Infra\Repository\Catalog\GameRepositoryPdo;
use App\Infra\Repository\Catalog\RarityRepositoryPdo;
use App\Shared\Enum\PermissionLevel;
use App\Shared\Observability\Logger;
use App\UseCases\Catalog\CreateEditionUseCase;
use App\UseCases\Catalog\CreateRarityUseCase;
use App\UseCases\Catalog\DeactivateCatalogItemUseCase;
use App\UseCases\Catalog\ListEditionsUseCase;
use App\UseCases\Catalog\ListGamesUseCase;
use App\UseCases\Catalog\ListRaritiesUseCase;
use App\UseCases\Catalog\UpdateEditionUseCase;
use App\UseCases\Catalog\UpdateRarityUseCase;

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
 * Criar e alterar são próprios de cada catálogo — a raridade grava cor, a
 * edição não. Desativar é uma operação só, montada duas vezes: é a mesma para
 * as duas.
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
            Guard::protect(
                CreateEditionRoute::create(CreateEditionUseCase::create($games, $editions, $logger)),
                PermissionLevel::ADMIN
            ),
            Guard::protect(
                UpdateEditionRoute::create(UpdateEditionUseCase::create($editions, $logger)),
                PermissionLevel::ADMIN
            ),
            Guard::protect(
                DeactivateCatalogItemRoute::create(
                    '/api/editions/{id}',
                    DeactivateCatalogItemUseCase::create($editions, $logger)
                ),
                PermissionLevel::ADMIN
            ),
            Guard::protect(
                CreateRarityRoute::create(CreateRarityUseCase::create($games, $rarities, $logger)),
                PermissionLevel::ADMIN
            ),
            Guard::protect(
                UpdateRarityRoute::create(UpdateRarityUseCase::create($rarities, $logger)),
                PermissionLevel::ADMIN
            ),
            Guard::protect(
                DeactivateCatalogItemRoute::create(
                    '/api/rarities/{id}',
                    DeactivateCatalogItemUseCase::create($rarities, $logger)
                ),
                PermissionLevel::ADMIN
            ),
        ];
    }
}
