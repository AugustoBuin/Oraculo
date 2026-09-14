<?php

declare(strict_types=1);

namespace App\Shared\Enum;

/**
 * Os três níveis de acesso do portal.
 *
 * Hierárquicos: ADMIN faz tudo que EDITOR faz, que faz tudo que VIEWER faz.
 * A checagem é uma comparação de valor, não uma matriz de permissões — com três
 * papéis encaixáveis, a matriz seria indireção sem ganho (docs/decisions/ADR-006).
 *
 * **O VIEWER é a parte que importa de produto.** O enunciado diz que o portal
 * será usado por pessoas com diferentes níveis de familiaridade com tecnologia.
 * A forma mais eficaz de proteger quem tem menos familiaridade não é uma
 * interface mais simples: é não dar a ela um botão que ela não precisa apertar.
 *
 * O valor inteiro é o que está gravado em `users.role_level`. Mudá-lo sem
 * migration reclassificaria todos os usuários existentes em silêncio.
 */
enum PermissionLevel: int
{
    /** Lista e visualiza cartas. */
    case VIEWER = 1;

    /** Cria, edita, exclui e restaura cartas; consulta o histórico. */
    case EDITOR = 2;

    /** Tudo acima, mais a gestão de jogos, edições e raridades. */
    case ADMIN = 3;

    /**
     * Este nível alcança a operação que exige `$required`?
     */
    public function allows(self $required): bool
    {
        return $this->value >= $required->value;
    }

    /**
     * Rótulo exibido ao usuário. Em português, como todo texto de interface.
     */
    public function label(): string
    {
        return match ($this) {
            self::VIEWER => 'Consulta',
            self::EDITOR => 'Editor',
            self::ADMIN => 'Administrador',
        };
    }
}
