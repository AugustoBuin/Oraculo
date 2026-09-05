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
     *
     * Exceções são descritas como o StderrLogger de produção as descreve, e não
     * serializadas cruas. Um `json_encode` de Throwable devolve `{}`, então um
     * dublê ingênuo diria que a mensagem NÃO foi registrada quando ela foi — o
     * antipadrão de mock incompleto do PADROES.md §10.4: o dublê precisa
     * espelhar o comportamento real da fronteira que ele substitui.
     */
    public function everythingLogged(): string
    {
        $parts = [];

        foreach ($this->entries as $entry) {
            $parts[] = $entry['message'];
            $parts[] = json_encode(
                $this->describe($entry['context']),
                JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR
            );
        }

        return implode(' ', $parts);
    }

    /**
     * @param array<array-key,mixed> $context
     * @return array<array-key,mixed>
     */
    private function describe(array $context): array
    {
        $described = [];

        foreach ($context as $key => $value) {
            $described[$key] = match (true) {
                $value instanceof \Throwable => [
                    'class' => $value::class,
                    'message' => $value->getMessage(),
                ],
                is_array($value) => $this->describe($value),
                is_object($value) => $value::class,
                default => $value,
            };
        }

        return $described;
    }
}
