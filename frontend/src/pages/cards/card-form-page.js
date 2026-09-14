/**
 * A tela de cadastro e de edição de carta.
 *
 * **É aqui que cartas e catálogos se encontram.** As duas features não podem
 * se importar (§2.1); a página é a camada autorizada a conhecer as duas, e
 * injeta os carregadores de catálogo no formulário.
 */

import { ApiError, userMessage } from "@/shared/api/errors.js";
import { button } from "@/shared/components/button.js";
import { failure, forbidden, loading } from "@/shared/components/feedback.js";
import { el } from "@/shared/dom/elements.js";
import { scope } from "@/shared/dom/events.js";
import { getCard } from "@/features/cards/api/cards-api.js";
import { cardForm } from "@/features/cards/components/card-form.js";
import { cardHistory } from "@/features/cards/components/card-history.js";
import {
  listEditions,
  listGames,
  listRarities,
} from "@/features/catalogs/api/catalogs-api.js";
import { ROUTES } from "@/pages/app-shell/navigation.js";

const catalogs = { listGames, listEditions, listRarities };

/**
 * @param {HTMLElement} root
 * @param {{ navigate: Function, notify: Function }} config
 * @param {{ id?: string }} params
 */
export function cardFormPage(root, { navigate, notify }, params = {}) {
  const life = scope();
  const isEditing = params.id !== undefined;

  const container = el("div", { classes: ["form-layout"] });

  root.replaceChildren(
    el("div", {
      classes: ["stack-loose"],
      children: [
        el("h1", { text: isEditing ? "Editar carta" : "Nova carta" }),
        container,
      ],
    }),
  );

  function mountForm(card) {
    const form = cardForm({
      scope: life,
      card,
      catalogs,
      onSaved: (saved) => {
        notify({
          message: card === null
            ? `"${saved.nameEn}" foi cadastrada.`
            : `"${saved.nameEn}" foi atualizada.`,
          tone: "success",
        });

        navigate(ROUTES.cards);
      },
      onCancel: () => navigate(ROUTES.cards),
    });

    const sections = [el("section", { classes: ["card"], children: [form.node] })];

    if (card !== null) {
      // O histórico só existe para carta que existe, e só é buscado quando
      // alguém abre o painel (§12.2).
      sections.push(
        el("section", {
          classes: ["card"],
          children: [cardHistory({ cardId: card.id, scope: life }).node],
        }),
      );
    }

    container.replaceChildren(...sections);
    form.focus();
  }

  async function loadForEditing() {
    container.replaceChildren(loading("Carregando a carta…"));

    const controller = new AbortController();
    life.add(() => controller.abort());

    try {
      const card = await getCard(params.id, { signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      mountForm(card);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      if (error instanceof ApiError && error.isForbidden) {
        container.replaceChildren(forbidden("Você não tem permissão para editar cartas."));
        return;
      }

      container.replaceChildren(
        failure({
          message: userMessage(error),
          action: button({
            label: "Voltar ao catálogo",
            variant: "secondary",
            scope: life,
            onClick: () => navigate(ROUTES.cards),
          }).node,
        }),
      );
    }
  }

  if (isEditing) {
    loadForEditing();
  } else {
    mountForm(null);
  }

  return () => life.dispose();
}
