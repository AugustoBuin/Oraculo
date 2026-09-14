<?php

declare(strict_types=1);

namespace App\Domain\Session\Entity;

/**
 * Uma sessão de servidor.
 *
 * Vive no banco, e não em arquivo, por uma razão de produto e uma de segurança:
 * é acessível de qualquer lugar (sobrevive a restart do contêiner e escalaria
 * para várias instâncias sem tocar em código), e é **revogável de verdade** —
 * logout encerra no servidor, e troca de senha encerra todas as sessões do
 * usuário, ambos um DELETE (docs/decisions/ADR-003).
 */
final class Session
{
    /**
     * 32 bytes de entropia. O id da sessão é, na prática, a credencial: quem o
     * tem está autenticado. Precisa ser imprevisível, não apenas único.
     */
    private const ID_BYTES = 32;

    private const CSRF_BYTES = 32;

    private function __construct(
        public readonly string $id,
        public readonly int $userId,
        public readonly string $csrfToken,
        public readonly \DateTimeImmutable $createdAt,
        public readonly \DateTimeImmutable $lastActivityAt,
        public readonly \DateTimeImmutable $expiresAt,
        /** De onde a sessão foi aberta. Guardado para investigação de acesso indevido. */
        public readonly ?string $ipAddress = null,
        public readonly ?string $userAgent = null,
    ) {
    }

    /**
     * Abre uma sessão nova.
     *
     * O id e o token vêm de random_bytes — gerador criptográfico. `rand()` e
     * `mt_rand()` são previsíveis a partir de algumas saídas, e usá-los aqui
     * tornaria a sessão adivinhável (PADROES.md §5.4).
     */
    public static function start(
        int $userId,
        int $ttlSeconds,
        \DateTimeImmutable $now,
        ?string $ipAddress = null,
        ?string $userAgent = null,
    ): self {
        return new self(
            id: bin2hex(random_bytes(self::ID_BYTES)),
            userId: $userId,
            csrfToken: bin2hex(random_bytes(self::CSRF_BYTES)),
            createdAt: $now,
            lastActivityAt: $now,
            expiresAt: $now->modify("+{$ttlSeconds} seconds"),
            ipAddress: $ipAddress,
            userAgent: $userAgent,
        );
    }

    /** Reconstrói uma sessão vinda do banco. */
    public static function with(
        string $id,
        int $userId,
        string $csrfToken,
        \DateTimeImmutable $createdAt,
        \DateTimeImmutable $lastActivityAt,
        \DateTimeImmutable $expiresAt,
        ?string $ipAddress = null,
        ?string $userAgent = null,
    ): self {
        return new self(
            $id,
            $userId,
            $csrfToken,
            $createdAt,
            $lastActivityAt,
            $expiresAt,
            $ipAddress,
            $userAgent,
        );
    }

    public function hasExpired(\DateTimeImmutable $now): bool
    {
        return $this->expiresAt <= $now;
    }

    /**
     * Renova a validade a partir do uso.
     *
     * Sem isso, quem está trabalhando há doze horas seria deslogado no meio de
     * um cadastro. Com isso, sessão abandonada ainda vence sozinha.
     */
    public function renewed(int $ttlSeconds, \DateTimeImmutable $now): self
    {
        return new self(
            id: $this->id,
            userId: $this->userId,
            csrfToken: $this->csrfToken,
            createdAt: $this->createdAt,
            lastActivityAt: $now,
            expiresAt: $now->modify("+{$ttlSeconds} seconds"),
            ipAddress: $this->ipAddress,
            userAgent: $this->userAgent,
        );
    }

    /**
     * Compara o token anti-CSRF em tempo constante.
     *
     * `===` em string vaza informação pelo tempo de comparação: um atacante
     * mede quantos caracteres iniciais acertou. `hash_equals` não.
     */
    public function matchesCsrfToken(?string $candidate): bool
    {
        return $candidate !== null && hash_equals($this->csrfToken, $candidate);
    }
}
