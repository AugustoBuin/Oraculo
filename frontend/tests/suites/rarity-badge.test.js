/**
 * O selo de raridade: o nome sobre o fundo do material, com uma marca.
 *
 * A marca redonda é o que separa o selo de raridade dos selos de estado —
 * "Ouro" não pode ser lido como atenção. Ela é decorativa: quem usa leitor de
 * tela ouve o nome, que está sempre escrito.
 */

import { rarityBadge } from "@/shared/components/rarity-badge.js";
import { assertNull, assertSame, assertTrue, suite, test } from "~/runner.js";

suite("shared/components/rarity-badge · o selo", () => {
  test("leva a classe do material e o nome escrito", () => {
    const selo = rarityBadge({ name: "Rara", color: "gold" });

    assertTrue(selo.classList.contains("rarity-badge"));
    assertTrue(selo.classList.contains("rarity-gold"));
    assertSame(selo.textContent, "Rara");
  });

  test("a marca é decorativa: o leitor de tela ouve só o nome", () => {
    const marca = rarityBadge({ name: "Rara", color: "gold" }).querySelector(".rarity-mark");

    assertSame(marca.getAttribute("aria-hidden"), "true");
  });

  test("cor que o cliente não conhece vira grafite", () => {
    assertTrue(rarityBadge({ name: "Rara", color: "dourado" }).classList.contains("rarity-graphite"));
    assertTrue(rarityBadge({ name: "Rara" }).classList.contains("rarity-graphite"));
  });

  test("o nome é texto, nunca marcação — raridade é dado editável", () => {
    const selo = rarityBadge({ name: "<b>Rara</b>", color: "gold" });

    assertSame(selo.textContent, "<b>Rara</b>");
    assertNull(selo.querySelector("b"));
  });
});
