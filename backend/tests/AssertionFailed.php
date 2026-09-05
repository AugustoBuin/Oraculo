<?php

declare(strict_types=1);

namespace Tests;

/**
 * Falha de asserção.
 *
 * Guarda o esperado e o recebido separados da mensagem para que o runner possa
 * formatá-los lado a lado: "esperava X, recebeu Y" é o que faz um teste
 * vermelho ser útil sem abrir o arquivo.
 */
final class AssertionFailed extends \RuntimeException
{
    public function __construct(
        string $message,
        public readonly mixed $expected,
        public readonly mixed $actual,
    ) {
        parent::__construct($message);
    }

    /**
     * Representação curta e legível de qualquer valor, para a saída do runner.
     */
    public static function describe(mixed $value): string
    {
        if ($value === null) {
            return 'null';
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_string($value)) {
            return '"' . $value . '"';
        }

        if (is_scalar($value)) {
            return (string) $value;
        }

        if (is_array($value)) {
            return 'array(' . count($value) . ') ' . json_encode(
                $value,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR
            );
        }

        if (is_object($value)) {
            return get_class($value);
        }

        return gettype($value);
    }
}
