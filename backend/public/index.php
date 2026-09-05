<?php

declare(strict_types=1);

/**
 * Front controller — o ÚNICO arquivo PHP alcançável pela web.
 *
 * O document root do servidor aponta para `frontend/public`, e apenas este
 * arquivo é exposto, sob `/api` (docker/app/apache.conf). `src/`, `.env`,
 * `migrations/` e `storage/` não têm caminho servido.
 */

use App\Infra\Database\Connection;
use App\Infra\Http\ErrorHandler;
use App\Infra\Http\Middleware\Csrf;
use App\Infra\Http\Middleware\ErrorBoundary;
use App\Infra\Http\Middleware\JsonBody;
use App\Infra\Http\Middleware\SecurityHeaders;
use App\Infra\Http\Middleware\SessionMiddleware;
use App\Infra\Http\Middleware\TraceId;
use App\Infra\Http\Pipeline;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Router;
use App\Infra\Repository\Session\SessionRepositoryPdo;
use App\Infra\Repository\User\UserRepositoryPdo;
use App\Modules\AuthModule;
use App\Modules\CardModule;
use App\Modules\CatalogModule;
use App\Shared\Clock\SystemClock;
use App\Shared\Config\Env;
use App\Shared\Event\EventDispatcher;
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
    $pdo = Connection::shared();
    $clock = new SystemClock();
    $sessionTtl = Env::requiredInt('SESSION_TTL_SECONDS');

    // Cookie Secure só sob https: em http local o navegador simplesmente não
    // grava um cookie Secure, e o login pararia de funcionar sem mensagem.
    $secureCookie = str_starts_with(Env::required('APP_URL'), 'https://');

    $events = new EventDispatcher($logger);

    $router = new Router([
        ...AuthModule::routes($pdo, $clock, $logger, $sessionTtl, $secureCookie),
        ...CatalogModule::routes($pdo),
        ...CardModule::routes(
            pdo: $pdo,
            events: $events,
            clock: $clock,
            logger: $logger,
            // Fora do document root: arquivo enviado dentro de pasta pública é
            // execução remota esperando acontecer (docs/decisions/ADR-008).
            uploadDirectory: dirname(__DIR__) . '/storage/uploads',
            uploadMaxBytes: Env::requiredInt('UPLOAD_MAX_BYTES'),
        ),
    ]);

    /**
     * A ordem da cadeia é a parte que mais importa deste arquivo.
     *
     * SecurityHeaders vem PRIMEIRO para que a resposta de erro produzida pelo
     * ErrorBoundary também receba os cabeçalhos — invertido, todo erro sairia
     * sem CSP, que é justamente o caminho menos exercitado do sistema.
     *
     * Session vem antes de Csrf porque o token vive na sessão; e o guard, que
     * decide acesso, é aplicado no registro de cada rota, dentro do módulo.
     */
    $pipeline = new Pipeline([
        new SecurityHeaders(),
        new ErrorBoundary($errorHandler),
        new TraceId(),
        new JsonBody(),
        new SessionMiddleware(
            sessions: new SessionRepositoryPdo($pdo),
            users: new UserRepositoryPdo($pdo),
            clock: $clock,
            ttlSeconds: $sessionTtl,
        ),
        new Csrf(exemptPaths: ['/api/auth/login']),
    ]);

    $response = $pipeline->process(
        Request::fromGlobals(),
        static fn(Request $request): Response => $router->dispatch($request)
    );
} catch (\Throwable $error) {
    // Rede de proteção para o que falha antes de o pipeline existir — conexão
    // com o banco, variável de ambiente ausente, montagem da requisição.
    $response = $errorHandler->toResponse($error);
}

$response->send();
