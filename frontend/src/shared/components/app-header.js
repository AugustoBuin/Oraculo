/**
 * Cabeçalho e navegação.
 *
 * **Componente global: não conhece permissão nem domínio.** Ele recebe a lista
 * de itens já decidida e desenha. Um `if (user.role === "ADMIN")` aqui dentro
 * tiraria a decisão de quem tem contexto para tomá-la e a espalharia por um
 * componente reutilizável (§2.3 e §17.1).
 */

import { el } from "@/shared/dom/elements.js";

/**
 * @param {{
 *   brand: string,
 *   items: Array<{ label: string, href: string }>,
 *   currentPath: string,
 *   actions?: Node[],
 * }} config
 */
export function appHeader({ brand, items, currentPath, actions = [] }) {
  const links = items.map((item) => {
    const isCurrent = currentPath === item.href || currentPath.startsWith(`${item.href}/`);

    return el("a", {
      text: item.label,
      classes: ["nav-link", ...(isCurrent ? ["nav-link-current"] : [])],
      attrs: {
        href: item.href,
        // `aria-current` é o que anuncia "você está aqui" para leitor de tela.
        // Só destacar com cor deixaria a informação invisível para quem não vê
        // e para quem não distingue as cores (§9.4).
        "aria-current": isCurrent ? "page" : undefined,
      },
    });
  });

  return el("header", {
    classes: ["app-header"],
    children: [
      el("div", {
        classes: ["app-header-inner", "container"],
        children: [
          el("a", { text: brand, attrs: { href: "/" }, classes: ["app-brand"] }),
          el("nav", {
            attrs: { "aria-label": "Principal" },
            classes: ["app-nav"],
            children: links,
          }),
          el("div", { classes: ["app-actions"], children: actions }),
        ],
      }),
    ],
  });
}
