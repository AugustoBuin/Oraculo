<?php

declare(strict_types=1);

namespace App\Infra\Http;

use App\Shared\Enum\HttpMethod;

/**
 * Requisição HTTP como valor imutável.
 *
 * **A decisão de projeto mais importante deste arquivo é uma ausência:** não
 * existe método que devolva o corpo inteiro. Só `body(string $field)`.
 *
 * O corpo repassado inteiro é o que permite mass assignment — o cliente
 * escrevendo `roleLevel`, `createdBy` ou `id` porque alguém fez
 * `$repo->update($id, $request->all())`. Sem o getter, a rota é obrigada a
 * desestruturar campo a campo, e o erro deixa de ser possível
 * (PADROES.md §5.3). Há um teste que falha se um `all()`, `toArray()` ou
 * `input()` for adicionado.
 */
final class Request
{
    /**
     * @param array<string,string> $query
     * @param array<string,string> $headers      chaves normalizadas em minúscula
     * @param array<string,mixed>  $body         preenchido pelo middleware JsonBody
     * @param array<string,string> $routeParams  preenchido pelo Router
     * @param array<string,mixed>  $attributes   preenchido pelos middlewares
     * @param array<string,mixed>  $server
     */
    private function __construct(
        public readonly HttpMethod $method,
        public readonly string $path,
        public readonly string $rawBody,
        private readonly array $query,
        private readonly array $headers,
        private readonly array $cookies,
        private readonly array $body,
        private readonly array $routeParams,
        private readonly array $attributes,
        private readonly array $server,
    ) {
    }

    /**
     * @param array<string,string> $query
     * @param array<string,string> $headers
     * @param array<string,mixed>  $server
     */
    public static function create(
        HttpMethod $method,
        string $path,
        array $query = [],
        array $headers = [],
        string $rawBody = '',
        array $server = [],
        array $cookies = [],
    ): self {
        return new self(
            method: $method,
            path: $path,
            rawBody: $rawBody,
            query: $query,
            headers: self::normalizeHeaders($headers),
            cookies: $cookies,
            body: [],
            routeParams: [],
            attributes: [],
            server: $server,
        );
    }

    public static function fromGlobals(): self
    {
        // REQUEST_URI e não PATH_INFO: o caminho público é o que os documentos
        // de contrato descrevem ('/api/cards/12'), e não depende de como o
        // servidor foi configurado para chegar até o front controller.
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = (string) (parse_url($uri, PHP_URL_PATH) ?? '/');

        $method = HttpMethod::tryFrom(strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')))
            ?? HttpMethod::GET;

        return new self(
            method: $method,
            path: $path,
            rawBody: (string) file_get_contents('php://input'),
            query: self::onlyStrings($_GET),
            headers: self::normalizeHeaders(self::headersFromServer($_SERVER)),
            cookies: self::onlyStrings($_COOKIE),
            body: [],
            routeParams: [],
            attributes: [],
            server: $_SERVER,
        );
    }

    /**
     * Um cookie por nome.
     *
     * O cookie de sessão é HttpOnly, então o JavaScript nunca o lê — só o
     * servidor, por aqui.
     */
    public function cookie(string $name): ?string
    {
        return $this->cookies[$name] ?? null;
    }

    /**
     * O CONTEÚDO de um arquivo enviado, por nome de campo.
     *
     * Devolve os bytes, e não o registro de `$_FILES`: o nome original e o tipo
     * declarado pelo cliente são dados hostis, e nada aqui deve tornar fácil
     * usá-los por engano. Quem valida o tipo olha o conteúdo (ADR-008).
     */
    public function uploadedFileContents(string $field): ?string
    {
        $file = $_FILES[$field] ?? null;

        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return null;
        }

        $temporaryPath = $file['tmp_name'] ?? null;

        // is_uploaded_file garante que o caminho veio de um upload HTTP desta
        // requisição, e não de um valor forjado apontando para outro arquivo.
        if (!is_string($temporaryPath) || !is_uploaded_file($temporaryPath)) {
            return null;
        }

        $contents = file_get_contents($temporaryPath);

        return $contents === false ? null : $contents;
    }

    public function query(string $key): ?string
    {
        return $this->query[$key] ?? null;
    }

    /**
     * Um campo do corpo. Nunca o corpo inteiro — ver o cabeçalho da classe.
     */
    public function body(string $field): mixed
    {
        return $this->body[$field] ?? null;
    }

    /**
     * Distingue "campo não enviado" de "campo enviado como nulo".
     *
     * A diferença importa numa edição parcial: não mandar `namePt` e mandar
     * `namePt: null` são intenções diferentes.
     */
    public function hasBody(string $field): bool
    {
        return array_key_exists($field, $this->body);
    }

    public function param(string $name): ?string
    {
        return $this->routeParams[$name] ?? null;
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function attribute(string $key): mixed
    {
        return $this->attributes[$key] ?? null;
    }

    public function ip(): ?string
    {
        // Deliberadamente sem X-Forwarded-For: é cabeçalho do cliente e pode
        // ser forjado. Confiar nele quebraria o limite de tentativas por IP.
        // Se um proxy reverso entrar na frente, o valor confiável passa a ser
        // configuração de servidor, não leitura de cabeçalho.
        $ip = $this->server['REMOTE_ADDR'] ?? null;

        return is_string($ip) ? $ip : null;
    }

    public function userAgent(): ?string
    {
        $agent = $this->server['HTTP_USER_AGENT'] ?? null;

        return is_string($agent) ? $agent : null;
    }

    public function changesState(): bool
    {
        return $this->method->changesState();
    }

    public function contentType(): ?string
    {
        return $this->header('Content-Type');
    }

    /** @param array<string,mixed> $body */
    public function withBody(array $body): self
    {
        return $this->derive(body: $body);
    }

    /** @param array<string,string> $params */
    public function withRouteParams(array $params): self
    {
        return $this->derive(routeParams: $params);
    }

    public function withAttribute(string $key, mixed $value): self
    {
        return $this->derive(attributes: [$key => $value] + $this->attributes);
    }

    /**
     * @param array<string,mixed>|null  $body
     * @param array<string,string>|null $routeParams
     * @param array<string,mixed>|null  $attributes
     */
    private function derive(?array $body = null, ?array $routeParams = null, ?array $attributes = null): self
    {
        return new self(
            method: $this->method,
            path: $this->path,
            rawBody: $this->rawBody,
            query: $this->query,
            headers: $this->headers,
            cookies: $this->cookies,
            body: $body ?? $this->body,
            routeParams: $routeParams ?? $this->routeParams,
            attributes: $attributes ?? $this->attributes,
            server: $this->server,
        );
    }

    /**
     * O que não é texto não é parâmetro.
     *
     * `?page[]=1` entrega um ARRAY em `$_GET`, e converter array em string
     * emite aviso — que o front controller transforma em exceção. Como isto
     * corre em `fromGlobals()`, ANTES do pipeline, a exceção alcançava toda
     * rota `/api/*` sem passar por guard nenhum: 500 para quem nem estava
     * autenticado, e uma pilha inteira no log a cada requisição (OF-001).
     *
     * Descartar, e não lançar, é deliberado: aqui é fora do `ErrorBoundary`, e
     * uma exceção sairia sem os cabeçalhos de segurança que o pipeline aplica.
     * Parâmetro descartado é parâmetro ausente, e ausente toda rota já sabe
     * tratar — com o padrão dela, ou com o erro de validação que é dela.
     *
     * @param  array<mixed> $values
     * @return array<string,string>
     */
    private static function onlyStrings(array $values): array
    {
        $strings = [];

        foreach ($values as $name => $value) {
            if (is_scalar($value)) {
                $strings[(string) $name] = (string) $value;
            }
        }

        return $strings;
    }

    /**
     * @param array<string,string> $headers
     * @return array<string,string>
     */
    private static function normalizeHeaders(array $headers): array
    {
        $normalized = [];

        foreach ($headers as $name => $value) {
            $normalized[strtolower($name)] = $value;
        }

        return $normalized;
    }

    /**
     * @param array<string,mixed> $server
     * @return array<string,string>
     */
    private static function headersFromServer(array $server): array
    {
        $headers = [];

        foreach ($server as $key => $value) {
            if (!is_string($key) || !is_string($value)) {
                continue;
            }

            if (str_starts_with($key, 'HTTP_')) {
                $name = str_replace('_', '-', substr($key, 5));
                $headers[$name] = $value;
                continue;
            }

            // CONTENT_TYPE e CONTENT_LENGTH não recebem o prefixo HTTP_.
            if ($key === 'CONTENT_TYPE' || $key === 'CONTENT_LENGTH') {
                $headers[str_replace('_', '-', $key)] = $value;
            }
        }

        return $headers;
    }
}
