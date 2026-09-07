/**
 * Os estados que toda tela precisa desenhar.
 *
 * Carregando · vazio · erro · sucesso · sem permissão. Um componente que só
 * desenha o caminho feliz está incompleto, e isso é achado de revisão
 * (PADROES-ENGENHARIA.md §7.4). Concentrar os cinco aqui é o que faz desenhar
 * todos custar menos do que esquecer um.
 *
 * As mensagens exibidas vêm de quem chama, que já as obteve de `userMessage()`
 * — nenhum texto técnico é construído aqui.
 */

import { el } from "@/shared/dom/elements.js";

/**
 * Indicador de carregamento.
 *
 * `role="status"` com `aria-live="polite"` anuncia sem interromper o que o
 * leitor de tela está lendo. É a exceção prevista do §11.2 para movimento
 * infinito: indicador de progresso pode girar para sempre; rótulo pulsando não.
 */
export function loading(message = "Carregando…") {
  return el("div", {
    classes: ["state", "state-loading"],
    attrs: { role: "status", "aria-live": "polite" },
    children: [
      el("span", { classes: ["spinner"], attrs: { "aria-hidden": "true" } }),
      el("p", { text: message }),
    ],
  });
}

/**
 * Estado vazio.
 *
 * Texto útil, não "Nenhum resultado": quem chega aqui precisa saber o que
 * fazer em seguida, e a ação opcional é o caminho.
 */
export function empty({ title, description, action } = {}) {
  const children = [el("p", { text: title, classes: ["state-title"] })];

  if (description !== undefined) {
    children.push(el("p", { text: description, classes: ["text-muted"] }));
  }

  if (action !== undefined) {
    children.push(action);
  }

  return el("div", { classes: ["state", "state-empty"], children });
}

/**
 * Estado de erro, com ação de tentar novamente.
 *
 * `role="alert"` porque erro que bloqueia interrompe de propósito — é o caso
 * em que `assertive` é o certo (§9.3).
 */
export function failure({ message, action } = {}) {
  const children = [
    // Dois sinais: o ícone acompanha o texto, para a informação não depender
    // só da cor (§9.4).
    el("p", {
      classes: ["state-title"],
      children: [
        el("span", { text: "⚠", attrs: { "aria-hidden": "true" }, classes: ["state-icon"] }),
        el("span", { text: message }),
      ],
    }),
  ];

  if (action !== undefined) {
    children.push(action);
  }

  return el("div", {
    classes: ["state", "state-failure"],
    attrs: { role: "alert" },
    children,
  });
}

/**
 * Sem permissão.
 *
 * Separado do erro de propósito: um `403` **não** desloga e não é falha do
 * usuário (ADR-007). O texto diz o que aconteceu sem sugerir que ele errou.
 */
export function forbidden(message = "Você não tem permissão para ver esta tela.") {
  return el("div", {
    classes: ["state", "state-forbidden"],
    attrs: { role: "status" },
    children: [
      el("p", {
        classes: ["state-title"],
        children: [
          el("span", { text: "🔒", attrs: { "aria-hidden": "true" }, classes: ["state-icon"] }),
          el("span", { text: message }),
        ],
      }),
    ],
  });
}

/**
 * Mensagem inline de formulário.
 *
 * Diferente de `failure()`: não substitui a tela, aparece junto do formulário
 * que continua utilizável.
 */
export function inlineMessage({ message, tone = "danger" }) {
  return el("p", {
    text: message,
    classes: ["inline-message", `inline-message-${tone}`],
    attrs: { role: tone === "danger" ? "alert" : "status" },
  });
}
