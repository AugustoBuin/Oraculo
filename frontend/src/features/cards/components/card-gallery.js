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
export function cardGallery({ cards, onOpen, onDelete, scope }) {
  const grid = el("div", {
    classes: ["card-grid"],
    attrs: { role: "list" },
  });

  const byId = new Map();

  for (const card of cards) {
    const tile = cardTile(card, {
      scope,
      canDelete: onDelete !== undefined,
      canOpen: onOpen !== undefined,
    });
    tile.setAttribute("role", "listitem");
    byId.set(card.id, card);
    grid.append(tile);
  }

  if (onOpen !== undefined || onDelete !== undefined) {
    const act = (target) => {
      const tile = target.closest?.("[data-card-id]");

      if (tile === null || tile === undefined) {
        return;
      }

      // O id vem do DOM, que é dado de fora a partir do momento em que sai da
      // nossa mão. Um valor não numérico viraria `/cartas/NaN`.
      const id = Number(tile.dataset.cardId);

      if (!Number.isInteger(id)) {
        return;
      }

      // A ação de excluir precisa vencer a de abrir: sem esta checagem, clicar
      // em "Excluir" também navegaria para a edição.
      if (target.closest?.('[data-action="delete"]') !== null) {
        onDelete?.(byId.get(id));
        return;
      }

      onOpen?.(id);
    };

    scope.on(grid, "click", (event) => act(event.target));

    /*
     * Tudo que se faz com o mouse se faz com o teclado (§9.2). O cartão tem
     * `tabindex`, então Enter e Espaço precisam agir — é o que um `button`
     * nativo daria de graça e um `article` não dá.
     *
     * O botão de excluir é nativo e já traduz as duas teclas em `click`
     * sozinho; sem a saída antecipada, a mesma tecla seria contada duas vezes,
     * e uma exclusão acabaria navegando para a edição da carta que se quer
     * excluir. É o mesmo cuidado de `card-table.js`.
     */
    scope.on(grid, "keydown", (event) => {
      if (event.target.closest?.('[data-action="delete"]') !== null) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        // Espaço rola a página por padrão. Sem cancelar, abrir uma carta pelo
        // teclado deixaria a listagem rolada para outro ponto ao voltar.
        event.preventDefault();
        act(event.target);
      }
    });
  }

  return grid;
}
