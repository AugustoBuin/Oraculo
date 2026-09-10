/**
 * A paleta de cores de raridade, do lado do cliente.
 *
 * Espelha `App\Shared\Enum\RarityColor`; a fonte comum dos dois é a tabela do
 * `api-contract.md` §4. A ordem importa: é a do seletor.
 */

import { DEFAULT_RARITY_COLOR, RARITY_COLORS, rarityColor } from "@/features/catalogs/rarity-colors.js";
import { assertSame, suite, test } from "~/runner.js";

suite("features/catalogs · a paleta de raridade", () => {
  test("são dez materiais, na ordem da paleta, com o nome em português", () => {
    assertSame(
      RARITY_COLORS.map((color) => color.key).join(" "),
      "graphite silver copper gold olivine patina aquamarine tourmaline rose-quartz obsidian",
    );
    assertSame(RARITY_COLORS[6].label, "Água-marinha");
  });

  test("o padrão é o grafite, o selo neutro de antes da paleta", () => {
    assertSame(DEFAULT_RARITY_COLOR, "graphite");
  });

  test("chave da paleta passa como veio", () => {
    assertSame(rarityColor("rose-quartz"), "rose-quartz");
  });

  test("qualquer outra coisa vira o padrão — cor não é motivo para sumir com uma carta", () => {
    assertSame(rarityColor("dourado"), "graphite");
    assertSame(rarityColor(undefined), "graphite");
    assertSame(rarityColor(7), "graphite");
  });
});
