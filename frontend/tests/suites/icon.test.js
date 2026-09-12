/**
 * Os ícones de traço.
 *
 * Eram caracteres de fonte, e caractere de fonte não obedece à paleta: o
 * cadeado saía como emoji colorido, e o sol, a lua e o meio círculo mudavam de
 * desenho conforme o sistema operacional. Agora são SVG de traço pintados por
 * máscara com `currentColor` — o ícone tem a cor do texto ao lado, sem um
 * arquivo por cor.
 *
 * O elemento é vazio de propósito: o desenho é máscara, e o nome do ícone
 * nunca vira texto na tela.
 */

import { icon } from "@/shared/components/icon.js";
import { assertSame, assertThrows, assertTrue, suite, test } from "~/runner.js";

suite("shared/components/icon · o ícone de traço", () => {
  test("é decorativo: quem diz o estado é o rótulo ao lado", () => {
    assertSame(icon("warning").getAttribute("aria-hidden"), "true");
  });

  test("leva a classe da família e a do desenho", () => {
    const aviso = icon("warning");

    assertTrue(aviso.classList.contains("icon"));
    assertTrue(aviso.classList.contains("icon-warning"));
  });

  test("não leva texto: o desenho é máscara, não caractere", () => {
    assertSame(icon("lock").textContent, "");
  });

  test("aceita classe do lugar que o usa, sem perder as próprias", () => {
    const cadeado = icon("lock", { classes: ["state-icon"] });

    assertTrue(cadeado.classList.contains("icon"));
    assertTrue(cadeado.classList.contains("icon-lock"));
    assertTrue(cadeado.classList.contains("state-icon"));
  });

  test("os cinco nomes do conjunto existem", () => {
    for (const nome of ["warning", "lock", "theme-system", "theme-light", "theme-dark"]) {
      assertTrue(icon(nome).classList.contains(`icon-${nome}`), `${nome} não montou`);
    }
  });

  test("o desenho de cada nome CHEGA ao elemento, montado na página", () => {
    /*
     * Afirmar as classes prova que o componente escreveu o nome; não prova
     * que existe regra para ele. Um token errado — `--image-icon-theme-ligth`
     * — produziria um elemento vazio e invisível, e as asserções acima
     * passariam todas. Por isso este teste MONTA e lê o estilo computado:
     * elemento solto não tem estilo nenhum.
     */
    const nomes = ["warning", "lock", "theme-system", "theme-light", "theme-dark"];
    const caixa = document.createElement("div");

    document.body.append(caixa);

    try {
      for (const nome of nomes) {
        const desenho = icon(nome);

        caixa.replaceChildren(desenho);

        const mascara = getComputedStyle(desenho).maskImage;

        assertTrue(mascara.includes(`icons/${nome}.svg`), `${nome} subiu sem máscara: ${mascara}`);
      }
    } finally {
      caixa.remove();
    }
  });

  test("nome fora do conjunto LANÇA: é erro de programação, não dado", () => {
    /*
     * O conjunto é fechado e conhecido em tempo de escrita — nome de ícone
     * nunca vem do banco nem do usuário. Errar o nome produziria um elemento
     * vazio e invisível, que ninguém nota até a tela chegar ao usuário; falhar
     * alto conserta na hora. É a mesma escolha do `el()` para atributo de
     * evento.
     */
    assertThrows(() => icon("cadeado"), TypeError);
  });
});
