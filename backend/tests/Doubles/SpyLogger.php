<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Shared\Observability\Logger;

/**
 * Logger que guarda o que recebeu, para os testes verificarem que o texto cru
 * de uma falha foi registrado — e não devolvido ao cliente.
 */
final class SpyLogger implements Logger
{
    /** @var list<array{level: string, message: string, context: array<string,mixed>}> */
    public array $entries = [];

    public function error(string $message, array $context = []): void
    {
        $this->entries[] = ['level' => 'error', 'message' => $message, 'context' => $context];
    }

    public function warning(string $message, array $context = []): void
    {
        $this->entries[] = ['level' => 'warning', 'message' => $message, 'context' => $context];
    }

    public function info(string $message, array $context = []): void
    {
        $this->entries[] = ['level' => 'info', 'message' => $message, 'context' => $context];
    }

    public function debug(string $message, array $context = []): void
    {
        $this->entries[] = ['level' => 'debug', 'message' => $message, 'context' => $context];
    }

    /**
     * Tudo que foi registrado, concatenado — para asserções do tipo
     * "o texto do banco apareceu no log".
     */
    public function everythingLogged(): string
    {
        $parts = [];

        foreach ($this->entries as $entry) {
            $parts[] = $entry['message'];
            $parts[] = json_encode($entry['context'], JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        }

        return implode(' ', $parts);
    }
}
