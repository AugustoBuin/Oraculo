<?php

declare(strict_types=1);

namespace App\Shared\Enum;

/**
 * O que aconteceu com uma carta.
 *
 * Espelha o ENUM da coluna `card_audit.action`.
 */
enum CardAction: string
{
    case CREATED = 'created';
    case UPDATED = 'updated';
    case DELETED = 'deleted';
    case RESTORED = 'restored';

    public function label(): string
    {
        return match ($this) {
            self::CREATED => 'Criada',
            self::UPDATED => 'Alterada',
            self::DELETED => 'Excluída',
            self::RESTORED => 'Restaurada',
        };
    }
}
