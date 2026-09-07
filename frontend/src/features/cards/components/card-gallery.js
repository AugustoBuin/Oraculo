/**
 * A grade de cartas.
 *
 * Desenha **um** listener no contêiner e lê o `data-card-id` do cartão clicado.
 * Um listener por cartão seria a diferença entre um listener e mil numa
 * listagem de volume (PADROES-ENGENHARIA.md §12.3).
 */

import { el } from "@/shared/dom/elements.js";
import { cardTile } from "@/features/cards/components/card-tile.js";

/**
 * @param {{ cards: object[], onOpen?: (id: number) => void, scope: object }} config
 */
export function cardGallery({ cards, onOpen, scope }) {
  const grid = el("div", {
    classes: ["card-grid"],
    attrs: { role: "list" },
  });

  for (const card of cards) {
    const tile = cardTile(card, { scope });
    tile.setAttribute("role", "listitem");
    grid.append(tile);
  }

  if (onOpen !== undefined) {
    scope.on(grid, "click", (event) => {
      const tile = event.target.closest?.("[data-card-id]");

      if (tile === null || tile === undefined) {
        return;
      }

      // O id vem do DOM, que é dado de fora a partir do momento em que sai da
      // nossa mão. Um valor não numérico viraria `/cartas/NaN`.
      const id = Number(tile.dataset.cardId);

      if (Number.isInteger(id)) {
        onOpen(id);
      }
    });
  }

  return grid;
}
