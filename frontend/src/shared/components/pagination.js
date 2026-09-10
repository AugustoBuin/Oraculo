/**
 * Paginação.
 *
 * Componente global: recebe onde está e quantas páginas existem, e avisa para
 * onde ir. Não sabe o que está sendo paginado (§2.3).
 */

import { button } from "@/shared/components/button.js";
import { el } from "@/shared/dom/elements.js";

/**
 * @param {{
 *   page: number,
 *   totalPages: number,
 *   total: number,
 *   onChange: (page: number) => void,
 *   scope: object,
 * }} config
 */
export function pagination({ page, totalPages, total, onChange, scope }) {
  const previous = button({
    label: "Anterior",
    scope,
    onClick: () => onChange(page - 1),
    attrs: { "aria-label": "Página anterior" },
  });

  const next = button({
    label: "Próxima",
    scope,
    onClick: () => onChange(page + 1),
    attrs: { "aria-label": "Próxima página" },
  });

  previous.setDisabled(page <= 1);
  next.setDisabled(page >= totalPages);

  return el("nav", {
    classes: ["cluster", "cluster-center"],
    attrs: { "aria-label": "Paginação" },
    children: [
      previous.node,
      // `role="status"` faz a troca de página ser anunciada: sem isso, quem
      // navega por leitor de tela clica em "Próxima" e não recebe confirmação
      // nenhuma de que algo mudou (§9.3).
      el("p", {
        classes: ["pagination-status"],
        attrs: { role: "status" },
        text: `Página ${page} de ${totalPages} · ${total} ${total === 1 ? "carta" : "cartas"}`,
      }),
      next.node,
    ],
  });
}
