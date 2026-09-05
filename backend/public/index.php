<?php

declare(strict_types=1);

/**
 * Front controller — o ÚNICO arquivo PHP alcançável pela web.
 *
 * O document root do servidor aponta para `frontend/public`, e apenas este
 * arquivo é exposto, sob `/api` (docker/app/apache.conf). `src/`, `.env`,
 * `migrations/` e `storage/` não têm caminho servido.
 */

use App\Infra\Http\ErrorHandler;
use App\Infra\Http\Middleware\ErrorBoundary;
use App\Infra\Http\Middleware\JsonBody;
use App\Infra\Http\Middleware\SecurityHeaders;
use App\Infra\Http\Middleware\TraceId;
use App\Infra\Http\Pipeline;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Router;
use App\Shared\Observability\RequestContext;
use App\Shared\Observability\StderrLogger;

require __DIR__ . '/../src/autoload.php';

/**
 * Warning e notice viram exceção.
 *
 * Com display_errors desligado — e ele precisa ficar desligado, senão a
 * resposta entrega caminho absoluto e versão do PHP — um warning seria
 * silencioso. Convertê-lo em exceção faz o ErrorHandler registrá-lo e
 * responder 500, em vez de o sistema seguir com um valor que ninguém validou.
 */
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if ((error_reporting() & $severity) === 0) {
        return false;
    }

    throw new ErrorException($message, 0, $severity, $file, $line);
});

$logger = new StderrLogger(channel: 'http', traceId: RequestContext::traceId());
$errorHandler = new ErrorHandler($logger);

try {
    $router = new Router([
        // As rotas entram aqui pelos composition roots das features, já
        // protegidas pelo guard. Nenhuma ainda: os módulos chegam no Épico 1.
    ]);

    // A ordem importa. Segurança primeiro, para que a resposta de erro
    // produzida pelo ErrorBoundary também receba os cabeçalhos.
    $pipeline = new Pipeline([
        new SecurityHeaders(),
        new ErrorBoundary($errorHandler),
        new TraceId(),
        new JsonBody(),
    ]);

    $response = $pipeline->process(
        Request::fromGlobals(),
        static fn(Request $request): Response => $router->dispatch($request)
    );
} catch (\Throwable $error) {
    // Rede de proteção para o que falha antes de o pipeline existir — montar a
    // requisição a partir das superglobais, por exemplo.
    $response = $errorHandler->toResponse($error);
}

$response->send();
