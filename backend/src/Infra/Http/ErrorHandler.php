<?php

declare(strict_types=1);

namespace App\Infra\Http;

use App\Domain\Errors\DomainError;
use App\Shared\Enum\HttpStatus;
use App\Shared\Observability\Logger;

/**
 * O ÚNICO tradutor erro -> status do sistema.
 *
 * Esta classe existe por causa de um incidente concreto (PADROES.md §4): quando
 * cada rota escolhia o próprio status, a API acabou com dois envelopes de erro
 * divergentes e o cliente recebia 400 para tudo. Centralizar resolve — mas só
 * funciona se a outra metade da regra for cumprida: **as exceções cruas
 * precisam ser convertidas para a classe de domínio certa** lá onde nascem.
 *
 * Regra de revisão que decorre daqui: o status é **escolhido** aqui (ou pela
 * rota, ao devolver uma Response de sucesso) e **emitido** só em
 * `Response::send()`. Um `http_response_code()` em qualquer outro lugar é
 * achado CRÍTICO.
 */
final class ErrorHandler
{
    private const GENERIC_MESSAGE = 'Erro interno. Tente novamente.';

    public function __construct(
        private readonly Logger $logger,
    ) {
    }

    public function toResponse(\Throwable $error): Response
    {
        if ($error instanceof DomainError) {
            return $this->fromDomain($error);
        }

        return $this->fromUnexpected($error);
    }

    /**
     * Erro de domínio é fluxo esperado, não incidente.
     *
     * Não vai para o log de erro de propósito: encher o log com validação de
     * formulário esconde a falha que de fato importa. A mensagem já nasceu
     * segura para o cliente — é a razão de a classe existir.
     */
    private function fromDomain(DomainError $error): Response
    {
        // A mensagem vem primeiro na união para que nenhum `details` consiga
        // sobrescrevê-la por acidente.
        $body = ['message' => $error->getMessage()] + $error->details();

        return Response::json($error->status(), $body);
    }

    /**
     * Qualquer outra Throwable.
     *
     * O cliente recebe uma frase neutra; o texto original — SQLSTATE, nome de
     * coluna, caminho de arquivo, stack — fica SÓ no log. Vazar isso na
     * resposta entrega ao atacante o mapa do banco de graça.
     */
    private function fromUnexpected(\Throwable $error): Response
    {
        $this->logger->error('Falha não tratada', [
            'exception' => $error::class,
            'message' => $error->getMessage(),
            'origin' => $error->getFile() . ':' . $error->getLine(),
            'trace' => $error->getTraceAsString(),
        ]);

        return Response::json(
            HttpStatus::INTERNAL_SERVER_ERROR,
            ['message' => self::GENERIC_MESSAGE]
        );
    }
}
