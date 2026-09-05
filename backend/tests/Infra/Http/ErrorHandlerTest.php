<?php

declare(strict_types=1);

namespace Tests\Infra\Http;

use App\Domain\Errors\ConflictError;
use App\Domain\Errors\DomainError;
use App\Domain\Errors\ForbiddenError;
use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\PayloadTooLargeError;
use App\Domain\Errors\TooManyRequestsError;
use App\Domain\Errors\UnauthorizedError;
use App\Domain\Errors\UnsupportedMediaTypeError;
use App\Domain\Errors\ValidationError;
use App\Infra\Http\ErrorHandler;
use App\Shared\Enum\HttpStatus;
use Tests\Doubles\SpyLogger;
use Tests\TestCase;

/**
 * O ÚNICO tradutor erro -> status do sistema.
 *
 * Esta suíte existe por causa de um incidente registrado no PADROES.md §4:
 * quando cada rota escolhia o próprio status, a API tinha dois envelopes de
 * erro divergentes e o cliente recebia 400 para tudo.
 */
final class ErrorHandlerTest extends TestCase
{
    /** @return array{0: ErrorHandler, 1: SpyLogger} */
    private function makeSut(): array
    {
        $logger = new SpyLogger();

        return [new ErrorHandler($logger), $logger];
    }

    public function testMapeiaCadaErroDeDominioParaOSeuStatus(): void
    {
        [$sut] = $this->makeSut();

        $esperado = [
            [new ValidationError('Verifique os campos destacados.'), HttpStatus::BAD_REQUEST],
            [new UnauthorizedError('Sessão expirada.'), HttpStatus::UNAUTHORIZED],
            [new ForbiddenError('Você não tem permissão.'), HttpStatus::FORBIDDEN],
            [new NotFoundError('Carta não encontrada.'), HttpStatus::NOT_FOUND],
            [new ConflictError('Já existe uma carta com este nome.'), HttpStatus::CONFLICT],
            [new PayloadTooLargeError('Imagem acima do limite.'), HttpStatus::PAYLOAD_TOO_LARGE],
            [new UnsupportedMediaTypeError('Formato não permitido.'), HttpStatus::UNSUPPORTED_MEDIA_TYPE],
            [new TooManyRequestsError('Muitas tentativas.'), HttpStatus::TOO_MANY_REQUESTS],
            [new DomainError('Regra de negócio violada.'), HttpStatus::BAD_REQUEST],
        ];

        foreach ($esperado as [$error, $status]) {
            $response = $sut->toResponse($error);

            $this->assertSame(
                $status,
                $response->status,
                'Status errado para ' . get_class($error)
            );
        }
    }

    public function testPreservaAMensagemDeDominioParaOUsuario(): void
    {
        [$sut] = $this->makeSut();

        $response = $sut->toResponse(new NotFoundError('Carta não encontrada.'));

        $this->assertSame('Carta não encontrada.', $response->body['message']);
    }

    public function testConverteExcecaoGenericaEmQuinhentosComMensagemNeutra(): void
    {
        [$sut] = $this->makeSut();

        $response = $sut->toResponse(new \RuntimeException('SQLSTATE[23000] Duplicate entry'));

        $this->assertSame(HttpStatus::INTERNAL_SERVER_ERROR, $response->status);
        $this->assertSame('Erro interno. Tente novamente.', $response->body['message']);
    }

    public function testNaoVazaTextoTecnicoDeExcecaoGenericaParaOCliente(): void
    {
        [$sut] = $this->makeSut();

        $response = $sut->toResponse(
            new \PDOException('SQLSTATE[23000]: Integrity constraint violation: 1062 Duplicate entry for key uk_cards_name')
        );

        $corpo = json_encode($response->body, JSON_UNESCAPED_UNICODE);

        foreach (['SQLSTATE', 'constraint', 'uk_cards_name', 'Duplicate entry', 'PDOException'] as $proibido) {
            $this->assertFalse(
                str_contains($corpo, $proibido),
                "O corpo da resposta não pode conter \"{$proibido}\"."
            );
        }
    }

    public function testRegistraOTextoCruDaExcecaoGenericaNoLog(): void
    {
        [$sut, $logger] = $this->makeSut();

        $sut->toResponse(new \RuntimeException('SQLSTATE[23000] Duplicate entry'));

        // O detalhe tem que existir em ALGUM lugar; o lugar é o log.
        $this->assertTrue(str_contains($logger->everythingLogged(), 'SQLSTATE[23000] Duplicate entry'));
    }

    public function testNaoRegistraErroDeDominioComoFalhaDoSistema(): void
    {
        [$sut, $logger] = $this->makeSut();

        $sut->toResponse(new ValidationError('O nome em inglês é obrigatório.'));

        // Erro de domínio é fluxo esperado, não incidente: poluir o log de erro
        // com validação de formulário esconde a falha que importa.
        $this->assertCount(0, $logger->entries);
    }

    public function testExpoeOMapaDeCamposDoErroDeValidacao(): void
    {
        [$sut] = $this->makeSut();

        $error = ValidationError::fields([
            'nameEn' => 'O nome em inglês é obrigatório.',
            'editionId' => 'A edição selecionada não pertence ao jogo escolhido.',
        ]);

        $response = $sut->toResponse($error);

        $this->assertSame(
            'A edição selecionada não pertence ao jogo escolhido.',
            $response->body['errors']['editionId']
        );
    }

    public function testOmiteAChaveDeErrosQuandoNaoHaCampos(): void
    {
        [$sut] = $this->makeSut();

        $response = $sut->toResponse(new ValidationError('Corpo da requisição inválido.'));

        $this->assertFalse(array_key_exists('errors', $response->body));
    }

    public function testExpoeDetalhesDeclaradosPeloErroDeConflito(): void
    {
        [$sut] = $this->makeSut();

        $error = new ConflictError('Já existe uma carta com este nome nesta edição.', [
            'duplicate' => ['id' => 8, 'nameEn' => 'Forest'],
        ]);

        $response = $sut->toResponse($error);

        $this->assertSame(8, $response->body['duplicate']['id']);
    }

    public function testRespondeSempreEmJson(): void
    {
        [$sut] = $this->makeSut();

        $response = $sut->toResponse(new NotFoundError('Carta não encontrada.'));

        $this->assertSame('application/json; charset=utf-8', $response->headers['Content-Type']);
    }
}
