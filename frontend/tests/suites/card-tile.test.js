/**
 * O cartão da galeria.
 *
 * A suíte nasceu de um defeito encontrado na passagem de acessibilidade de
 * F-050: a página tem `h1` e o cartão vinha com `h3`, pulando o nível
 * intermediário. Leitor de tela que navega por cabeçalhos anuncia um salto de
 * nível como estrutura faltando — a pessoa procura a seção que não existe.
 */

import { cardTile } from "@/features/cards/components/card-tile.js";
import { scope } from "@/shared/dom/events.js";
import { assertCount, assertSame, suite, test } from "~/runner.js";

/** Uma carta já normalizada por `parseCard`, no formato que o cartão consome. */
function carta(overrides = {}) {
  return {
    id: 7,
    nameEn: "Blue-Eyes White Dragon",
    namePt: "Dragão Branco de Olhos Azuis",
    imageUrl: null,
    game: { name: "Yu-Gi-Oh!" },
    edition: { name: "Legend of Blue Eyes" },
    rarity: { name: "Secreta" },
    ...overrides,
  };
}

function comCartao(body, config = {}) {
  const life = scope();

  try {
    return body(cardTile(carta(config.card), { scope: life, canDelete: config.canDelete ?? false }));
  } finally {
    life.dispose();
  }
}

suite("features/cards/components/card-tile · hierarquia de cabeçalhos", () => {
  test("o nome da carta é h2 — o nível seguinte ao h1 da página (RNF-06)", () =>
    comCartao((tile) => {
      const heading = tile.querySelector("h1, h2, h3, h4, h5, h6");

      assertSame(heading.tagName, "H2");
      assertSame(heading.textContent, "Blue-Eyes White Dragon");
    }));

  test("o cartão traz UM cabeçalho — o nome; o resto é texto comum", () =>
    comCartao((tile) => {
      assertCount(tile.querySelectorAll("h1, h2, h3, h4, h5, h6"), 1);
    }));
});
