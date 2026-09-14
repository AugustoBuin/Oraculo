<?php

declare(strict_types=1);

namespace App\Modules;

use App\Domain\Card\Event\CardChanged;
use App\Domain\Card\Validation\CardValidationChain;
use App\Infra\EventHandlers\WriteCardAuditHandler;
use App\Infra\Http\Guard;
use App\Infra\Http\Route;
use App\Infra\Http\Routes\Card\CardHistoryRoute;
use App\Infra\Http\Routes\Card\CreateCardRoute;
use App\Infra\Http\Routes\Card\DeleteCardRoute;
use App\Infra\Http\Routes\Card\GetCardRoute;
use App\Infra\Http\Routes\Card\ListCardsRoute;
use App\Infra\Http\Routes\Card\RestoreCardRoute;
use App\Infra\Http\Routes\Card\ServeCardImageRoute;
use App\Infra\Http\Routes\Card\UpdateCardRoute;
use App\Infra\Http\Routes\Card\UploadCardImageRoute;
use App\Infra\Repository\Card\CardAuditRepositoryPdo;
use App\Infra\Repository\Card\CardRepositoryPdo;
use App\Infra\Repository\Catalog\EditionRepositoryPdo;
use App\Infra\Repository\Catalog\GameRepositoryPdo;
use App\Infra\Repository\Catalog\RarityRepositoryPdo;
use App\Infra\Storage\LocalImageStorage;
use App\Infra\Storage\RemoteUrlImageSource;
use App\Infra\Storage\StoredUploadImageSource;
use App\Infra\Storage\UploadedFileImageSource;
use App\Shared\Clock\Clock;
use App\Shared\Enum\PermissionLevel;
use App\Shared\Event\EventDispatcher;
use App\Shared\Observability\Logger;
use App\UseCases\Card\CreateCardUseCase;
use App\UseCases\Card\DeleteCardUseCase;
use App\UseCases\Card\GetCardHistoryUseCase;
use App\UseCases\Card\GetCardUseCase;
use App\UseCases\Card\ListCardsUseCase;
use App\UseCases\Card\RestoreCardUseCase;
use App\UseCases\Card\UpdateCardUseCase;

/**
 * Composition root das cartas.
 *
 * Ler esta lista responde, de uma vez, quais operações existem e em que nível
 * cada uma está — e é o que torna uma rota desprotegida visível na revisão.
 *
 * A divisão de níveis segue a persona do enunciado: quem só consulta lê e
 * pesquisa; quem opera o catálogo cria, edita, exclui e restaura. A forma mais
 * eficaz de proteger quem tem menos familiaridade com tecnologia não é uma
 * interface mais simples — é não lhe dar um botão que ela não precisa apertar.
 */
final class CardModule
{
    /** @return list<Route> */
    public static function routes(
        \PDO $pdo,
        EventDispatcher $events,
        Clock $clock,
        Logger $logger,
        string $uploadDirectory,
        int $uploadMaxBytes,
    ): array {
        $cards = new CardRepositoryPdo($pdo);
        $games = new GameRepositoryPdo($pdo);
        $editions = new EditionRepositoryPdo($pdo);
        $rarities = new RarityRepositoryPdo($pdo);
        $audit = new CardAuditRepositoryPdo($pdo);

        // O único ouvinte do projeto, ligado num lugar só. Os casos de uso
        // despacham o evento e não sabem que ele existe (docs/decisions/ADR-005).
        $events->on(CardChanged::class, new WriteCardAuditHandler($audit, $clock, $logger));

        $storage = new LocalImageStorage($uploadDirectory);
        $remote = new RemoteUrlImageSource();

        // Duas estratégias para o mesmo tipo "upload", em momentos diferentes:
        // o ENDPOINT recebe bytes e grava; o SALVAMENTO da carta recebe a
        // referência já gravada e só confere que ela existe. Conflatar as duas
        // fazia o salvamento procurar um arquivo em bytes que não existiam.
        $receiveUpload = new UploadedFileImageSource($storage, $uploadMaxBytes);
        $referenceUpload = new StoredUploadImageSource($storage);

        // A cadeia é montada uma vez e compartilhada pela criação e pela
        // edição: uma segunda cadeia divergiria, e a edição passaria a aceitar
        // o que o cadastro recusa.
        $validation = CardValidationChain::default($games, $editions, $rarities, $referenceUpload, $remote);

        $listCards = ListCardsUseCase::create($cards, $games, $editions, $rarities);
        $getCard = GetCardUseCase::create($cards);
        $createCard = CreateCardUseCase::create($cards, $validation, $events, $clock, $logger);
        $updateCard = UpdateCardUseCase::create($cards, $validation, $events, $clock, $logger);
        $deleteCard = DeleteCardUseCase::create($cards, $events, $clock, $logger);
        $restoreCard = RestoreCardUseCase::create($cards, $events, $clock, $logger);
        $cardHistory = GetCardHistoryUseCase::create($cards, $audit);

        return [
            // Consulta: lê e pesquisa, e não alcança nenhuma escrita.
            Guard::protect(ListCardsRoute::create($listCards), PermissionLevel::VIEWER),
            Guard::protect(GetCardRoute::create($getCard), PermissionLevel::VIEWER),
            Guard::protect(ServeCardImageRoute::create($storage), PermissionLevel::VIEWER),

            // Cadastro: opera o catálogo.
            Guard::protect(CreateCardRoute::create($createCard), PermissionLevel::EDITOR),
            Guard::protect(UpdateCardRoute::create($updateCard), PermissionLevel::EDITOR),
            Guard::protect(DeleteCardRoute::create($deleteCard), PermissionLevel::EDITOR),
            Guard::protect(RestoreCardRoute::create($restoreCard), PermissionLevel::EDITOR),
            Guard::protect(CardHistoryRoute::create($cardHistory), PermissionLevel::EDITOR),
            Guard::protect(UploadCardImageRoute::create($receiveUpload), PermissionLevel::EDITOR),
        ];
    }
}
