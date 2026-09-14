<?php

declare(strict_types=1);

namespace Tests\Domain\Session;

use App\Domain\Session\Entity\Session;
use Tests\Doubles\FrozenClock;
use Tests\TestCase;

final class SessionTest extends TestCase
{
    private const TTL = 43200; // 12 horas

    public function testAbreComValidadeContadaAPartirDeAgora(): void
    {
        $clock = new FrozenClock('2026-09-05 12:00:00');

        $session = Session::start(userId: 7, ttlSeconds: self::TTL, now: $clock->now());

        $this->assertSame('2026-09-06 00:00:00', $session->expiresAt->format('Y-m-d H:i:s'));
        $this->assertSame(7, $session->userId);
    }

    public function testGeraIdImprevisivelEDeTamanhoAdequado(): void
    {
        $clock = new FrozenClock();

        $primeira = Session::start(1, self::TTL, $clock->now());
        $segunda = Session::start(1, self::TTL, $clock->now());

        // O id da sessão É a credencial: quem o tem está autenticado. 32 bytes
        // em hexadecimal = 64 caracteres.
        $this->assertSame(64, strlen($primeira->id));
        $this->assertFalse($primeira->id === $segunda->id);
    }

    public function testGeraTokenCsrfProprioPorSessao(): void
    {
        $clock = new FrozenClock();

        $primeira = Session::start(1, self::TTL, $clock->now());
        $segunda = Session::start(1, self::TTL, $clock->now());

        $this->assertSame(64, strlen($primeira->csrfToken));
        $this->assertFalse($primeira->csrfToken === $segunda->csrfToken);
        // O token não pode ser derivado do id: quem vê um não deduz o outro.
        $this->assertFalse($primeira->csrfToken === $primeira->id);
    }

    public function testNaoEstaVencidaAntesDoPrazo(): void
    {
        $clock = new FrozenClock('2026-09-05 12:00:00');
        $session = Session::start(1, self::TTL, $clock->now());

        $clock->advance('+11 hours');

        $this->assertFalse($session->hasExpired($clock->now()));
    }

    public function testEstaVencidaDepoisDoPrazo(): void
    {
        $clock = new FrozenClock('2026-09-05 12:00:00');
        $session = Session::start(1, self::TTL, $clock->now());

        $clock->advance('+13 hours');

        $this->assertTrue($session->hasExpired($clock->now()));
    }

    public function testEstaVencidaExatamenteNoInstanteDoPrazo(): void
    {
        // A borda: no segundo exato do vencimento a sessão já não vale. Deixar
        // "<" no lugar de "<=" é o erro de um caractere que ninguém revisa.
        $clock = new FrozenClock('2026-09-05 12:00:00');
        $session = Session::start(1, 60, $clock->now());

        $clock->advance('+60 seconds');

        $this->assertTrue($session->hasExpired($clock->now()));
    }

    public function testRenovaEstendendoAValidadeSemTrocarIdNemToken(): void
    {
        $clock = new FrozenClock('2026-09-05 12:00:00');
        $session = Session::start(1, self::TTL, $clock->now());

        $clock->advance('+6 hours');
        $renovada = $session->renewed(self::TTL, $clock->now());

        // Trocar o id na renovação deslogaria a aba vizinha; trocar o token
        // CSRF invalidaria o formulário que o usuário está preenchendo.
        $this->assertSame($session->id, $renovada->id);
        $this->assertSame($session->csrfToken, $renovada->csrfToken);
        $this->assertSame('2026-09-06 06:00:00', $renovada->expiresAt->format('Y-m-d H:i:s'));
    }

    public function testPreservaAAberturaOriginalAoRenovar(): void
    {
        $clock = new FrozenClock('2026-09-05 12:00:00');
        $session = Session::start(1, self::TTL, $clock->now());

        $clock->advance('+6 hours');
        $renovada = $session->renewed(self::TTL, $clock->now());

        $this->assertSame(
            $session->createdAt->format('Y-m-d H:i:s'),
            $renovada->createdAt->format('Y-m-d H:i:s')
        );
    }

    public function testAceitaOTokenCsrfCorreto(): void
    {
        $session = Session::start(1, self::TTL, (new FrozenClock())->now());

        $this->assertTrue($session->matchesCsrfToken($session->csrfToken));
    }

    public function testRecusaTokenCsrfDivergenteAusenteOuVazio(): void
    {
        $session = Session::start(1, self::TTL, (new FrozenClock())->now());

        $this->assertFalse($session->matchesCsrfToken('outro'));
        $this->assertFalse($session->matchesCsrfToken(null));
        $this->assertFalse($session->matchesCsrfToken(''));
        // Prefixo correto não basta — é o que a comparação em tempo constante
        // protege.
        $this->assertFalse($session->matchesCsrfToken(substr($session->csrfToken, 0, 32)));
    }
}
