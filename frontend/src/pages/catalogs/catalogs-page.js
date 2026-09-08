/**
 * A administração de catálogos — edições e raridades, por jogo.
 *
 * **Gestão de jogos não existe, e é decisão registrada** (`api-contract.md`
 * §4): criar um jogo sem raridades deixaria o sistema num estado pior do que
 * não ter o botão — o primeiro cadastro de carta naquele jogo travaria, sem
 * raridade para escolher. Abrir um TCG novo é operação estrutural e rara,
 * melhor atendida por uma migration que traga o catálogo completo.
 */

import { userMessage } from "@/shared/api/errors.js";
import { failure, loading } from "@/shared/components/feedback.js";
import { el } from "@/shared/dom/elements.js";
import { scope as createScope } from "@/shared/dom/events.js";
import {
  createEdition,
  createRarity,
  deactivateEdition,
  deactivateRarity,
  listEditionsForAdmin,
  listGames,
  listRaritiesForAdmin,
  updateEdition,
  updateRarity,
} from "@/features/catalogs/api/catalogs-api.js";
import { catalogPanel } from "@/features/catalogs/components/catalog-panel.js";

const EDITIONS_API = {
  list: listEditionsForAdmin,
  create: createEdition,
  update: updateEdition,
  deactivate: deactivateEdition,
};

const RARITIES_API = {
  list: listRaritiesForAdmin,
  create: createRarity,
  update: updateRarity,
  deactivate: deactivateRarity,
};

/**
 * @param {HTMLElement} root
 * @param {{ notify: Function }} config
 */
export function catalogsPage(root, { notify }) {
  const life = createScope();

  const game = el("select", { attrs: { id: "jogo-catalogo" }, classes: ["field-input"] });
  const panels = el("div", { classes: ["catalog-panels"] });

  /** A vida dos dois painéis do jogo corrente. */
  let panelsLife = null;

  life.add(() => panelsLife?.dispose());

  function renderPanels(gameId) {
    panelsLife?.dispose();
    panelsLife = createScope();

    if (gameId === "") {
      panels.replaceChildren();
      return;
    }

    const editions = catalogPanel({
      title: "Edições",
      singular: "edição",
      gameId,
      scope: panelsLife,
      notify,
      api: EDITIONS_API,
    });

    const rarities = catalogPanel({
      title: "Raridades",
      singular: "raridade",
      gameId,
      scope: panelsLife,
      notify,
      api: RARITIES_API,
    });

    panels.replaceChildren(editions.node, rarities.node);
  }

  life.on(game, "change", () => renderPanels(game.value));

  async function loadGames() {
    panels.replaceChildren(loading("Carregando os jogos…"));

    try {
      const games = await listGames();

      game.replaceChildren(
        ...games.map((item) => el("option", { text: item.name, attrs: { value: item.id } })),
      );

      // Abre já no primeiro jogo: uma tela de administração que começa vazia
      // obriga um clique que não decide nada.
      game.value = games[0]?.id ?? "";
      renderPanels(game.value);
    } catch (error) {
      panels.replaceChildren(failure({ message: userMessage(error) }));
    }
  }

  root.replaceChildren(
    el("div", {
      classes: ["stack-loose"],
      children: [
        el("h1", { text: "Administração de catálogos" }),
        el("p", {
          text:
            "Desativar um item o remove dos cadastros novos, mas as cartas que já o usam " +
            "continuam como estão. Nada é apagado.",
          classes: ["text-muted"],
        }),
        el("div", {
          classes: ["field", "catalog-game-picker"],
          children: [
            el("label", {
              text: "Jogo",
              attrs: { for: "jogo-catalogo" },
              classes: ["field-label"],
            }),
            game,
          ],
        }),
        panels,
      ],
    }),
  );

  loadGames();

  return () => life.dispose();
}
