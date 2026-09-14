<?php

declare(strict_types=1);

namespace App\Infra\Http;

/**
 * Um cookie de resposta, como valor.
 *
 * A Response carrega cookies em vez de a aplicação chamar `setcookie()` direto:
 * `setcookie()` escreve na saída no instante da chamada, o que torna o efeito
 * impossível de inspecionar em teste e acopla a montagem da resposta ao momento
 * de enviá-la.
 *
 * Os atributos de segurança são obrigatórios por construção, e não opcionais:
 * um cookie de sessão sem HttpOnly é legível por qualquer XSS, e sem SameSite
 * viaja em requisição originada de outro site.
 */
final class Cookie
{
    private function __construct(
        public readonly string $name,
        public readonly string $value,
        public readonly int $expiresAt,
        public readonly bool $secure,
    ) {
    }

    public static function session(string $name, string $value, int $expiresAt, bool $secure): self
    {
        return new self($name, $value, $expiresAt, $secure);
    }

    /**
     * Cookie de remoção: valor vazio e validade no passado.
     *
     * Os demais atributos precisam bater com os do cookie original, senão o
     * navegador entende que é outro cookie e o antigo permanece.
     */
    public static function expired(string $name, bool $secure): self
    {
        return new self($name, '', 1, $secure);
    }

    public function toHeaderValue(): string
    {
        $parts = [
            $this->name . '=' . rawurlencode($this->value),
            'Path=/',
            'Expires=' . gmdate('D, d-M-Y H:i:s T', $this->expiresAt),
            // O JavaScript não lê este cookie. O que o JS lê, um XSS lê.
            'HttpOnly',
            // Lax e não None: frontend e API compartilham a origem, então não há
            // requisição cruzada legítima a permitir (docs/decisions/ADR-003).
            'SameSite=Lax',
        ];

        // Em http local um cookie Secure simplesmente não é gravado pelo
        // navegador, e o login pararia de funcionar sem mensagem alguma.
        if ($this->secure) {
            $parts[] = 'Secure';
        }

        return implode('; ', $parts);
    }
}
