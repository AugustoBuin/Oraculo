/**
 * Ícone de traço.
 *
 * Eram caracteres de fonte, e caractere de fonte **não é desenho nosso**: o
 * cadeado saía como emoji colorido, fora da paleta, e o sol, a lua e o meio
 * círculo mudavam de forma conforme o sistema operacional. Agora são cinco
 * SVG de uma família só — grade de 24, traço 2, pontas e junções redondas, as
 * mesmas do logo.
 *
 * **A cor é `currentColor`**: o ícone tem a cor do texto ao lado, vermelho
 * dentro do erro e tinta no botão, sem um arquivo por cor. Quem pinta é o
 * CSS, pela máscara (checklist D2, rota A) — o elemento é vazio de propósito,
 * e o nome do ícone nunca vira texto na tela.
 *
 * Decorativo, sempre: quem diz o estado é o rótulo ao lado, que está sempre
 * escrito (a regra dos dois sinais, `docs/design.md` §4).
 */

import { el } from "@/shared/dom/elements.js";

/**
 * O conjunto fechado.
 *
 * Fechado porque nome de ícone é escrito por quem programa — nunca vem do
 * banco nem do usuário —, e porque cada nome aqui tem uma regra no
 * `components.css` e um arquivo em `assets/icons/`. Os três existem ou nenhum
 * serve.
 */
const ICONS = new Set(["warning", "lock", "theme-system", "theme-light", "theme-dark"]);

/**
 * @param {string} name um dos nomes de `ICONS`
 * @param {{ classes?: string[] }} [config] classes do lugar que o usa
 * @returns {HTMLElement}
 */
export function icon(name, { classes = [] } = {}) {
  /*
   * Nome errado é ERRO DE PROGRAMAÇÃO, e por isso lança — a mesma escolha que
   * o `el()` faz para atributo de evento. Sem isto, `icon("cadeado")` devolve
   * um elemento sem máscara: vazio, invisível, e visível só quando a tela
   * chega a quem usa.
   */
  if (!ICONS.has(name)) {
    throw new TypeError(`Ícone "${name}" não existe. Os que existem: ${[...ICONS].join(", ")}.`);
  }

  return el("span", {
    classes: ["icon", `icon-${name}`, ...classes],
    attrs: { "aria-hidden": "true" },
  });
}
