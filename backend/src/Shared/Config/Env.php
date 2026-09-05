<?php

declare(strict_types=1);

namespace App\Shared\Config;

/**
 * Ponto único de leitura da configuração de ambiente.
 *
 * Duas regras, ambas do PADROES.md §9.1:
 *
 * 1. Nenhum valor default. `getenv('X') ?: 'valor'` é um segredo commitado com
 *    um passo extra. Se a variável falta, a aplicação falha ao subir — alto e
 *    claro, no boot, e não em produção no meio de uma requisição.
 * 2. Toda leitura passa por aqui. Um `getenv()` solto no meio do código é uma
 *    dependência de ambiente que ninguém consegue inventariar depois.
 */
final class Env
{
    /**
     * Lê uma variável obrigatória.
     *
     * Variável vazia ou só com espaço é tratada como ausente: uma linha
     * `DB_PASS=` no .env é quase sempre esquecimento, não senha em branco, e
     * falhar aqui é mais barato que falhar na primeira conexão.
     */
    public static function required(string $key): string
    {
        $value = getenv($key);

        if ($value === false || trim($value) === '') {
            throw EnvironmentError::missing($key);
        }

        return $value;
    }

    /**
     * Lê uma variável obrigatória que precisa ser um inteiro.
     *
     * A conversão é validada em vez de usar cast: `(int) '12 horas'` devolve 12
     * em silêncio, e um TTL de sessão errado por conversão silenciosa é o tipo
     * de defeito que só aparece semanas depois.
     */
    public static function requiredInt(string $key): int
    {
        $value = self::required($key);

        if (preg_match('/^-?\d+$/', trim($value)) !== 1) {
            throw EnvironmentError::malformed($key, 'um número inteiro');
        }

        return (int) $value;
    }
}
