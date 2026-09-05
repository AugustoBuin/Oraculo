<?php

declare(strict_types=1);

/**
 * Aplica as migrations pendentes.
 *
 * Roda no boot do contêiner a cada `docker compose up`, então é idempotente:
 * rodar duas vezes não produz efeito nem erro.
 *
 * `echo` aqui é legítimo — a regra do log estruturado vale para fluxo
 * instrumentado, não para script de linha de comando (PADROES.md §6.1).
 */

use App\Infra\Database\Connection;
use App\Infra\Database\Migrator;
use App\Shared\Observability\RequestContext;
use App\Shared\Observability\StderrLogger;

require __DIR__ . '/../src/autoload.php';

$logger = new StderrLogger(channel: 'migrate', traceId: RequestContext::traceId());

try {
    $applied = (new Migrator(
        pdo: Connection::shared(),
        directory: __DIR__ . '/../migrations',
        logger: $logger,
    ))->run();

    if ($applied === []) {
        echo 'Nenhuma migration pendente.' . PHP_EOL;
        exit(0);
    }

    foreach ($applied as $migration) {
        echo '  aplicada  ' . $migration . PHP_EOL;
    }

    echo count($applied) . ' migration(s) aplicada(s).' . PHP_EOL;
    exit(0);
} catch (\Throwable $error) {
    // Falha de migration precisa derrubar o boot alto e claro: subir a
    // aplicação com schema incompleto produz erro em runtime muito mais caro
    // de diagnosticar do que um contêiner que não sobe.
    $logger->error('Falha ao aplicar migrations', ['error' => $error]);
    fwrite(STDERR, 'ERRO: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
