<?php

declare(strict_types=1);

/**
 * Procura o mesmo placeholder nomeado repetido numa instrução SQL.
 *
 * Este verificador nasceu de dois defeitos reais encontrados no mesmo dia:
 * `(name_en LIKE :search OR name_pt LIKE :search)` e
 * `SET deleted_at = :at, updated_at = :at`.
 *
 * Com `ATTR_EMULATE_PREPARES => false` — que o PADROES.md §7.2 exige, porque
 * sem ele o prepared statement é interpolado no cliente e deixa de proteger —
 * o MySQL prepara de verdade, e o protocolo nativo **não aceita o mesmo nome
 * duas vezes**. O resultado é `SQLSTATE[HY093]: Invalid parameter number`.
 *
 * O que torna esta classe de defeito perigosa é que ela é invisível até a
 * execução: passa na análise de sintaxe, passa em qualquer teste que não
 * exercite aquele caminho específico, e some completamente se alguém ligar a
 * emulação "para resolver" — trocando um erro visível por uma vulnerabilidade.
 *
 * A varredura usa o TOKENIZADOR do PHP, e não expressão regular. Uma primeira
 * versão com regex parcava aspas de literais diferentes e acusou um falso
 * positivo logo no primeiro uso — e verificador que grita à toa treina quem
 * lê a ignorá-lo, o que é pior do que não ter verificador.
 *
 * Literais concatenados com `.` são tratados como UMA instrução, porque é assim
 * que o SQL é montado: `'INSERT INTO ' . self::TABLE . ' VALUES (:a, :a)'`.
 *
 * Sai com código 1 quando encontra algo.
 */

$projectRoot = dirname(__DIR__);
$findings = [];

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($projectRoot . '/src', FilesystemIterator::SKIP_DOTS)
);

foreach ($iterator as $entry) {
    /** @var SplFileInfo $entry */
    if (!$entry->isFile() || $entry->getExtension() !== 'php') {
        continue;
    }

    $source = (string) file_get_contents($entry->getPathname());
    $relativePath = str_replace('\\', '/', substr($entry->getPathname(), strlen($projectRoot) + 1));

    foreach (collectStatements($source) as [$sql, $line]) {
        preg_match_all('/:([a-z_][a-z0-9_]*)/i', $sql, $names);

        if ($names[1] === []) {
            continue;
        }

        $counts = array_count_values(array_map('strtolower', $names[1]));
        $repeated = array_keys(array_filter($counts, static fn(int $n): bool => $n > 1));

        if ($repeated !== []) {
            $findings[] = sprintf(
                '%s:%d — placeholder repetido: %s',
                $relativePath,
                $line,
                implode(', ', array_map(static fn(string $n): string => ':' . $n, $repeated))
            );
        }
    }
}

if ($findings !== []) {
    fwrite(STDERR, 'Placeholders repetidos em instrução SQL:' . PHP_EOL . PHP_EOL);

    foreach ($findings as $finding) {
        fwrite(STDERR, '  ' . $finding . PHP_EOL);
    }

    fwrite(STDERR, PHP_EOL . 'Use nomes distintos e passe o mesmo valor duas vezes.' . PHP_EOL);
    exit(1);
}

echo 'Nenhum placeholder repetido em SQL.' . PHP_EOL;
exit(0);

/**
 * Agrupa literais de texto concatenados por `.` numa instrução só.
 *
 * @return list<array{0: string, 1: int}> pares [instrução, linha]
 */
function collectStatements(string $source): array
{
    $tokens = token_get_all($source);
    $statements = [];

    $buffer = '';
    $startLine = 0;
    $expectingConcatenation = false;

    foreach ($tokens as $token) {
        // Espaço e comentário não quebram uma concatenação.
        if (is_array($token) && in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
            continue;
        }

        if (is_array($token) && $token[0] === T_CONSTANT_ENCAPSED_STRING) {
            if ($buffer === '') {
                $startLine = $token[2];
            }

            // Remove as aspas delimitadoras; o conteúdo é o que interessa.
            $buffer .= substr($token[1], 1, -1);
            $expectingConcatenation = true;
            continue;
        }

        if ($token === '.' && $expectingConcatenation) {
            // Segue acumulando: o próximo operando pode ser outro literal ou
            // uma constante (nome de tabela), que não carrega placeholder.
            continue;
        }

        if ($expectingConcatenation && (is_array($token) || $token !== '.')) {
            // Constante ou variável no meio da concatenação: mantém o
            // acúmulo, porque a instrução ainda não terminou.
            if (is_array($token) && in_array($token[0], [T_STRING, T_DOUBLE_COLON, T_VARIABLE], true)) {
                continue;
            }

            if ($buffer !== '') {
                $statements[] = [$buffer, $startLine];
            }

            $buffer = '';
            $expectingConcatenation = false;
        }
    }

    if ($buffer !== '') {
        $statements[] = [$buffer, $startLine];
    }

    return $statements;
}
