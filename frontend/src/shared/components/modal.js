/**
 * Modal genérico.
 *
 * As quatro regras de foco do §9.2 são o motivo de este componente existir:
 * o foco **entra** ao abrir, **fica preso** enquanto está aberto, `Esc`
 * **fecha**, e o foco **volta** para quem abriu. Um modal que erra qualquer
 * uma delas deixa quem navega por teclado preso atrás da sobreposição, sem
 * saída — é a falha de acessibilidade mais cara de uma interface assim.
 *
 * Componente global: não conhece domínio nenhum. Quem abre decide título,
 * conteúdo e ações (§2.3).
 */

import { el } from "@/shared/dom/elements.js";
import { scope } from "@/shared/dom/events.js";

/** O que o navegador considera focável, na ordem em que aparece no DOM. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;

/**
 * @param {{
 *   title: string,
 *   content: Node | Node[],
 *   actions?: Node[],
 *   onClose?: () => void,
 *   labelledBy?: string,
 * }} config
 * @returns {{ close: () => void, node: HTMLElement }}
 */
export function openModal({ title, content, actions = [], onClose }) {
  const life = scope();

  // Quem abriu. O foco volta para cá no fechamento — sem isso, a pessoa é
  // devolvida ao início da página e perde o lugar onde estava (§9.2).
  const opener = document.activeElement;

  const titleId = `modal-titulo-${openCount++}`;

  const dialog = el("div", {
    classes: ["modal"],
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
    },
    children: [
      el("h2", { text: title, attrs: { id: titleId }, classes: ["modal-title"] }),
      el("div", {
        classes: ["modal-content"],
        children: Array.isArray(content) ? content : [content],
      }),
      el("div", { classes: ["modal-actions"], children: actions }),
    ],
  });

  const backdrop = el("div", { classes: ["modal-backdrop"], children: [dialog] });

  let closed = false;

  function close() {
    if (closed) {
      return;
    }

    closed = true;
    life.dispose();
    backdrop.remove();

    // O documento volta a rolar. Restaurar por remoção de propriedade, e não
    // escrevendo "auto", para não sobrepor um valor que a página já tivesse.
    if (document.querySelectorAll(".modal-backdrop").length === 0) {
      document.body.style.removeProperty("overflow");
    }

    // `focus` pode ter ido embora com o DOM que o continha; a checagem evita
    // um erro no caminho de fechamento, que é o pior lugar para ter um.
    if (opener instanceof HTMLElement && document.contains(opener)) {
      opener.focus();
    }

    onClose?.();
  }

  const focusable = () => [...dialog.querySelectorAll(FOCUSABLE)];

  /**
   * A armadilha de foco.
   *
   * Tab no último elemento volta para o primeiro; Shift+Tab no primeiro vai
   * para o último. Sem isso o foco escapa para a página atrás, que continua
   * clicável por teclado embora esteja visualmente coberta.
   */
  function trapFocus(event) {
    if (event.key !== "Tab") {
      return;
    }

    const items = focusable();

    if (items.length === 0) {
      event.preventDefault();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  life.on(document, "keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    trapFocus(event);
  });

  // Clique no fundo fecha — mas só no fundo: um clique que começou dentro do
  // diálogo e terminou fora (arrastar para selecionar texto) não pode fechar.
  life.on(backdrop, "mousedown", (event) => {
    if (event.target === backdrop) {
      close();
    }
  });

  document.body.style.setProperty("overflow", "hidden");
  document.body.append(backdrop);

  // O foco entra: primeiro elemento focável, ou o próprio diálogo quando não
  // há nenhum, para o leitor de tela anunciar o título.
  const items = focusable();

  if (items.length > 0) {
    items[0].focus();
  } else {
    dialog.setAttribute("tabindex", "-1");
    dialog.focus();
  }

  return { node: dialog, close };
}
