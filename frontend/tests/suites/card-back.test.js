/**
 * O verso da carta, como elemento.
 *
 * Ele aparece em dois papéis, e a diferença entre eles é de ACESSIBILIDADE,
 * não de desenho:
 *
 * - na galeria, o verso é a única coisa que representa a carta no lugar da
 *   arte, então ele se apresenta (`role="img"`) e leva o nome escrito;
 * - no modal de exclusão, o título já diz "Excluir «Karn, Descendente de
 *   Urza»?", e um verso que se anunciasse de novo faria o leitor de tela
 *   repetir o nome. Ali ele é decoração, cala, e fica sem texto.
 *
 * Sem texto, a gema vai ao centro e cresce — não sobra nada embaixo para ela
 * respeitar. Quem decide isso é o CSS, por `:empty`, e por isso o teste do
 * desenho monta o elemento na página: elemento solto não tem estilo nenhum.
 */

import { cardBack } from "@/features/cards/components/card-back.js";
import { assertNull, assertSame, assertTrue, suite, test } from "~/runner.js";

/** Mede o pseudoelemento da gema com o verso montado numa caixa conhecida. */
function gema(node, largura) {
  const caixa = document.createElement("div");

  caixa.style.width = `${largura}px`;
  document.body.append(caixa);
  caixa.append(node);

  try {
    const estilo = getComputedStyle(node, "::after");

    return {
      mascara: estilo.maskImage,
      largura: Number.parseFloat(estilo.width),
      caixa: node.getBoundingClientRect(),
    };
  } finally {
    caixa.remove();
  }
}

suite("features/cards/components/card-back · o verso", () => {
  test("com nome, ele se apresenta e o nome fica escrito", () => {
    const verso = cardBack({ name: "The One Ring" });

    assertSame(verso.getAttribute("role"), "img");
    assertSame(verso.getAttribute("aria-label"), "Sem imagem para The One Ring");
    assertSame(verso.textContent, "The One Ring");
  });

  test("sem nome, ele CALA: quem nomeia a carta é o título do modal", () => {
    const verso = cardBack();

    assertSame(verso.getAttribute("aria-hidden"), "true");
    assertNull(verso.getAttribute("role"));
    assertSame(verso.textContent, "");
  });

  test("sem nome, fica sem filho nenhum — é `:empty` que troca o desenho", () => {
    // Um `<span>` vazio aqui não custaria nada à vista e quebraria o seletor
    // que centraliza a gema. O teste existe para isso não voltar.
    assertSame(cardBack().childElementCount, 0);
  });

  test("o nome é texto, nunca marcação — nome de carta é dado editável", () => {
    const verso = cardBack({ name: "<b>Karn</b>" });

    assertSame(verso.textContent, "<b>Karn</b>");
    assertNull(verso.querySelector("b"));
  });

  test("nos dois papéis a moldura e a gema chegam ao elemento", () => {
    for (const verso of [cardBack({ name: "The One Ring" }), cardBack()]) {
      const medida = gema(verso, 200);

      assertTrue(medida.mascara.includes("card-back/gem.svg"), `gema ausente: ${medida.mascara}`);
    }
  });

  test("sem texto, a gema cresce — 40% da largura contra 34%", () => {
    const comNome = gema(cardBack({ name: "The One Ring" }), 200);
    const semNome = gema(cardBack(), 200);

    assertSame(Math.round((comNome.largura / comNome.caixa.width) * 100), 34);
    assertSame(Math.round((semNome.largura / semNome.caixa.width) * 100), 40);
  });
});
