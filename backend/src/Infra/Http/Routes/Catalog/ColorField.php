<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Catalog;

use App\Infra\Http\Request;

/**
 * Lê a cor do corpo sem confundir "ausente" com "inválida".
 *
 * Ausente vira `null`, e é o caso de uso que decide o que isso significa —
 * grafite na criação, erro na alteração. Presente mas sem ser texto (um número,
 * uma lista) vira texto vazio, que a paleta recusa: tratar como ausente
 * esconderia o erro do cliente atrás de um grafite silencioso.
 */
final class ColorField
{
    public static function read(Request $request): ?string
    {
        $raw = $request->body('color');

        if ($raw === null) {
            return null;
        }

        return is_string($raw) ? $raw : '';
    }
}
