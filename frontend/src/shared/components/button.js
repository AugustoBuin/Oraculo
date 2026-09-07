/**
 * Botão.
 *
 * `button` nativo, sempre — `div` clicável precisaria de `role`, `tabindex` e
 * tratamento de Enter e Espaço para chegar onde o nativo já está de graça
 * (PADROES-ENGENHARIA.md §9.1).
 *
 * O componente é global e por isso **não conhece nenhum domínio**: nenhum `if`
 * sobre regra de negócio aqui dentro. Quem chama decide o que o botão faz e
 * quando ele fica indisponível (§2.3).
 */

import { el } from "@/shared/dom/elements.js";

/**
 * A voz de ação. `primary` usa a cor de acento, e por isso existe **uma** por
 * contexto — se duas coisas na tela estão com a cor de acento, uma está errada
 * (§10.2).
 */
const VARIANTS = new Set(["primary", "secondary", "ghost", "danger"]);

/**
 * @param {{
 *   label: string,
 *   variant?: "primary" | "secondary" | "ghost" | "danger",
 *   type?: "button" | "submit",
 *   onClick?: (event: MouseEvent) => void,
 *   scope?: ReturnType<import("@/shared/dom/events.js").scope>,
 *   attrs?: Record<string, unknown>,
 * }} config
 */
export function button({
  label,
  variant = "secondary",
  type = "button",
  onClick,
  scope,
  attrs = {},
}) {
  if (!VARIANTS.has(variant)) {
    throw new TypeError(`Variante de botão desconhecida: "${variant}".`);
  }

  const node = el("button", {
    text: label,
    attrs: { type, ...attrs },
    classes: ["button", `button-${variant}`],
  });

  if (onClick !== undefined) {
    if (scope === undefined) {
      // Sem escopo o listener não teria como ser removido, e o botão viraria
      // exatamente o vazamento que o §12.4 chama de causa número um de bug em
      // aplicação feita à mão.
      throw new TypeError("button() com onClick exige um scope para a limpeza.");
    }

    scope.on(node, "click", onClick);
  }

  return {
    node,

    /**
     * Estado de carregando.
     *
     * Desabilita **e** troca o texto: desabilitar sozinho não diz ao usuário
     * que algo está acontecendo, e é o que produz o clique repetido.
     * `aria-busy` anuncia o mesmo para quem não vê o texto.
     */
    setLoading(isLoading, loadingLabel = "Enviando…") {
      node.disabled = isLoading;
      node.textContent = isLoading ? loadingLabel : label;

      if (isLoading) {
        node.setAttribute("aria-busy", "true");
        return;
      }

      node.removeAttribute("aria-busy");
    },

    setDisabled(isDisabled) {
      node.disabled = isDisabled;
    },
  };
}
