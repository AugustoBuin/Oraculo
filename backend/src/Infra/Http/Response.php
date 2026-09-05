<?php

declare(strict_types=1);

namespace App\Infra\Http;

use App\Shared\Enum\HttpStatus;

/**
 * Resposta HTTP como valor imutável.
 *
 * As rotas **devolvem** uma Response em vez de escrever na saída. Isso é o que
 * torna rota e tradutor de erro testáveis sem servidor: o teste inspeciona
 * status, cabeçalho e corpo como dados. `send()` é chamado uma única vez, pelo
 * front controller.
 */
final class Response
{
    private const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

    /**
     * @param array<string,mixed>  $body
     * @param array<string,string> $headers
     */
    private function __construct(
        public readonly HttpStatus $status,
        public readonly array $body,
        public readonly array $headers,
    ) {
    }

    /**
     * @param array<string,mixed>  $body
     * @param array<string,string> $headers
     */
    public static function json(HttpStatus $status, array $body, array $headers = []): self
    {
        return new self($status, $body, ['Content-Type' => self::JSON_CONTENT_TYPE] + $headers);
    }

    /** @param array<string,mixed> $data */
    public static function ok(array $data): self
    {
        return self::json(HttpStatus::OK, ['data' => $data]);
    }

    /** @param array<string,mixed> $data */
    public static function created(array $data, string $location): self
    {
        return self::json(HttpStatus::CREATED, ['data' => $data], ['Location' => $location]);
    }

    public static function noContent(): self
    {
        return new self(HttpStatus::NO_CONTENT, [], []);
    }

    public function withHeader(string $name, string $value): self
    {
        return new self($this->status, $this->body, [$name => $value] + $this->headers);
    }

    /**
     * Acrescenta cabeçalhos, sobrescrevendo os existentes.
     *
     * @param array<string,string> $headers
     */
    public function withHeaders(array $headers): self
    {
        return new self($this->status, $this->body, $headers + $this->headers);
    }

    /**
     * Acrescenta cabeçalhos apenas onde ainda não há valor.
     *
     * É o que o middleware de segurança usa: ele estabelece a linha de base,
     * mas quem conhece o recurso é a rota. Sobrescrever aqui apagaria, por
     * exemplo, o `Content-Type` de uma imagem servida por rota.
     *
     * @param array<string,string> $headers
     */
    public function withDefaultHeaders(array $headers): self
    {
        return new self($this->status, $this->body, $this->headers + $headers);
    }

    public function send(): void
    {
        // Em teste ou depois de uma saída acidental, mexer em cabeçalho lança
        // warning e polui a resposta. Falhar em silêncio aqui é melhor do que
        // corromper o corpo com um aviso do PHP.
        if (!headers_sent()) {
            http_response_code($this->status->value);

            foreach ($this->headers as $name => $value) {
                header("{$name}: {$value}");
            }
        }

        if (!$this->status->hasBody()) {
            return;
        }

        echo json_encode(
            $this->body,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
    }
}
