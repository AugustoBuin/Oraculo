<?php

declare(strict_types=1);

namespace App\Shared\Observability;

/**
 * Log estruturado, uma linha JSON por evento, na saída de erro do contêiner.
 *
 * O Docker coleta stderr, então não há arquivo para rotacionar nem tabela para
 * cair — o armazenamento de log é dependência fraca: se o coletor parar, a
 * aplicação continua respondendo (PADROES.md §6, regra 7).
 *
 * A redação de dado sensível é automática e central (regra 4). Isso existe por
 * causa de um incidente concreto: a única forma de depurar um envio foi ampliar
 * permanentemente a exposição de token e telefone no log, e a mudança ficou em
 * produção por mais de um mês. Redigir na mão, caso a caso, é o que garante que
 * um dia alguém esqueça.
 */
final class StderrLogger implements Logger
{
    private const REDACTED = '***';

    /**
     * Nomes de campo cujo VALOR nunca pode ser registrado.
     *
     * Casa por substring e sem diferenciar maiúsculas, de propósito: pega
     * `password`, `password_hash`, `senha`, `csrfToken`, `apiKey`,
     * `authorization` — e o campo novo que alguém criar amanhã seguindo a mesma
     * nomenclatura.
     */
    private const SENSITIVE_FRAGMENTS = [
        'pass', 'senha', 'token', 'secret', 'segredo',
        'authorization', 'apikey', 'api_key', 'credential', 'hash',
    ];

    /** @var callable(string): void */
    private $writer;

    /**
     * @param (callable(string): void)|null $writer permite ao teste capturar a
     *        linha sem depender do stderr do processo
     */
    public function __construct(
        private readonly string $channel,
        private readonly string $traceId,
        ?callable $writer = null,
    ) {
        $this->writer = $writer ?? static function (string $line): void {
            file_put_contents('php://stderr', $line);
        };
    }

    public function error(string $message, array $context = []): void
    {
        $this->write('error', $message, $context);
    }

    public function warning(string $message, array $context = []): void
    {
        $this->write('warning', $message, $context);
    }

    public function info(string $message, array $context = []): void
    {
        $this->write('info', $message, $context);
    }

    public function debug(string $message, array $context = []): void
    {
        $this->write('debug', $message, $context);
    }

    /** @param array<string,mixed> $context */
    private function write(string $level, string $message, array $context): void
    {
        $line = json_encode(
            [
                'timestamp' => date(DATE_ATOM),
                'level' => $level,
                'channel' => $this->channel,
                'traceId' => $this->traceId,
                'message' => $message,
                'context' => $this->sanitize($context),
            ],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR
        );

        // Uma linha por evento: quebra interna faz qualquer coletor ler metade
        // de um evento como um evento inteiro. json_encode escapa \n dentro dos
        // valores, então a única quebra é a que fecha a linha.
        ($this->writer)($line . PHP_EOL);
    }

    /**
     * @param array<array-key,mixed> $context
     * @return array<array-key,mixed>
     */
    private function sanitize(array $context): array
    {
        $clean = [];

        foreach ($context as $key => $value) {
            if (is_string($key) && $this->isSensitive($key)) {
                $clean[$key] = self::REDACTED;
                continue;
            }

            $clean[$key] = match (true) {
                is_array($value) => $this->sanitize($value),
                // Exceção vira {} num json_encode ingênuo, e o detalhe que
                // motivou o log some justamente do log.
                $value instanceof \Throwable => $this->describeThrowable($value),
                is_object($value) => $value::class,
                default => $value,
            };
        }

        return $clean;
    }

    private function isSensitive(string $key): bool
    {
        $normalized = strtolower($key);

        foreach (self::SENSITIVE_FRAGMENTS as $fragment) {
            if (str_contains($normalized, $fragment)) {
                return true;
            }
        }

        return false;
    }

    /** @return array<string,string> */
    private function describeThrowable(\Throwable $throwable): array
    {
        return [
            'class' => $throwable::class,
            'message' => $throwable->getMessage(),
            'origin' => $throwable->getFile() . ':' . $throwable->getLine(),
        ];
    }
}
