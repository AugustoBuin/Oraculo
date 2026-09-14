<?php

declare(strict_types=1);

/**
 * Imprime o mapa de rotas: método, caminho e nível mínimo exigido.
 *
 * Existe por dois motivos.
 *
 * O primeiro é a auditoria de segurança, que começa mapeando a superfície de
 * ataque: a pergunta "toda rota está protegida no nível certo?" só é
 * respondível com a lista completa em mãos, e uma lista mantida à mão fica
 * desatualizada no primeiro commit apressado.
 *
 * O segundo é a documentação. O contrato de API descreve as rotas; este comando
 * mostra as que existem de verdade. Divergência entre os dois é bug de um dos
 * lados — e agora é visível em um comando, em vez de descoberta por um cliente.
 *
 * Uso: docker compose exec app php backend/bin/routes.php
 */

use App\Infra\Http\Guard;
use App\Infra\Http\Route;
use App\Modules\AuthModule;
use App\Modules\CardModule;
use App\Modules\CatalogModule;
use App\Shared\Clock\SystemClock;
use App\Shared\Config\Env;
use App\Shared\Event\EventDispatcher;
use App\Shared\Observability\Logger;

require __DIR__ . '/../src/autoload.php';

/** Logger silencioso: listar rotas não é evento que mereça log. */
$logger = new class implements Logger {
    public function error(string $message, array $context = []): void
    {
    }

    public function warning(string $message, array $context = []): void
    {
    }

    public function info(string $message, array $context = []): void
    {
    }

    public function debug(string $message, array $context = []): void
    {
    }
};

// Conexão real: os módulos montam repositórios, e montá-los é justamente o que
// prova que o composition root funciona.
$pdo = \App\Infra\Database\Connection::shared();
$clock = new SystemClock();
$events = new EventDispatcher($logger);

/** @var list<Route> $routes */
$routes = [
    ...AuthModule::routes($pdo, $clock, $logger, 60, false),
    ...CatalogModule::routes($pdo, $logger),
    ...CardModule::routes($pdo, $events, $clock, $logger, '/tmp', 1),
];

$rows = [];

foreach ($routes as $route) {
    $rows[] = [
        'method' => $route->method()->value,
        'path' => $route->path(),
        'level' => $route instanceof Guard ? $route->minimumLevel()->name : 'PÚBLICA',
    ];
}

usort($rows, static fn(array $a, array $b): int => [$a['path'], $a['method']] <=> [$b['path'], $b['method']]);

printf("%-7s  %-34s  %s%s", 'MÉTODO', 'CAMINHO', 'NÍVEL', PHP_EOL);
echo str_repeat('-', 62) . PHP_EOL;

foreach ($rows as $row) {
    printf("%-7s  %-34s  %s%s", $row['method'], $row['path'], $row['level'], PHP_EOL);
}

$public = array_filter($rows, static fn(array $r): bool => $r['level'] === 'PÚBLICA');

echo PHP_EOL . count($rows) . ' rotas, ' . count($public) . ' pública.' . PHP_EOL;

// Rota pública é exceção deliberada e precisa de justificativa escrita
// (PADROES.md §5.1). Mais de uma aqui é sinal de que alguém esqueceu o guard.
if (count($public) > 1) {
    fwrite(STDERR, PHP_EOL . 'ATENÇÃO: mais de uma rota pública. Cada uma precisa de justificativa.' . PHP_EOL);
    exit(1);
}

exit(0);
