/**
 * A barra de busca e filtros do catálogo.
 *
 * **Mora na camada de página de propósito.** Ela junta duas features — cartas
 * e catálogos — e o §2.1 dá exatamente três respostas para isso: subir o comum
 * para `shared/`, deixar a página coordenar, ou publicar um evento. O
 * mecanismo genérico subiu (`shared/components/cascade-select.js`); a
 * coordenação entre os dois domínios fica aqui, porque um `import` cruzado
 * entre features é o que nunca pode acontecer.
 */

import {
  CARD_SORT_LABELS,
  CARD_SORT_OPTIONS,
  SEARCH_DEBOUNCE_MS,
} from "@/shared/config/constants.js";
import { cascadeSelect } from "@/shared/components/cascade-select.js";
import { el } from "@/shared/dom/elements.js";
import { listEditions, listGames, listRarities } from "@/features/catalogs/api/catalogs-api.js";

/**
 * @param {{
 *   query: object,
 *   scope: object,
 *   onChange: (partial: object) => void,
 * }} config
 */
export function cardsFilters({ query, scope, onChange }) {
  const search = el("input", {
    attrs: {
      id: "busca",
      type: "search",
      placeholder: "Nome em inglês ou português",
      value: query.search,
      autocomplete: "off",
    },
    classes: ["field-input"],
  });

  const game = el("select", { attrs: { id: "jogo" }, classes: ["field-input"] });

  const edition = cascadeSelect({
    id: "edicao",
    label: "Edição",
    placeholder: "Todas as edições",
    emptyLabel: "Este jogo não tem edições cadastradas.",
    scope,
    loadOptions: (gameId, options) => listEditions(gameId, options),
    onChange: () => emit(),
  });

  const rarity = cascadeSelect({
    id: "raridade",
    label: "Raridade",
    placeholder: "Todas as raridades",
    emptyLabel: "Este jogo não tem raridades cadastradas.",
    scope,
    loadOptions: (gameId, options) => listRarities(gameId, options),
    onChange: () => emit(),
  });

  const sort = el("select", {
    attrs: { id: "ordem" },
    classes: ["field-input"],
    children: CARD_SORT_OPTIONS.map((value) =>
      el("option", { text: CARD_SORT_LABELS[value], attrs: { value } }),
    ),
  });

  sort.value = query.sort;

  function emit() {
    /*
     * Toda alteração de filtro volta para a página 1.
     *
     * Sem isso, filtrar estando na página 2 mostraria "nada nesta página" para
     * uma busca que tem resultados — e o usuário concluiria que não há nada.
     */
    onChange({
      page: 1,
      search: search.value,
      game: game.value === "" ? null : game.value,
      edition: edition.value === "" ? null : edition.value,
      rarity: rarity.value === "" ? null : rarity.value,
      sort: sort.value,
    });
  }

  /**
   * A busca espera a digitação parar.
   *
   * O timer mora no escopo da tela: sair da listagem enquanto o usuário digita
   * cancela o disparo em vez de deixá-lo acontecer sobre uma tela que já
   * morreu (§12.4).
   */
  let debounce = null;

  scope.on(search, "input", () => {
    window.clearTimeout(debounce);
    debounce = scope.timeout(emit, SEARCH_DEBOUNCE_MS);
  });

  // Enter busca na hora: quem digitou e apertou Enter não deve esperar o
  // atraso terminar.
  scope.on(search, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      window.clearTimeout(debounce);
      emit();
    }
  });

  scope.on(sort, "change", emit);

  scope.on(game, "change", async () => {
    // Trocar o jogo recarrega as duas listas e reseta as duas seleções
    // (RF-24/RF-27). O `emit` vem depois, já com os filhos limpos.
    await Promise.allSettled([edition.setParent(game.value), rarity.setParent(game.value)]);
    emit();
  });

  async function loadGames() {
    game.replaceChildren(el("option", { text: "Carregando jogos…", attrs: { value: "" } }));
    game.disabled = true;

    const controller = scope.controller();

    try {
      const games = await listGames({ signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      game.replaceChildren(
        el("option", { text: "Todos os jogos", attrs: { value: "" } }),
        ...games.map((item) => el("option", { text: item.name, attrs: { value: item.id } })),
      );

      game.disabled = false;
      game.value = query.game ?? "";

      if (game.value !== "") {
        // Restaura a cascata a partir da URL, sem apagar a seleção que veio
        // dela — é o que faz recarregar em `?jogo=magic&edicao=dom` funcionar.
        edition.setValue(query.edition ?? "");
        rarity.setValue(query.rarity ?? "");

        await Promise.allSettled([
          edition.setParent(game.value, { keepSelection: true }),
          rarity.setParent(game.value, { keepSelection: true }),
        ]);
      }
    } catch (error) {
      // Cancelar não é falhar: sair da tela não pode virar registro de erro
      // nem estado de falha num controle que já foi descartado.
      if (controller.signal.aborted) {
        return;
      }

      game.replaceChildren(el("option", { text: "Não foi possível carregar", attrs: { value: "" } }));
      console.error("[filtros] falha ao carregar os jogos", { error });
    }
  }

  const field = (id, label, control) =>
    el("div", {
      classes: ["field"],
      children: [
        el("label", { text: label, attrs: { for: id }, classes: ["field-label"] }),
        control,
      ],
    });

  const node = el("section", {
    classes: ["filters"],
    attrs: { "aria-label": "Busca e filtros" },
    children: [
      field("busca", "Buscar", search),
      field("jogo", "Jogo", game),
      edition.wrapper,
      rarity.wrapper,
      field("ordem", "Ordenar por", sort),
    ],
  });

  loadGames();

  return {
    node,

    /**
     * Reescreve os controles a partir da consulta.
     *
     * Existe porque a consulta pode mudar **de fora** da barra: a ação "limpar
     * busca e filtros" do estado vazio é o caso. Sem isto, a listagem voltava
     * a mostrar tudo e o campo de busca continuava com o texto que não achou
     * nada — duas verdades na mesma tela (§6.2).
     *
     * Não é chamada durante a digitação: sincronizar ali brigaria com quem
     * está escrevendo.
     */
    async sync(next) {
      search.value = next.search;
      sort.value = next.sort;

      const nextGame = next.game ?? "";
      const gameChanged = game.value !== nextGame;

      game.value = nextGame;

      if (nextGame === "") {
        await Promise.allSettled([edition.setParent(""), rarity.setParent("")]);
        return;
      }

      edition.setValue(next.edition ?? "");
      rarity.setValue(next.rarity ?? "");

      if (gameChanged) {
        await Promise.allSettled([
          edition.setParent(nextGame, { keepSelection: true }),
          rarity.setParent(nextGame, { keepSelection: true }),
        ]);
      }
    },
  };
}
