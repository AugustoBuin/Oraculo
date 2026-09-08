/**
 * O catálogo de cartas.
 *
 * A página compõe e coordena; quem busca é a camada de dados e quem desenha
 * são os componentes (§2.2).
 *
 * **Os cinco estados existem todos** (§7.4): carregando, vazio, erro com ação
 * de tentar de novo, sucesso, e sem permissão — este último alcançável quando
 * o servidor recusa a leitura, mesmo que o menu já esconda o que não cabe ao
 * perfil.
 */

import { ApiError, userMessage } from "@/shared/api/errors.js";
import { button } from "@/shared/components/button.js";
import { empty, failure, forbidden, loading } from "@/shared/components/feedback.js";
import { pagination } from "@/shared/components/pagination.js";
import { segmentedControl } from "@/shared/components/segmented-control.js";
import {
  CARD_VIEWS,
  DEFAULT_CARD_VIEW,
  STORAGE_KEYS,
} from "@/shared/config/constants.js";
import { el } from "@/shared/dom/elements.js";
import { scope } from "@/shared/dom/events.js";
import { hasLevel } from "@/shared/session/session.js";
import { readPreference, writePreference } from "@/shared/storage/preference.js";
import { listCards } from "@/features/cards/api/cards-api.js";
import { cardGallery } from "@/features/cards/components/card-gallery.js";
import { cardTable } from "@/features/cards/components/card-table.js";
import { confirmCardDeletion } from "@/features/cards/components/delete-card-dialog.js";
import { readCardQuery, writeCardQuery } from "@/features/cards/utils/card-query.js";
import { ROUTES } from "@/pages/app-shell/navigation.js";
import { cardsFilters } from "@/pages/cards/cards-filters.js";

/**
 * @param {HTMLElement} root
 * @param {{ navigate: (path: string) => void }} config
 * @returns {() => void}
 */
export function cardsPage(root, { navigate, notify }) {
  const life = scope();

  const results = el("div", { classes: ["cards-results"] });

  const VIEW_VALUES = Object.values(CARD_VIEWS);

  /**
   * A visão escolhida, lembrada no navegador (RF-13).
   *
   * Valor inválido no armazenamento cai no padrão sem quebrar — ele é dado de
   * fora como qualquer outro (§8.5). E só a preferência vai para lá: nenhum
   * dado de carta, nenhum dado pessoal (§8.7).
   */
  let view = readPreference(STORAGE_KEYS.cardsView, VIEW_VALUES, DEFAULT_CARD_VIEW);

  /**
   * O último resultado carregado.
   *
   * Guardado para que **alternar a visão não refaça a requisição**: é o mesmo
   * dado, outra apresentação. Rebuscar aqui seria pagar uma ida ao servidor
   * para redesenhar o que já está na memória.
   */
  let lastResult = null;

  /**
   * Quem só consulta não abre o formulário.
   *
   * O cartão deixa de ser clicável em vez de levar a uma tela de "sem
   * permissão": a forma mais eficaz de proteger quem tem menos familiaridade
   * com tecnologia não é uma interface mais simples — é não lhe dar um botão
   * que ela não precisa apertar. O servidor recusa de qualquer forma (§8.1).
   */
  const canEdit = hasLevel("EDITOR");
  const openCard = canEdit ? (id) => navigate(ROUTES.editCard(id)) : undefined;

  /**
   * Excluir também é privilégio de quem edita.
   *
   * O botão nem existe para quem consulta — e o servidor recusa de qualquer
   * forma, porque esconder é conveniência visual, não autorização (§8.1).
   */
  const deleteCardFlow = canEdit
    ? (card) => confirmCardDeletion({ card, notify, onDone: () => load() })
    : undefined;

  const viewToggle = segmentedControl({
    label: "Visualização",
    options: [
      { value: CARD_VIEWS.GALLERY, label: "Galeria" },
      { value: CARD_VIEWS.TABLE, label: "Tabela" },
    ],
    value: view,
    scope: life,
    onChange: (next) => {
      view = next;
      writePreference(STORAGE_KEYS.cardsView, next, VIEW_VALUES);

      if (lastResult !== null) {
        renderResults(lastResult);
      }
    },
  });

  const filters = cardsFilters({
    query: readCardQuery(window.location.search),
    scope: life,
    onChange: (partial) => updateQuery(partial),
  });

  root.replaceChildren(
    el("div", {
      classes: ["stack-loose"],
      children: [
        el("div", {
          classes: ["page-header"],
          children: [
            el("h1", { text: "Catálogo de cartas" }),
            el("div", {
              classes: ["page-actions"],
              children: canEdit
                ? [
                    viewToggle.node,
                    button({
                      label: "Nova carta",
                      variant: "primary",
                      scope: life,
                      onClick: () => navigate(ROUTES.newCard),
                    }).node,
                  ]
                : [viewToggle.node],
            }),
          ],
        }),
        filters.node,
        results,
      ],
    }),
  );

  /**
   * A requisição no ar.
   *
   * Trocar de página ou de filtro aborta a anterior: sem isso, a resposta
   * atrasada de uma busca pode chegar depois da seguinte e sobrescrever a tela
   * certa — a mesma corrida que o RF-25 descreve na cascata.
   */
  let inFlight = null;

  life.add(() => inFlight?.abort());

  /** O escopo dos componentes da listagem corrente. */
  let renderLife = null;

  const renderInto = (build) => {
    renderLife?.dispose();
    renderLife = scope();
    results.replaceChildren(build(renderLife));
  };

  life.add(() => renderLife?.dispose());

  /**
   * Atualiza a consulta na URL **sem remontar a tela**.
   *
   * Filtro não é troca de rota: é estado dentro da mesma rota. Passar por
   * `navigate()` remontaria a página inteira, e a caixa de busca perderia o
   * foco no meio da digitação — a pessoa digitaria três letras e o cursor
   * sumiria.
   *
   * O histórico continua funcionando: o "voltar" do navegador dispara
   * `popstate`, o roteador remonta a página, e ela lê a URL de novo.
   */
  function updateQuery(partial, { syncFilters = false } = {}) {
    const next = { ...readCardQuery(window.location.search), ...partial };
    const url = ROUTES.cards + writeCardQuery(next);

    if (url === window.location.pathname + window.location.search) {
      return;
    }

    window.history.pushState({}, "", url);

    // Quando a mudança veio de FORA da barra de filtros, ela precisa se
    // reescrever — senão a listagem mostra uma coisa e os controles dizem
    // outra (§6.2).
    if (syncFilters) {
      filters.sync(next);
    }

    load();
  }

  const goToPage = (page) => updateQuery({ page });

  async function load() {
    inFlight?.abort();

    const controller = new AbortController();
    inFlight = controller;

    renderInto(() => loading("Carregando as cartas…"));

    try {
      const query = readCardQuery(window.location.search);
      const { cards, pagination: meta, discarded } = await listCards(query, {
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return;
      }

      if (discarded > 0) {
        // Silencioso para quem usa, registrado para quem desenvolve: a tela
        // continua utilizável e o dado ruim não some do radar (§7.3).
        console.error("[cards] cartas descartadas por não baterem com o contrato", { discarded });
      }

      if (cards.length === 0) {
        lastResult = null;
        renderInto((scoped) => emptyStateFor(query, meta, scoped));
        return;
      }

      lastResult = { cards, meta };
      renderResults(lastResult);
    } catch (error) {
      // Cancelamento deliberado não é erro e não vira tela: quem abortou foi a
      // própria navegação.
      if (controller.signal.aborted) {
        return;
      }

      if (error instanceof ApiError && error.isForbidden) {
        renderInto(() => forbidden("Você não tem permissão para ver o catálogo."));
        return;
      }

      renderInto((scoped) =>
        failure({
          message: userMessage(error),
          action: button({
            label: "Tentar novamente",
            variant: "secondary",
            scope: scoped,
            onClick: () => load(),
          }).node,
        }),
      );
    }
  }

  /** Desenha a listagem na visão corrente, a partir de dado já carregado. */
  function renderResults({ cards, meta }) {
    renderInto((scoped) => {
      const listing =
        view === CARD_VIEWS.TABLE
          ? cardTable({ cards, scope: scoped, onOpen: openCard, onDelete: deleteCardFlow })
          : cardGallery({ cards, scope: scoped, onOpen: openCard, onDelete: deleteCardFlow });

      return el("div", {
        classes: ["stack-loose"],
        children: [
          listing,
          pagination({
            page: meta.page,
            totalPages: meta.totalPages,
            total: meta.total,
            scope: scoped,
            onChange: goToPage,
          }),
        ],
      });
    });
  }

  /**
   * O estado vazio diz **por que** está vazio.
   *
   * "Nenhum resultado" sozinho deixa a pessoa sem saber se o catálogo está
   * vazio, se o filtro é restritivo demais, ou se ela errou a busca (§7.4).
   */
  function emptyStateFor(query, meta, scoped) {
    const filtering =
      query.search !== "" || query.game !== null || query.edition !== null || query.rarity !== null;

    if (filtering) {
      return empty({
        title: "Nenhuma carta encontrada",
        description: "Nenhuma carta corresponde à busca e aos filtros escolhidos.",
        action: button({
          label: "Limpar busca e filtros",
          variant: "secondary",
          scope: scoped,
          onClick: () =>
            updateQuery(
              { page: 1, search: "", game: null, edition: null, rarity: null },
              { syncFilters: true },
            ),
        }).node,
      });
    }

    if (meta.total === 0) {
      return empty({
        title: "Nenhuma carta cadastrada ainda",
        description: "Quando o catálogo receber a primeira carta, ela aparece aqui.",
      });
    }

    return empty({
      title: "Nada nesta página",
      description: "A listagem tem menos páginas do que a que você pediu.",
      action: button({
        label: "Voltar ao início",
        variant: "secondary",
        scope: scoped,
        onClick: () => goToPage(1),
      }).node,
    });
  }

  load();

  return () => life.dispose();
}
