<?php

declare(strict_types=1);

namespace Tests\Infra\Http\Middleware;

use App\Domain\Errors\ValidationError;
use App\Infra\Http\Middleware\JsonBody;
use App\Infra\Http\Middleware\TraceId;
use App\Infra\Http\Pipeline;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Shared\Enum\HttpMethod;
use Tests\TestCase;

final class JsonBodyTest extends TestCase
{
    private function request(HttpMethod $method, string $raw, string $contentType = 'application/json'): Request
    {
        return Request::create(
            method: $method,
            path: '/api/cards',
            headers: $contentType === '' ? [] : ['Content-Type' => $contentType],
            rawBody: $raw,
        );
    }

    private function process(Request $request, ?callable $destination = null): Response
    {
        return (new Pipeline([new JsonBody()]))->process(
            $request,
            $destination ?? fn() => Response::ok([])
        );
    }

    public function testDesserializaOCorpoJsonParaLeituraCampoACampo(): void
    {
        $capturado = null;

        $this->process(
            $this->request(HttpMethod::POST, '{"nameEn":"Black Lotus","namePt":null}'),
            function (Request $request) use (&$capturado): Response {
                $capturado = $request->body('nameEn');
                return Response::ok([]);
            }
        );

        $this->assertSame('Black Lotus', $capturado);
    }

    public function testRecusaJsonMalformadoComErroDeValidacao(): void
    {
        // Sem esta proteção, json_decode devolve null e o código a jusante
        // trata "corpo quebrado" como "campo ausente" — dois problemas
        // diferentes com a mesma resposta.
        $error = $this->assertThrows(
            ValidationError::class,
            fn() => $this->process($this->request(HttpMethod::POST, '{"nameEn": '))
        );

        $this->assertFalse(str_contains($error->getMessage(), 'Syntax error'));
    }

    public function testRecusaCorpoJsonQueNaoSejaObjeto(): void
    {
        $this->assertThrows(
            ValidationError::class,
            fn() => $this->process($this->request(HttpMethod::POST, '"apenas uma string"'))
        );
    }

    public function testAceitaCorpoVazioEmMetodoDeEscrita(): void
    {
        // DELETE não manda corpo, e exigir um seria inventar requisito.
        $response = $this->process($this->request(HttpMethod::DELETE, ''));

        $this->assertSame(200, $response->status->value);
    }

    public function testIgnoraOCorpoQuandoOTipoNaoEhJson(): void
    {
        // O upload é multipart e tem tratamento próprio; tentar desserializar
        // um binário como JSON só produziria um 400 enganoso.
        $response = $this->process(
            $this->request(HttpMethod::POST, '------WebKitFormBoundary', 'multipart/form-data; boundary=x')
        );

        $this->assertSame(200, $response->status->value);
    }

    public function testAceitaContentTypeComCharset(): void
    {
        $capturado = null;

        $this->process(
            $this->request(HttpMethod::POST, '{"nameEn":"Forest"}', 'application/json; charset=utf-8'),
            function (Request $request) use (&$capturado): Response {
                $capturado = $request->body('nameEn');
                return Response::ok([]);
            }
        );

        $this->assertSame('Forest', $capturado);
    }

    public function testTraceIdEhAnexadoAoContextoDaRequisicao(): void
    {
        $capturado = null;

        (new Pipeline([new TraceId()]))->process(
            $this->request(HttpMethod::GET, ''),
            function (Request $request) use (&$capturado): Response {
                $capturado = $request->attribute('traceId');
                return Response::ok([]);
            }
        );

        $this->assertNotNull($capturado);
        $this->assertSame(32, strlen((string) $capturado));
    }
}
