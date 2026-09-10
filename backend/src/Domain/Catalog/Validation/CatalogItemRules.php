<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Validation;

/**
 * As regras que edição e raridade compartilham: o formato do código e o nome.
 *
 * A escrita das duas se separou quando a raridade ganhou cor — mas estas regras
 * não se separaram, e é por isso que moram aqui, uma vez só. Duplicá-las em
 * cada caso de uso criaria dois lugares para corrigir o mesmo defeito, e a
 * raridade acabaria aceitando o que a edição recusa.
 */
final class CatalogItemRules
{
    /** O código vira parte da URL pública: minúsculas, números e hífen. */
    private const CODE_PATTERN = '/^[a-z0-9][a-z0-9-]{0,31}$/';

    public static function normalizeCode(string $raw): string
    {
        return strtolower(trim($raw));
    }

    /**
     * @param string $code já normalizado
     * @param string $name já sem espaço nas pontas
     * @return array<string,string> campo => mensagem; vazio quando está tudo certo
     */
    public static function errors(string $code, string $name): array
    {
        $errors = [];

        if (preg_match(self::CODE_PATTERN, $code) !== 1) {
            $errors['code'] = 'Use apenas letras minúsculas, números e hífen, até 32 caracteres.';
        }

        return $errors + self::nameErrors($name);
    }

    /** @return array<string,string> */
    public static function nameErrors(string $name): array
    {
        return $name === '' ? ['name' => 'O nome é obrigatório.'] : [];
    }
}
