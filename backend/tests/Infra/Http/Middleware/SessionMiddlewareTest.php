<?php

declare(strict_types=1);

namespace Tests\Infra\Http\Middleware;

use App\Domain\Session\Entity\Session;
use App\Domain\User\Entity\User;
use App\Infra\Http\Guard;
use App\Infra\Http\Middleware\SessionMiddleware;
use App\Infra\Http\Pipeline;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\PermissionLevel;
use Tests\Doubles\FrozenClock;
use Tests\Doubles\InMemorySessionGateway;
use Tests\Doubles\InMemoryUserGateway;
use Tests\TestCase;

final class SessionMiddlewareTest extends TestCase
{
    private const TTL = 43200; // 12 horas

    private FrozenClock $clock;
    private InMemorySessionGateway $sessions;
    private InMemoryUserGateway $users;

    /** @return array{0: SessionMiddleware, 1: Session} */
    private function makeSut(bool $active = true): array
    {
        $this->clock = new FrozenClock('2026-09-05 12:00:00');
        $this->sessions = new InMemorySessionGateway();
        $this->users = new InMemoryUserGateway();

        $this->users->add(
            id: 7,
            email: 'editor@oraculo.local',
            password: 'segredo',
            level: PermissionLevel::EDITOR,
            active: $active,
        );

        $session = Session::start(7, self::TTL, $this->clock->now());
        $this->sessions->save($session);

        $sut = new SessionMiddleware($this->sessions, $this->users, $this->clock, self::TTL);

        return [$sut, $session];
    }

    private function run(SessionMiddleware $sut, ?string $cookieValue): mixed
    {
        $captured = null;

        $request = Request::create(
            method: HttpMethod::GET,
            path: '/api/cards',
            cookies: $cookieValue === null ? [] : [SessionMiddleware::COOKIE_NAME => $cookieValue],
        );

        (new Pipeline([$sut]))->process($request, function (Request $incoming) use (&$captured): Response {
            $captured = $incoming->attribute(Guard::USER_ATTRIBUTE);

            return Response::ok([]);
        });

        return $captured;
    }

    public function testAnexaOUsuarioQuandoASessaoEhValida(): void
    {
        [$sut, $session] = $this->makeSut();

        $user = $this->run($sut, $session->id);

        $this->assertTrue($user instanceof User);
        $this->assertSame(7, $user->id);
    }

    public function testNaoAnexaNadaSemCookie(): void
    {
        [$sut] = $this->makeSut();

        // Ausência de sessão não é erro aqui: quem recusa é o guard. É o que
        // permite a rota de sessão responder 401 como caminho normal.
        $this->assertNull($this->run($sut, null));
    }

    public function testNaoAnexaNadaComCookieDesconhecido(): void
    {
        [$sut] = $this->makeSut();

        $this->assertNull($this->run($sut, str_repeat('a', 64)));
    }

    public function testNaoAnexaNadaComCookieVazio(): void
    {
        [$sut] = $this->makeSut();

        $this->assertNull($this->run($sut, ''));
    }

    public function testRecusaSessaoVencidaERemoveDoBanco(): void
    {
        [$sut, $session] = $this->makeSut();

        $this->clock->advance('+13 hours');

        $this->assertNull($this->run($sut, $session->id));
        $this->assertNull($this->sessions->findById($session->id));
    }

    public function testEncerraASessaoDeUsuarioDesativado(): void
    {
        [$sut, $session] = $this->makeSut(active: false);

        $this->assertNull($this->run($sut, $session->id));

        // Sem isto, desativar um usuário não teria efeito nenhum até a sessão
        // dele vencer sozinha — ou seja, até doze horas depois.
        $this->assertNull($this->sessions->findById($session->id));
    }

    public function testEncerraASessaoDeUsuarioExcluido(): void
    {
        [$sut, $session] = $this->makeSut();
        $this->users->users = [];

        $this->assertNull($this->run($sut, $session->id));
        $this->assertNull($this->sessions->findById($session->id));
    }

    public function testNaoGravaNoBancoQuandoASessaoAindaEstaFresca(): void
    {
        [$sut, $session] = $this->makeSut();

        $this->clock->advance('+1 hour');
        $this->run($sut, $session->id);

        // Renovar a cada requisição transformaria todo GET numa escrita.
        $this->assertSame(
            $session->expiresAt->format('Y-m-d H:i:s'),
            $this->sessions->findById($session->id)->expiresAt->format('Y-m-d H:i:s')
        );
    }

    public function testRenovaAValidadeDepoisDeMetadeDoPrazo(): void
    {
        [$sut, $session] = $this->makeSut();

        $this->clock->advance('+7 hours');
        $this->run($sut, $session->id);

        // Quem está trabalhando há horas não pode ser deslogado no meio de um
        // cadastro.
        $this->assertSame(
            '2026-09-06 07:00:00',
            $this->sessions->findById($session->id)->expiresAt->format('Y-m-d H:i:s')
        );
    }

    public function testRenovacaoPreservaIdEDeTokenCsrf(): void
    {
        [$sut, $session] = $this->makeSut();

        $this->clock->advance('+7 hours');
        $this->run($sut, $session->id);

        $renovada = $this->sessions->findById($session->id);

        $this->assertSame($session->id, $renovada->id);
        $this->assertSame($session->csrfToken, $renovada->csrfToken);
    }
}
