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
import { el } from "@/shared/dom/elements.js";
import { scope } from "@/shared/dom/events.js";
import { listCards } from "@/features/cards/api/cards-api.js";
import { cardGallery } from "@/features/cards/components/card-gallery.js";
import { readCardQuery, writeCardQuery } from "@/features/cards/utils/card-query.js";
import { ROUTES } from "@/pages/app-shell/navigation.js";

/**
 * @param {HTMLElement} root
 * @param {{ navigate: (path: string) => void }} config
 * @returns {() => void}
 */
export function cardsPage(root, { navigate }) {
  const life = scope();

  const results = el("div", { classes: ["cards-results"] });

  root.replaceChildren(
    el("div", {
      classes: ["stack-loose"],
      children: [el("h1", { text: "Catálogo de cartas" }), results],
    }),
  );

  /**
   * A requisição no ar.
   *
   * Trocar de página aborta a anterior: sem isso, a resposta atrasada da
   * página 1 pode chegar depois da página 2 e sobrescrever a tela certa — a
   * mesma corrida que o RF-25 descreve na cascata, aqui na paginação.
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

  function goToPage(page) {
    // A URL carrega o estado: recarregar em `?page=2` volta para a página 2, e
    // o botão "voltar" do navegador funciona sem código nenhum a mais.
    // A página compõe caminho + consulta: a feature devolve só o sufixo,
    // porque ela não conhece as rotas da aplicação.
    navigate(ROUTES.cards + writeCardQuery({ ...readCardQuery(window.location.search), page }));
  }

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
        renderInto((scoped) =>
          meta.total === 0 && query.page === 1
            ? empty({
                title: "Nenhuma carta cadastrada ainda",
                description: "Quando o catálogo receber a primeira carta, ela aparece aqui.",
              })
            : empty({
                title: "Nada nesta página",
                description: "A listagem tem menos páginas do que a que você pediu.",
                action: button({
                  label: "Voltar ao início",
                  variant: "secondary",
                  scope: scoped,
                  onClick: () => goToPage(1),
                }).node,
              }),
        );

        return;
      }

      renderInto((scoped) =>
        el("div", {
          classes: ["stack-loose"],
          children: [
            cardGallery({
              cards,
              scope: scoped,
              onOpen: (id) => navigate(`/cartas/${id}`),
            }),
            pagination({
              page: meta.page,
              totalPages: meta.totalPages,
              total: meta.total,
              scope: scoped,
              onChange: goToPage,
            }),
          ],
        }),
      );
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

  load();

  return () => life.dispose();
}
