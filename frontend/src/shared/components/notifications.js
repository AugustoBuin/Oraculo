/**
 * Avisos temporários, anunciados para leitor de tela.
 *
 * A região é **viva**: `polite` para status, que espera a leitura corrente
 * terminar, e `alert` para erro, que interrompe. Usar `assertive` para tudo
 * transforma a interface num megafone e leva a pessoa a desligar o recurso
 * (PADROES-ENGENHARIA.md §9.3).
 *
 * É também a peça do "Desfazer" da Decisão de UX nº 2 (F-033): o aviso aceita
 * uma ação, e o prazo dela é cancelado se a tela morrer antes.
 */

import { userMessage } from "@/shared/api/errors.js";
import { button } from "@/shared/components/button.js";
import { el } from "@/shared/dom/elements.js";
import { scope } from "@/shared/dom/events.js";

/** Quanto tempo um aviso comum fica. */
const DEFAULT_DURATION_MS = 5000;

const TONES = new Set(["success", "attention", "danger", "info"]);

export function createNotifications() {
  const life = scope();

  const region = el("div", {
    classes: ["notifications"],
    attrs: {
      // O contêiner é anunciado como região viva desde o início: criá-lo junto
      // com a mensagem faria o leitor de tela perder o primeiro aviso.
      "aria-live": "polite",
      "aria-atomic": "false",
    },
  });

  /**
   * @param {{
   *   message: string,
   *   tone?: "success" | "attention" | "danger" | "info",
   *   actionLabel?: string,
   *   onAction?: () => void,
   *   durationMs?: number,
   * }} config
   * @returns {() => void} dispensa o aviso
   */
  function notify({
    message,
    tone = "info",
    actionLabel,
    onAction,
    durationMs = DEFAULT_DURATION_MS,
  }) {
    if (!TONES.has(tone)) {
      throw new TypeError(`Tom de aviso desconhecido: "${tone}".`);
    }

    const itemLife = scope();
    life.add(() => itemLife.dispose());

    const children = [
      // Dois sinais: o texto carrega a informação, a cor só reforça (§9.4).
      el("span", { text: message, classes: ["notification-text"] }),
    ];

    let dismiss = () => {};

    if (actionLabel !== undefined && onAction !== undefined) {
      const action = button({
        label: actionLabel,
        variant: "ghost",
        scope: itemLife,
        onClick: () => {
          onAction();
          dismiss();
        },
      });

      children.push(action.node);
    }

    const item = el("div", {
      classes: ["notification", `notification-${tone}`],
      // Erro interrompe de propósito; o resto espera a vez.
      attrs: { role: tone === "danger" ? "alert" : "status" },
      children,
    });

    dismiss = () => {
      itemLife.dispose();
      item.remove();
    };

    region.append(item);

    if (durationMs > 0) {
      // O timer mora no escopo do próprio aviso: sair da tela cancela o prazo
      // em vez de deixá-lo disparar sobre um DOM que não existe mais (§12.4).
      itemLife.timeout(dismiss, durationMs);
    }

    return dismiss;
  }

  return {
    node: region,
    notify,

    /**
     * Atalho para ligar ao relator de erro do cliente HTTP.
     *
     * Passa por `userMessage()` mesmo recebendo sempre um `ApiError`: é a
     * única função que garante que nada técnico chega à tela, e contorná-la
     * "porque aqui já é seguro" é como a garantia se perde na primeira vez que
     * outro caminho chamar isto.
     */
    reportError(error) {
      notify({ message: userMessage(error), tone: "danger" });
    },

    dispose: () => life.dispose(),
  };
}
