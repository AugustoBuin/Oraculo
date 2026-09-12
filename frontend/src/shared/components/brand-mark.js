/**
 * A marca do Oráculo: três cartas em leque, seguradas na mão, num tom só.
 *
 * **Um componente para os dois lugares** — o cabeçalho e a entrada. A marca
 * existe num ponto só do código, como a cor dela (`components.css`, "O único
 * lugar da cor da marca").
 *
 * **O desenho é um `<span>` vazio, e isso é de propósito.** O SVG entra como
 * `mask-image` de um elemento pintado com `background-color: var(--color-brand)`
 * (ADR/checklist D2, rota A). Assim a marca acompanha o tema pelo botão, e não
 * só pelo sistema, sem uma linha de JavaScript: `el()` usa `createElement` e
 * não sabe criar SVG, e o projeto não tem `innerHTML`. O endereço de cada
 * arquivo é token (`--image-brand-mark`), como todo valor visual.
 *
 * **Duas versões, e o corte foi medido:** sem o sigilo abaixo de 64px, porque a
 * 48px as facetas da gema se fundem; com o sigilo de 64px em diante. O
 * cabeçalho usa a pequena.
 *
 * Decorativa, sempre (`aria-hidden`): a palavra "Oráculo" continua sendo texto
 * HTML ao lado, e o link já se chama "Oráculo" para quem usa leitor de tela.
 * Repetir o nome na imagem faria o leitor dizer duas vezes (§9.4).
 */

import { el } from "@/shared/dom/elements.js";

/**
 * @param {{ sigil?: boolean }} [config] `sigil` a partir de 64px de altura
 * @returns {HTMLElement}
 */
export function brandMark({ sigil = false } = {}) {
  return el("span", {
    classes: ["brand-mark", ...(sigil ? ["brand-mark-sigil"] : [])],
    attrs: { "aria-hidden": "true" },
  });
}
