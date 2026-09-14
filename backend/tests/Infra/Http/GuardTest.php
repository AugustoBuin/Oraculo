<?php

declare(strict_types=1);

namespace Tests\Infra\Http;

use App\Domain\Errors\ForbiddenError;
use App\Domain\Errors\UnauthorizedError;
use App\Domain\User\Entity\User;
use App\Infra\Http\Guard;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\PermissionLevel;
use Tests\TestCase;

/**
 * O guard: proteção aplicada no REGISTRO da rota, não dentro dela.
 *
 * O PADROES.md §5.1 marca este como o item de maior valor do documento, com uma
 * justificativa vinda de incidente real: rotas nascidas sem guard resultaram em
 * leitura e exclusão não autenticadas de dados pessoais de clientes.
 */
final class GuardTest extends TestCase
{
    /** Rota que registra se chegou a ser executada. */
    private function route(\ArrayObject $trail): Route
    {
        return new class ($trail) implements Route {
            public function __construct(private \ArrayObject $trail)
            {
            }

            public function method(): HttpMethod
            {
                return HttpMethod::DELETE;
            }

            public function path(): string
            {
                return '/api/cards/{id}';
            }

            public function handle(Request $request): Response
            {
                $this->trail[] = 'rota executada';

                return Response::ok(['ok' => true]);
            }
        };
    }

    private function user(PermissionLevel $level): User
    {
        return User::with(
            id: 7,
            name: 'Editor de Catálogo',
            email: 'editor@oraculo.local',
            level: $level,
            active: true,
        );
    }

    private function request(?User $user): Request
    {
        $request = Request::create(method: HttpMethod::DELETE, path: '/api/cards/12');

        return $user === null ? $request : $request->withAttribute(Guard::USER_ATTRIBUTE, $user);
    }

    public function testDeixaPassarQuemTemNivelSuficiente(): void
    {
        $trail = new \ArrayObject();
        $sut = Guard::protect($this->route($trail), PermissionLevel::EDITOR);

        $response = $sut->handle($this->request($this->user(PermissionLevel::EDITOR)));

        $this->assertTrue($response->body['data']['ok']);
        $this->assertCount(1, (array) $trail);
    }

    public function testDeixaPassarQuemTemNivelAcimaDoMinimo(): void
    {
        $trail = new \ArrayObject();
        $sut = Guard::protect($this->route($trail), PermissionLevel::EDITOR);

        $sut->handle($this->request($this->user(PermissionLevel::ADMIN)));

        $this->assertCount(1, (array) $trail);
    }

    public function testRecusaSemSessaoComQuatrocentosEUm(): void
    {
        $sut = Guard::protect($this->route(new \ArrayObject()), PermissionLevel::VIEWER);

        // 401 e não 403: o frontend precisa distinguir "vá ao login" de
        // "você não tem permissão" (docs/decisions/ADR-007).
        $this->assertThrows(
            UnauthorizedError::class,
            fn() => $sut->handle($this->request(null))
        );
    }

    public function testRecusaNivelInsuficienteComQuatrocentosETres(): void
    {
        $sut = Guard::protect($this->route(new \ArrayObject()), PermissionLevel::ADMIN);

        $this->assertThrows(
            ForbiddenError::class,
            fn() => $sut->handle($this->request($this->user(PermissionLevel::EDITOR)))
        );
    }

    public function testNaoEXECUTAARotaQuandoOAcessoEhNegado(): void
    {
        $trail = new \ArrayObject();
        $sut = Guard::protect($this->route($trail), PermissionLevel::ADMIN);

        try {
            $sut->handle($this->request($this->user(PermissionLevel::VIEWER)));
        } catch (ForbiddenError) {
            // esperado
        }

        // O efeito que NÃO pode acontecer quando o acesso é negado. Sem esta
        // asserção, um guard que lança DEPOIS de executar a rota passaria.
        $this->assertCount(0, (array) $trail);
    }

    public function testRecusaUsuarioInativoMesmoComNivelSuficiente(): void
    {
        $sut = Guard::protect($this->route(new \ArrayObject()), PermissionLevel::VIEWER);

        $inativo = User::with(
            id: 9,
            name: 'Desligado',
            email: 'ex@oraculo.local',
            level: PermissionLevel::ADMIN,
            active: false,
        );

        $this->assertThrows(
            UnauthorizedError::class,
            fn() => $sut->handle($this->request($inativo))
        );
    }

    public function testPreservaMetodoECaminhoDaRotaEnvolvida(): void
    {
        // O roteador precisa continuar enxergando a rota original: um guard que
        // esconde o caminho tornaria a rota inalcançável.
        $sut = Guard::protect($this->route(new \ArrayObject()), PermissionLevel::VIEWER);

        $this->assertSame(HttpMethod::DELETE, $sut->method());
        $this->assertSame('/api/cards/{id}', $sut->path());
    }

    public function testNaoVazaNomeNemNivelNaMensagemDeRecusa(): void
    {
        $sut = Guard::protect($this->route(new \ArrayObject()), PermissionLevel::ADMIN);

        $error = $this->assertThrows(
            ForbiddenError::class,
            fn() => $sut->handle($this->request($this->user(PermissionLevel::VIEWER)))
        );

        foreach (['ADMIN', 'VIEWER', 'editor@oraculo.local', '3', '1'] as $proibido) {
            $this->assertFalse(
                str_contains($error->getMessage(), $proibido),
                "A mensagem não pode revelar \"{$proibido}\"."
            );
        }
    }
}
