<?php

declare(strict_types=1);

namespace App\Shared\Enum;

/**
 * De onde vem a imagem de uma carta.
 *
 * Duas origens porque a decisão de produto foi aceitar as duas: upload como
 * caminho padrão, porque pedir a URL de uma imagem a alguém não técnico é
 * transferir trabalho de engenharia para o usuário; e URL como alternativa,
 * para quem já tem o link do CDN (docs/decisions/ADR-008).
 *
 * Os valores espelham o ENUM da coluna `cards.image_type`.
 */
enum ImageType: string
{
    case UPLOAD = 'upload';
    case REMOTE = 'remote';
}
