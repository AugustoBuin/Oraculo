<?php

declare(strict_types=1);

namespace Tests\UseCases\Auth;

use App\Domain\Errors\TooManyRequestsError;
use App\Domain\Errors\UnauthorizedError;
use App\Shared\Enum\PermissionLevel;
use App\UseCases\Auth\AuthenticateUserInput;
use App\UseCases\Auth\AuthenticateUserUseCase;
use Tests\Doubles\FrozenClock;
use Tests\Doubles\InMemoryLoginAttemptGateway;
use Tests\Doubles\InMemorySessionGateway;
use Tests\Doubles\InMemoryUserGateway;
use Tests\Doubles\SpyLogger;
use Tests\TestCase;

/**
 * O caso de uso de autenticação.
 *
 * Cobre caminho feliz, cada validação, e — o que mais importa — o efeito que
 * NÃO pode acontecer em cada caminho de falha: nenhuma sessão é criada.
 */
final class AuthenticateUserUseCaseTest extends TestCase
{
    private const TTL = 43200;
    private const SENHA = 'senha-correta';

    private FrozenClock $clock;
    private InMemoryUserGateway $users;
    private InMemorySessionGateway $sessions;
    private InMemoryLoginAttemptGateway $attempts;
    private SpyLogger $logger;

    private function makeSut(bool $active = true): AuthenticateUserUseCase
    {
        $this->clock = new FrozenClock('2026-09-05 12:00:00');
        $this->users = new InMemoryUserGateway();
        $this->sessions = new InMemorySessionGateway();
        $this->attempts = new InMemoryLoginAttemptGateway();
        $this->logger = new SpyLogger();

        $this->users->add(
            id: 7,
            email: 'editor@oraculo.local',
            password: self::SENHA,
            level: PermissionLevel::EDITOR,
            active: $active,
        );

        return AuthenticateUserUseCase::create(
            users: $this->users,
            sessions: $this->sessions,
            attempts: $this->attempts,
            clock: $this->clock,
            logger: $this->logger,
            sessionTtlSeconds: self::TTL,
        );
    }

    private function input(string $email = 'editor@oraculo.local', string $password = self::SENHA): AuthenticateUserInput
    {
        return new AuthenticateUserInput(
            email: $email,
            password: $password,
            ipAddress: '10.0.0.7',
            userAgent: 'Firefox',
        );
    }

    // --- caminho feliz --------------------------------------------------------

    public function testAutenticaEAbreSessaoComCredencialValida(): void
    {
        $sut = $this->makeSut();

        $output = $sut->execute($this->input());

        $this->assertSame(7, $output->user->id);
        $this->assertSame('Editor', $output->user->level->label());
        $this->assertCount(1, $this->sessions->sessions);
    }

    public function testDevolveOTokenCsrfDaSessaoAberta(): void
    {
        $sut = $this->makeSut();

        $output = $sut->execute($this->input());

        // O frontend precisa do token para poder escrever; sem ele, o primeiro
        // POST depois do login seria recusado.
        $this->assertSame(64, strlen($output->session->csrfToken));
    }

    public function testRegistraOEnderecoDeOrigemNaSessao(): void
    {
        $sut = $this->makeSut();

        $output = $sut->execute($this->input());

        $this->assertSame('10.0.0.7', $output->session->ipAddress);
        $this->assertSame('Firefox', $output->session->userAgent);
    }

    public function testLimpaAsTentativasAposOSucesso(): void
    {
        $sut = $this->makeSut();

        foreach (['errada-1', 'errada-2'] as $tentativa) {
            try {
                $sut->execute($this->input(password: $tentativa));
            } catch (UnauthorizedError) {
                // esperado
            }
        }

        $sut->execute($this->input());

        // Sem a limpeza, quem errou duas vezes antes de acertar continuaria a
        // dois erros de ser bloqueado pelo resto da janela.
        $this->assertCount(0, $this->attempts->attempts);
    }

    // --- falhas: a MESMA resposta para os três casos ---------------------------

    public function testRecusaSenhaErrada(): void
    {
        $sut = $this->makeSut();

        $error = $this->assertThrows(
            UnauthorizedError::class,
            fn() => $sut->execute($this->input(password: 'errada'))
        );

        $this->assertSame('E-mail ou senha inválidos.', $error->getMessage());
    }

    public function testRecusaUsuarioInexistenteComAMesmaMensagem(): void
    {
        $sut = $this->makeSut();

        $error = $this->assertThrows(
            UnauthorizedError::class,
            fn() => $sut->execute($this->input(email: 'ninguem@oraculo.local'))
        );

        // Distinguir "usuário não existe" de "senha errada" entrega uma lista
        // de usuários válidos a quem tentar (PADROES.md §5.4).
        $this->assertSame('E-mail ou senha inválidos.', $error->getMessage());
    }

    public function testRecusaUsuarioInativoComAMesmaMensagem(): void
    {
        $sut = $this->makeSut(active: false);

        $error = $this->assertThrows(
            UnauthorizedError::class,
            fn() => $sut->execute($this->input())
        );

        // "Sua conta foi desativada" confirmaria que a conta existe.
        $this->assertSame('E-mail ou senha inválidos.', $error->getMessage());
    }

    public function testVerificaOHashMesmoQuandoOUsuarioNaoExiste(): void
    {
        $sut = $this->makeSut();

        $sut2 = $this->makeSut();
        $inicio = microtime(true);
        try {
            $sut2->execute($this->input(email: 'ninguem@oraculo.local'));
        } catch (UnauthorizedError) {
        }
        $inexistente = microtime(true) - $inicio;

        $inicio = microtime(true);
        try {
            $sut->execute($this->input(password: 'errada'));
        } catch (UnauthorizedError) {
        }
        $senhaErrada = microtime(true) - $inicio;

        // Sem a verificação falsa, responder "usuário não existe" seria muito
        // mais rápido que "senha errada", e o tempo viraria o oráculo que a
        // mensagem idêntica tentou fechar. Tolerância larga de propósito: o
        // teste prova que a conferência acontece, não mede desempenho.
        $this->assertTrue(
            $inexistente > $senhaErrada / 10,
            'A tentativa com usuário inexistente retornou rápido demais.'
        );
    }

    // --- o efeito que não pode acontecer --------------------------------------

    public function testNaoAbreSessaoEmNenhumCaminhoDeFalha(): void
    {
        foreach ([
            fn(AuthenticateUserUseCase $s) => $s->execute($this->input(password: 'errada')),
            fn(AuthenticateUserUseCase $s) => $s->execute($this->input(email: 'ninguem@oraculo.local')),
        ] as $tentativa) {
            $sut = $this->makeSut();

            try {
                $tentativa($sut);
            } catch (UnauthorizedError) {
            }

            $this->assertCount(0, $this->sessions->sessions);
        }

        $sut = $this->makeSut(active: false);
        try {
            $sut->execute($this->input());
        } catch (UnauthorizedError) {
        }
        $this->assertCount(0, $this->sessions->sessions);
    }

    public function testNuncaRegistraSenhaOuHashNoLog(): void
    {
        $sut = $this->makeSut();

        try {
            $sut->execute($this->input(password: 'senha-secreta-do-usuario'));
        } catch (UnauthorizedError) {
        }
        $sut->execute($this->input());

        $registrado = $this->logger->everythingLogged();

        $this->assertFalse(str_contains($registrado, 'senha-secreta-do-usuario'));
        $this->assertFalse(str_contains($registrado, self::SENHA));
        $this->assertFalse(str_contains($registrado, '$2y$'));
    }

    // --- limite de tentativas -------------------------------------------------

    public function testBloqueiaAposCincoTentativasNaJanela(): void
    {
        $sut = $this->makeSut();

        for ($i = 0; $i < 5; $i++) {
            try {
                $sut->execute($this->input(password: 'errada'));
            } catch (UnauthorizedError) {
            }
        }

        $this->assertThrows(
            TooManyRequestsError::class,
            fn() => $sut->execute($this->input(password: 'errada'))
        );
    }

    public function testBloqueiaMesmoComACredencialCorreta(): void
    {
        $sut = $this->makeSut();

        for ($i = 0; $i < 5; $i++) {
            try {
                $sut->execute($this->input(password: 'errada'));
            } catch (UnauthorizedError) {
            }
        }

        // Se a senha certa passasse por cima do bloqueio, o limite não
        // atrapalharia em nada um ataque de força bruta — que é exatamente o
        // momento em que a senha certa aparece.
        $this->assertThrows(
            TooManyRequestsError::class,
            fn() => $sut->execute($this->input())
        );
    }

    public function testLiberaDepoisQueAJanelaPassa(): void
    {
        $sut = $this->makeSut();

        for ($i = 0; $i < 5; $i++) {
            try {
                $sut->execute($this->input(password: 'errada'));
            } catch (UnauthorizedError) {
            }
        }

        $this->clock->advance('+16 minutes');

        $output = $sut->execute($this->input());

        $this->assertSame(7, $output->user->id);
    }

    public function testNaoBloqueiaOutroUsuarioNoMesmoEndereco(): void
    {
        $sut = $this->makeSut();
        $this->users->add(id: 8, email: 'outro@oraculo.local', password: 'outra-senha');

        for ($i = 0; $i < 5; $i++) {
            try {
                $sut->execute($this->input(password: 'errada'));
            } catch (UnauthorizedError) {
            }
        }

        // A janela é por (e-mail, IP). Fosse só por IP, um escritório inteiro
        // atrás de um NAT seria bloqueado por causa de um colega distraído.
        $output = $sut->execute(new AuthenticateUserInput(
            email: 'outro@oraculo.local',
            password: 'outra-senha',
            ipAddress: '10.0.0.7',
            userAgent: 'Firefox',
        ));

        $this->assertSame(8, $output->user->id);
    }

    public function testNaoGuardaOEmailEmClaroNoRegistroDeTentativas(): void
    {
        $sut = $this->makeSut();

        try {
            $sut->execute($this->input(password: 'errada'));
        } catch (UnauthorizedError) {
        }

        // Guardar o e-mail em claro transformaria a tabela numa lista de
        // usuários do sistema, legível por qualquer leitura acidental.
        foreach (array_keys($this->attempts->attempts) as $identificador) {
            $this->assertFalse(str_contains($identificador, 'editor@oraculo.local'));
            $this->assertSame(64, strlen($identificador));
        }
    }
}
