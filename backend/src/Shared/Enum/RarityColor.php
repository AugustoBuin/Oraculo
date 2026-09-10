<?php

declare(strict_types=1);

namespace App\Shared\Enum;

/**
 * A cor de uma raridade: um material da paleta, nunca um hexadecimal livre.
 *
 * Cada chave corresponde a um par de fundo e tinta definido e medido nos dois
 * temas (`frontend/src/styles/tokens.css`, `docs/design.md` §3). Com
 * hexadecimal livre, uma cor que passa no claro reprovaria no escuro, e quem a
 * escolhe não teria como saber.
 *
 * Os estados da interface são as pedras do oráculo — rubi, topázio, jade,
 * safira, ametista. As raridades são materiais, e os matizes ficam nos vãos
 * entre os estados, para que um selo de raridade não seja lido como aviso.
 *
 * A coluna `rarities.color` é VARCHAR, e não ENUM, de propósito: esta é a
 * allowlist, e trocar a paleta não pede migration.
 */
enum RarityColor: string
{
    case GRAPHITE = 'graphite';
    case SILVER = 'silver';
    case COPPER = 'copper';
    case GOLD = 'gold';
    case OLIVINE = 'olivine';
    case PATINA = 'patina';
    case AQUAMARINE = 'aquamarine';
    case TOURMALINE = 'tourmaline';
    case ROSE_QUARTZ = 'rose-quartz';
    case OBSIDIAN = 'obsidian';

    /** O selo neutro de antes da paleta: raridade que ninguém pintou fica como era. */
    public const DEFAULT = self::GRAPHITE;

    /**
     * A cor gravada, com o padrão no lugar de um valor fora da paleta.
     *
     * Na escrita, cor fora da paleta é recusada. Na leitura, um valor inválido
     * só chega por escrita direta no banco — e derrubar a leitura por isso
     * tiraria do ar a galeria inteira por causa de uma linha.
     */
    public static function fromStored(mixed $raw): self
    {
        return is_string($raw) ? self::tryFrom($raw) ?? self::DEFAULT : self::DEFAULT;
    }
}
