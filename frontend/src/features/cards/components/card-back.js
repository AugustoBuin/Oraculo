/**
 * O verso da carta: o estado "sem imagem", desenhado.
 *
 * A carta de costas é o que "sem imagem" quer dizer — a face existe, só não
 * está à vista. O desenho inteiro é CSS (`.card-image-empty`, duas camadas de
 * máscara); aqui mora só a decisão de ACESSIBILIDADE, que é o que muda de um
 * lugar para o outro:
 *
 * - **com nome** (a galeria): o verso é o que representa a carta no lugar da
 *   arte, então ele se apresenta como imagem e leva o nome escrito. Nunca um
 *   ícone de imagem quebrada (RF-34): mostra a informação que a arte daria, e
 *   quem procura a carta continua encontrando;
 * - **sem nome** (o modal de exclusão): o título já diz de qual carta se
 *   trata, e um verso que se anunciasse faria o leitor de tela repetir o nome
 *   (§9.5). Ali ele é decoração e cala.
 *
 * Sem texto o elemento fica `:empty`, e é por esse seletor que o CSS leva a
 * gema ao centro e a faz crescer — não sobra nada embaixo para ela respeitar.
 */

import { el } from "@/shared/dom/elements.js";

/**
 * @param {{ name?: string, classes?: string[] }} [config]
 * @returns {HTMLElement}
 */
export function cardBack({ name, classes = [] } = {}) {
  const decorativo = name === undefined || name === null;

  return el("div", {
    classes: ["card-image-empty", ...classes],
    attrs: decorativo
      ? { "aria-hidden": "true" }
      : { role: "img", "aria-label": `Sem imagem para ${name}` },
    // `textContent`, sempre: nome de carta é dado editável, e o catálogo é
    // onde alguém digitaria `<script>` para ver o que acontece.
    children: decorativo ? [] : [el("span", { text: name, classes: ["card-image-empty-text"] })],
  });
}
