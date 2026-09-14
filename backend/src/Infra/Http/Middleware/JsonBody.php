<?php

declare(strict_types=1);

namespace App\Infra\Http\Middleware;

use App\Domain\Errors\ValidationError;
use App\Infra\Http\Request;
use App\Infra\Http\Response;

/**
 * Desserializa o corpo JSON com proteção.
 *
 * Sem isto, `json_decode` devolve null diante de um corpo quebrado e o código
 * a jusante trata "corpo malformado" como "campo ausente" — dois problemas
 * diferentes produzindo a mesma resposta, e o cliente sem saber qual dos dois
 * aconteceu.
 *
 * O texto do erro do parser não vai para a resposta: "Syntax error, malformed
 * JSON at offset 14" é mensagem de desenvolvedor, não de usuário.
 */
final class JsonBody implements Middleware
{
    private const JSON_CONTENT_TYPE = 'application/json';
    private const MAX_DEPTH = 32;

    public function handle(Request $request, callable $next): Response
    {
        if (!$this->isJson($request) || trim($request->rawBody) === '') {
            // Corpo vazio é legítimo: DELETE não manda corpo, e exigir um seria
            // inventar requisito. Upload é multipart e tem tratamento próprio.
            return $next($request);
        }

        try {
            $decoded = json_decode($request->rawBody, true, self::MAX_DEPTH, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new ValidationError('O corpo da requisição não é um JSON válido.');
        }

        if (!is_array($decoded) || array_is_list($decoded)) {
            throw new ValidationError('O corpo da requisição precisa ser um objeto JSON.');
        }

        return $next($request->withBody($decoded));
    }

    private function isJson(Request $request): bool
    {
        $contentType = $request->contentType();

        // O cabeçalho costuma vir com charset: 'application/json; charset=utf-8'.
        return $contentType !== null && str_contains(strtolower($contentType), self::JSON_CONTENT_TYPE);
    }
}
