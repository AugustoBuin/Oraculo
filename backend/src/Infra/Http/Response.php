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
     * Corpo bruto, quando a resposta não é JSON — uma imagem servida por rota.
     * Nulo em todo o resto, que é a esmagadora maioria.
     */
    private ?string $rawBody = null;

    /**
     * @param array<string,mixed>  $body
     * @param array<string,string> $headers
     */
    private function __construct(
        public readonly HttpStatus $status,
        public readonly array $body,
        public readonly array $headers,
        /** @var list<Cookie> */
        public readonly array $cookies = [],
    ) {
    }

    /**
     * Acrescenta um cookie à resposta.
     *
     * Lista e não mapa: uma resposta pode precisar emitir mais de um Set-Cookie,
     * e cabeçalho repetido é legítimo neste caso específico.
     */
    public function withCookie(Cookie $cookie): self
    {
        return $this->carryRawBody(new self($this->status, $this->body, $this->headers, [...$this->cookies, $cookie]));
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

    /**
     * Resposta com corpo bruto — uma imagem, por exemplo.
     *
     * O Content-Type vem de quem chama, e precisa ser o tipo **verificado na
     * gravação**, nunca um adivinhado a partir da extensão do arquivo.
     *
     * @param array<string,string> $headers
     */
    public static function binary(string $contents, string $contentType, array $headers = []): self
    {
        $response = new self(HttpStatus::OK, [], ['Content-Type' => $contentType] + $headers);
        $response->rawBody = $contents;

        return $response;
    }

    public function withHeader(string $name, string $value): self
    {
        return $this->carryRawBody(new self($this->status, $this->body, [$name => $value] + $this->headers, $this->cookies));
    }

    /**
     * Acrescenta cabeçalhos, sobrescrevendo os existentes.
     *
     * @param array<string,string> $headers
     */
    public function withHeaders(array $headers): self
    {
        return $this->carryRawBody(new self($this->status, $this->body, $headers + $this->headers, $this->cookies));
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
        return $this->carryRawBody(new self($this->status, $this->body, $this->headers + $headers, $this->cookies));
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

            // `false` no segundo argumento: Set-Cookie é o caso legítimo de
            // cabeçalho repetido, e substituir apagaria o cookie anterior.
            foreach ($this->cookies as $cookie) {
                header('Set-Cookie: ' . $cookie->toHeaderValue(), false);
            }
        }

        if (!$this->status->hasBody()) {
            return;
        }

        if ($this->rawBody !== null) {
            echo $this->rawBody;

            return;
        }

        echo json_encode(
            $this->body,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
    }

    /**
     * Copia o corpo bruto para a resposta derivada.
     *
     * Sem isto, passar uma imagem pelo middleware de cabeçalhos de segurança —
     * que deriva a resposta — devolveria um corpo vazio.
     */
    private function carryRawBody(self $derived): self
    {
        $derived->rawBody = $this->rawBody;

        return $derived;
    }
}
