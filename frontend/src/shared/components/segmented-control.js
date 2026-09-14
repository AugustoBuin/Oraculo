/**
 * Escolha entre poucas opções mutuamente exclusivas.
 *
 * Botões de verdade, com `aria-pressed`: é o que anuncia qual está ativo para
 * quem não vê o destaque visual. Só marcar com cor deixaria a informação
 * invisível para leitor de tela e para quem não distingue os tons — a regra
 * dos dois sinais (PADROES-ENGENHARIA.md §9.4).
 *
 * Componente global: não sabe o que está sendo alternado (§2.3).
 */

import { el } from "@/shared/dom/elements.js";

/**
 * @param {{
 *   label: string,
 *   options: Array<{ value: string, label: string }>,
 *   value: string,
 *   onChange: (value: string) => void,
 *   scope: object,
 * }} config
 */
export function segmentedControl({ label, options, value, onChange, scope }) {
  const buttons = new Map();

  const group = el("div", {
    classes: ["segmented"],
    attrs: { role: "group", "aria-label": label },
  });

  const paint = (active) => {
    for (const [optionValue, node] of buttons) {
      const isActive = optionValue === active;

      node.setAttribute("aria-pressed", isActive ? "true" : "false");
      node.classList.toggle("segmented-active", isActive);
    }
  };

  for (const option of options) {
    const node = el("button", {
      text: option.label,
      attrs: { type: "button" },
      classes: ["segmented-option"],
    });

    scope.on(node, "click", () => {
      if (node.getAttribute("aria-pressed") === "true") {
        return;
      }

      paint(option.value);
      onChange(option.value);
    });

    buttons.set(option.value, node);
    group.append(node);
  }

  paint(value);

  return { node: group, setValue: paint };
}
