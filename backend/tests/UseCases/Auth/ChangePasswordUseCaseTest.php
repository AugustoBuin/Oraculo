<?php

declare(strict_types=1);

namespace Tests\UseCases\Auth;

use App\Domain\Errors\UnauthorizedError;
use App\Domain\Errors\ValidationError;
use App\Domain\Session\Entity\Session;
use App\UseCases\Auth\ChangePasswordInput;
use App\UseCases\Auth\ChangePasswordUseCase;
use Tests\Doubles\FrozenClock;
use Tests\Doubles\InMemorySessionGateway;
use Tests\Doubles\InMemoryUserGateway;
use Tests\Doubles\SpyLogger;
use Tests\TestCase;

/**
 * Troca de senha.
 *
 * A regra que dá sentido a tudo isto: trocar a senha encerra TODAS as sessões
 * do usuário (RF-05, PADROES.md §5.4). Sem isso, quem troca a senha justamente
 * porque desconfia de acesso indevido continua com o invasor logado.
 */
final class ChangePasswordUseCaseTest extends TestCase
{
    private const SENHA_ATUAL = 'senha-atual-123';

    private InMemoryUserGateway $users;
    private InMemorySessionGateway $sessions;

    private function makeSut(): ChangePasswordUseCase
    {
        $clock = new FrozenClock();
        $this->users = new InMemoryUserGateway();
        $this->sessions = new InMemorySessionGateway();

        $this->users->add(id: 7, email: 'editor@oraculo.local', password: self::SENHA_ATUAL);

        // Três sessões abertas: navegador de casa, do trabalho e celular.
        foreach (range(1, 3) as $ignored) {
            $this->sessions->save(Session::start(7, 43200, $clock->now()));
        }
        // E uma de outro usuário, que não pode ser afetada.
        $this->sessions->save(Session::start(8, 43200, $clock->now()));

        return ChangePasswordUseCase::create($this->users, $this->sessions, new SpyLogger());
    }

    private function input(string $atual = self::SENHA_ATUAL, string $nova = 'nova-senha-forte'): ChangePasswordInput
    {
        return new ChangePasswordInput(
            userId: 7,
            currentPassword: $atual,
            newPassword: $nova,
        );
    }

    public function testTrocaAHashDaSenha(): void
    {
        $sut = $this->makeSut();

        $sut->execute($this->input());

        $credenciais = $this->users->findCredentialsByEmail('editor@oraculo.local');
        $this->assertTrue($credenciais->matches('nova-senha-forte'));
        $this->assertFalse($credenciais->matches(self::SENHA_ATUAL));
    }

    public function testEncerraTodasAsSessoesDoUsuario(): void
    {
        $sut = $this->makeSut();

        $sut->execute($this->input());

        $doUsuario = array_filter(
            $this->sessions->sessions,
            static fn(Session $s): bool => $s->userId === 7
        );

        $this->assertCount(0, $doUsuario);
    }

    public function testNaoEncerraSessoesDeOutrosUsuarios(): void
    {
        $sut = $this->makeSut();

        $sut->execute($this->input());

        $this->assertCount(1, $this->sessions->sessions);
    }

    public function testRecusaSenhaAtualErrada(): void
    {
        $sut = $this->makeSut();

        $this->assertThrows(
            UnauthorizedError::class,
            fn() => $sut->execute($this->input(atual: 'chute'))
        );
    }

    public function testNaoTrocaNemEncerraSessoesQuandoASenhaAtualEstaErrada(): void
    {
        $sut = $this->makeSut();

        try {
            $sut->execute($this->input(atual: 'chute'));
        } catch (UnauthorizedError) {
        }

        // O efeito que não pode acontecer: sem esta asserção, uma ordem
        // invertida — encerrar sessões antes de conferir — passaria.
        $this->assertCount(4, $this->sessions->sessions);
        $this->assertTrue(
            $this->users->findCredentialsByEmail('editor@oraculo.local')->matches(self::SENHA_ATUAL)
        );
    }

    public function testRecusaSenhaNovaCurtaDemais(): void
    {
        $sut = $this->makeSut();

        $erro = $this->assertThrows(
            ValidationError::class,
            fn() => $sut->execute($this->input(nova: 'curta'))
        );

        $this->assertTrue(array_key_exists('newPassword', $erro->fieldErrors()));
    }

    public function testRecusaSenhaNovaIgualAAtual(): void
    {
        $sut = $this->makeSut();

        // Trocar por ela mesma encerraria as sessões sem trocar nada — o
        // usuário pensaria estar protegido e não estaria.
        $this->assertThrows(
            ValidationError::class,
            fn() => $sut->execute($this->input(nova: self::SENHA_ATUAL))
        );
    }

    public function testRecusaUsuarioInexistente(): void
    {
        $sut = $this->makeSut();
        $this->users->users = [];

        $this->assertThrows(
            UnauthorizedError::class,
            fn() => $sut->execute($this->input())
        );
    }
}
