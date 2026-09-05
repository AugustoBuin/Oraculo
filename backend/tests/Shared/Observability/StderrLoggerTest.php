<?php

declare(strict_types=1);

namespace Tests\Shared\Observability;

use App\Shared\Observability\StderrLogger;
use Tests\TestCase;

/**
 * A redação de dado sensível é automática e central (PADROES.md §6, regra 4).
 *
 * Isto existe por causa de um incidente registrado: a única forma de depurar um
 * envio foi ampliar permanentemente a exposição de token e telefone no log, e a
 * mudança ficou em produção por mais de um mês. Redigir na mão, caso a caso,
 * é o que garante que um dia alguém esqueça.
 */
final class StderrLoggerTest extends TestCase
{
    /**
     * Captura a linha escrita, sem depender do stderr real do processo.
     *
     * O coletor é um ArrayObject e não um array: desestruturar `[$sut, $lines]`
     * copia o valor, e a referência para o array capturado pelo closure se
     * perderia.
     *
     * @return array{0: StderrLogger, 1: \ArrayObject<int,string>}
     */
    private function makeSut(): array
    {
        /** @var \ArrayObject<int,string> $lines */
        $lines = new \ArrayObject();

        $sut = new StderrLogger(
            channel: 'http',
            traceId: 'abc123',
            writer: static function (string $line) use ($lines): void {
                $lines[] = $line;
            }
        );

        return [$sut, $lines];
    }

    private function decode(string $line): array
    {
        return json_decode($line, true, 512, JSON_THROW_ON_ERROR);
    }

    public function testEscreveLinhaEstruturadaComCanalENivel(): void
    {
        [$sut, $lines] = $this->makeSut();

        $sut->error('Falha ao salvar a carta', ['cardId' => 12]);

        $entrada = $this->decode($lines[0]);

        $this->assertSame('error', $entrada['level']);
        $this->assertSame('http', $entrada['channel']);
        $this->assertSame('Falha ao salvar a carta', $entrada['message']);
        $this->assertSame(12, $entrada['context']['cardId']);
    }

    public function testIncluiOTraceIdEmTodaLinha(): void
    {
        [$sut, $lines] = $this->makeSut();

        $sut->info('primeira');
        $sut->warning('segunda');

        // Correlação: sem o traceId em toda linha, não há como reconstruir o
        // que aconteceu numa requisição específica.
        $this->assertSame('abc123', $this->decode($lines[0])['traceId']);
        $this->assertSame('abc123', $this->decode($lines[1])['traceId']);
    }

    public function testRedigeSegredoNoPrimeiroNivel(): void
    {
        [$sut, $lines] = $this->makeSut();

        $sut->error('login', ['email' => 'a@b.com', 'password' => 'segredo123']);

        $contexto = $this->decode($lines[0])['context'];

        $this->assertSame('***', $contexto['password']);
        $this->assertSame('a@b.com', $contexto['email']);
    }

    public function testRedigeSegredoEmQualquerProfundidade(): void
    {
        [$sut, $lines] = $this->makeSut();

        $sut->error('requisicao', [
            'payload' => ['user' => ['senha' => 'x', 'csrfToken' => 'y', 'nome' => 'Ana']],
        ]);

        $aninhado = $this->decode($lines[0])['context']['payload']['user'];

        $this->assertSame('***', $aninhado['senha']);
        $this->assertSame('***', $aninhado['csrfToken']);
        $this->assertSame('Ana', $aninhado['nome']);
    }

    public function testRedigeAsVariacoesDeNomeDeSegredo(): void
    {
        [$sut, $lines] = $this->makeSut();

        $sut->error('varredura', [
            'password' => 'a', 'senha' => 'b', 'password_hash' => 'c',
            'token' => 'd', 'csrf_token' => 'e', 'authorization' => 'f',
            'secret' => 'g', 'apiKey' => 'h',
        ]);

        foreach ($this->decode($lines[0])['context'] as $campo => $valor) {
            $this->assertSame('***', $valor, "O campo {$campo} precisa ser redigido.");
        }
    }

    public function testEscreveUmaLinhaPorEntradaSemQuebraInterna(): void
    {
        [$sut, $lines] = $this->makeSut();

        $sut->error("mensagem com\nquebra de linha");

        // Log estruturado com quebra interna deixa de ser uma linha por evento,
        // e qualquer coletor passa a ler metade de um evento como um evento.
        $this->assertSame(1, substr_count($lines[0], "\n"));
        $this->assertTrue(str_ends_with($lines[0], "\n"));
    }

    public function testSerializaExcecaoSemPerderAMensagem(): void
    {
        [$sut, $lines] = $this->makeSut();

        $sut->error('falhou', ['error' => new \RuntimeException('SQLSTATE[23000]')]);

        // Objeto de exceção vira {} num json_encode ingênuo, e o detalhe que
        // motivou o log some justamente do log.
        $this->assertTrue(str_contains($lines[0], 'SQLSTATE[23000]'));
    }
}
