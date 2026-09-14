/**
 * A confirmação de exclusão, e o desfazer.
 *
 * **Decisão de UX nº 2, e as duas metades importam:**
 *
 *   A confirmação **escreve o nome da carta e a edição**. "Tem certeza?" é
 *   lido no automático por qualquer pessoa depois da décima vez; um modal que
 *   diz *"Excluir Black Lotus de Dominaria?"* obriga a reconhecer o objeto.
 *
 *   E, principalmente: **a proteção real não é a confirmação, é a
 *   reversibilidade.** Erro humano é inevitável; o que se projeta é quanto ele
 *   custa. Por baixo a exclusão é lógica (RN-05), e é isso que torna o
 *   desfazer possível.
 */

import { userMessage } from "@/shared/api/errors.js";
import { button } from "@/shared/components/button.js";
import { openModal } from "@/shared/components/modal.js";
import { UNDO_WINDOW_MS } from "@/shared/config/constants.js";
import { el } from "@/shared/dom/elements.js";
import { scope } from "@/shared/dom/events.js";
import { cardBack } from "@/features/cards/components/card-back.js";
import { deleteCard, restoreCard } from "@/features/cards/api/cards-api.js";

/**
 * A proporção da carta, para a miniatura reservar o espaço antes da imagem
 * chegar: o modal não pode dar um salto com ele já aberto (§12.2).
 */
const CARD_WIDTH = 488;
const CARD_HEIGHT = 680;

/**
 * O conteúdo do modal: a carta à esquerda, a explicação ao lado.
 *
 * **Exportado para a rede de geometria.** O modal em si não entra nela — o
 * `openModal` prende a caixa ao `document.body`, e a largura dela vem da
 * janela, não do contêiner que a rede controla. O que tem geometria é este
 * arranjo, e testar o nó de verdade vale mais do que testar uma cópia
 * parecida montada no teste.
 *
 * A primitiva `.sidebar` faz a leitura virar título, carta, explicação. No
 * modal de 28rem os três cabem (4 + 1 + 14 = 19rem no vão de 25rem); quando a
 * tela aperta, a miniatura sobe para a linha de cima em vez de espremer a
 * explicação — que foi exatamente o defeito do OF-004, do outro lado da tela.
 *
 * @param {{ card: object, scope: object }} config
 */
export function deleteCardPreview({ card, scope: life }) {
  const verso = () => cardBack({ classes: ["card-thumb"] });
  let miniatura;

  if (card.imageUrl === null) {
    miniatura = verso();
  } else {
    miniatura = el("img", {
      classes: ["card-thumb"],
      attrs: {
        src: card.imageUrl,
        // O título do modal já nomeia a carta: um `alt` com o nome faria o
        // leitor de tela dizer a mesma coisa duas vezes (§9.5).
        alt: "",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        decoding: "async",
      },
    });

    // Mesmo tratamento da galeria: imagem que não existe mais vira o verso, e
    // não o ícone quebrado do navegador (§7.3, RF-34).
    const trocar = () => miniatura.replaceWith(verso());

    life.on(miniatura, "error", trocar, { once: true });
  }

  return el("div", {
    classes: ["sidebar", "delete-card-preview"],
    children: [
      el("div", { classes: ["sidebar-side"], children: [miniatura] }),
      el("p", {
        classes: ["sidebar-content"],
        text: "A exclusão pode ser desfeita logo em seguida. Depois disso, a carta some das listagens.",
      }),
    ],
  });
}

/**
 * Abre a confirmação. Chama `onDone` quando a listagem precisa recarregar.
 *
 * @param {{
 *   card: object,
 *   notify: Function,
 *   onDone: () => void,
 * }} config
 */
export function confirmCardDeletion({ card, notify, onDone }) {
  const life = scope();

  const cancel = button({
    label: "Cancelar",
    variant: "ghost",
    scope: life,
    onClick: () => modal.close(),
  });

  const confirm = button({
    label: "Excluir",
    variant: "danger",
    scope: life,
    onClick: async () => {
      confirm.setLoading(true, "Excluindo…");
      cancel.setDisabled(true);

      try {
        await deleteCard(card.id);
        modal.close();
        onDone();
        offerUndo();
      } catch (error) {
        modal.close();
        notify({ message: userMessage(error), tone: "danger" });
      } finally {
        life.dispose();
      }
    },
  });

  /**
   * O aviso com o desfazer.
   *
   * O prazo vem de constante nomeada, e o timer mora no escopo do próprio
   * aviso: sair da tela cancela o disparo em vez de deixá-lo acontecer sobre
   * um DOM que já morreu (§12.4).
   */
  function offerUndo() {
    notify({
      message: `"${card.nameEn}" foi excluída.`,
      tone: "attention",
      durationMs: UNDO_WINDOW_MS,
      actionLabel: "Desfazer",
      onAction: async () => {
        try {
          await restoreCard(card.id);
          notify({ message: `"${card.nameEn}" foi restaurada.`, tone: "success" });
        } catch (error) {
          // O `409` chega quando alguém já restaurou, ou quando outra pessoa
          // mexeu no meio. A mensagem do servidor explica; um erro cru não.
          notify({ message: userMessage(error), tone: "danger" });
        } finally {
          onDone();
        }
      },
    });
  }

  const onde = card.edition?.name;

  const modal = openModal({
    // O nome vai no TÍTULO, não numa pergunta genérica. E por `textContent`,
    // como todo dado do catálogo (§8.3).
    title: onde ? `Excluir "${card.nameEn}" de ${onde}?` : `Excluir "${card.nameEn}"?`,
    content: deleteCardPreview({ card, scope: life }),
    actions: [cancel.node, confirm.node],
    onClose: () => life.dispose(),
  });

  return modal;
}
