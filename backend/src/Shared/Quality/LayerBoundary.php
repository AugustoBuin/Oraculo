<?php

declare(strict_types=1);

namespace App\Shared\Quality;

/**
 * Verificador das fronteiras de camada, do backend e do frontend.
 *
 * Existe porque fronteira sem verificador é sugestão: sem alguém checando, a
 * regra de dependência sobrevive exatamente até o primeiro prazo apertado
 * (docs/decisions/ADR-002).
 *
 * Escrito em PHP e não em Node, embora o padrão de referência proponha um
 * script `.mjs`: PHP já está no contêiner, e acrescentar um runtime a um
 * projeto que se apresenta como "zero dependência" pede uma explicação que
 * reescrever torna desnecessária.
 *
 * A regra de dependência, resumida:
 *
 *   Backend    Infra ──▶ UseCases ──▶ Domain ◀── Shared
 *   Frontend   pages ──▶ features ──▶ shared      (features nunca entre si)
 */
final class LayerBoundary
{
    /**
     * O que cada caminho não pode conter.
     *
     * Chave: prefixo do caminho do arquivo.
     * Valor: lista de [expressão proibida, motivo].
     *
     * @var array<string, list<array{0: string, 1: string}>>
     */
    private const RULES = [
        'src/Domain/' => [
            ['/\bPDO\b|\bmysqli\b|\$pdo\b/', 'domínio não pode conhecer banco'],
            ['/\$_(GET|POST|SERVER|SESSION|COOKIE|FILES|REQUEST)\b/', 'domínio não pode ler superglobal'],
            ['/use\s+App\\\\Infra\\\\/', 'domínio não pode importar de Infra'],
            ['/use\s+App\\\\UseCases\\\\/', 'domínio não pode importar de UseCases'],
        ],
        'src/UseCases/' => [
            ['/use\s+App\\\\Infra\\\\/', 'caso de uso só conhece as interfaces do domínio'],
            ['/\bPDO\b|\bmysqli\b/', 'caso de uso não pode tocar banco direto'],
            ['/\$_(GET|POST|SERVER|SESSION|COOKIE|FILES|REQUEST)\b/', 'caso de uso não pode ler superglobal'],
        ],
        'src/Shared/' => [
            ['/use\s+App\\\\UseCases\\\\/', 'compartilhado não pode conhecer regra de negócio'],
            ['/use\s+App\\\\Domain\\\\(?!Errors)/', 'compartilhado não pode conhecer domínio específico'],
        ],
        'frontend/src/shared/' => [
            ['#(?:from|import)\s*\(?\s*["\']@?/?(?:\.\./)*(?:src/)?features/#', 'compartilhado não pode importar de feature'],
            ['#(?:from|import)\s*\(?\s*["\']@?/?(?:\.\./)*(?:src/)?pages/#', 'compartilhado não pode importar de página'],
        ],
        // A seta aponta para dentro: a página compõe a feature, não o
        // contrário. Uma feature que importa de `pages/` deixa de ser
        // reutilizável em qualquer outra tela — e a regra existia só na
        // prosa do §2.1 até aqui, o que é o mesmo que não existir.
        'frontend/src/features/' => [
            ['#(?:from|import)\s*\(?\s*["\']@?/?(?:\.\./)*(?:src/)?pages/#', 'feature não pode importar de página'],
        ],
    ];

    /**
     * Todas as violações de um arquivo.
     *
     * @return list<string> mensagens já formatadas com arquivo e motivo
     */
    public static function violations(string $path, string $source): array
    {
        $normalized = str_replace('\\', '/', $path);
        $found = [];

        foreach (self::RULES as $prefix => $rules) {
            if (!str_contains($normalized, $prefix)) {
                continue;
            }

            foreach ($rules as [$pattern, $reason]) {
                if (preg_match($pattern, $source) === 1) {
                    $found[] = "{$normalized}: {$reason}";
                }
            }
        }

        foreach (self::crossFeatureImports($normalized, $source) as $violation) {
            $found[] = $violation;
        }

        return $found;
    }

    /**
     * Isolamento entre features do frontend.
     *
     * Precisa de tratamento próprio porque a regra depende do NOME da feature
     * do arquivo: `features/cards` pode importar de `features/cards`, e não de
     * `features/auth`. Quando duas precisam da mesma coisa, ela sobe para
     * `shared/` — nunca um import cruzado.
     *
     * @return list<string>
     */
    private static function crossFeatureImports(string $path, string $source): array
    {
        if (preg_match('#frontend/src/features/([a-z0-9-]+)/#', $path, $self) !== 1) {
            return [];
        }

        $owner = $self[1];
        $found = [];

        preg_match_all(
            '#(?:from|import)\s*\(?\s*["\'][^"\']*features/([a-z0-9-]+)/#',
            $source,
            $matches
        );

        foreach ($matches[1] as $imported) {
            if ($imported !== $owner) {
                $found[] = "{$path}: feature \"{$owner}\" não pode importar de \"{$imported}\"";
            }
        }

        return $found;
    }
}
