/**
 * Os estados de tela.
 *
 * A suíte nasceu de um defeito de F-050: "Página não encontrada" e "sem
 * permissão" ocupam a tela inteira, e o título do estado saía em `<p>`. A
 * tela ficava sem cabeçalho nenhum — quem navega por cabeçalhos não tem por
 * onde começar, e a hierarquia da aplicação some justamente na tela em que a
 * pessoa já está perdida.
 *
 * O padrão continua sendo `<p>`: dentro de uma página que já tem `h1`, o
 * estado é mensagem, não seção.
 */

import { empty, failure, forbidden } from "@/shared/components/feedback.js";
import { assertNull, assertSame, assertThrows, assertTrue, suite, test } from "~/runner.js";

const titulo = (node) => node.querySelector(".state-title");

suite("shared/components/feedback · o elemento do título do estado", () => {
  test("por padrão o título é um parágrafo — estado dentro de página é mensagem", () => {
    assertSame(titulo(empty({ title: "Nenhuma carta ainda." })).tagName, "P");
    assertSame(titulo(forbidden()).tagName, "P");
    assertSame(titulo(failure({ message: "Falhou." })).tagName, "P");
  });

  test("`as` promove o título a cabeçalho, para o estado que É a tela (RNF-06)", () => {
    const vazio = empty({ title: "Página não encontrada", as: "h1" });

    assertSame(titulo(vazio).tagName, "H1");
    assertTrue(titulo(vazio).classList.contains("state-title"), "a aparência não muda com o nível");
  });

  test("`forbidden` também aceita o nível, e mantém o ícone junto do texto (§9.4)", () => {
    const negado = forbidden("Você não tem permissão para ver esta tela.", { as: "h1" });

    assertSame(titulo(negado).tagName, "H1");
    assertSame(titulo(negado).querySelector(".state-icon").getAttribute("aria-hidden"), "true");
  });

  test("os dois ícones são DESENHO, e não caractere de fonte", () => {
    /*
     * O cadeado como caractere saía emoji colorido — fora da paleta, e com o
     * desenho decidido pelo sistema operacional, não por nós. Como máscara, o
     * ícone tem a cor do texto ao lado: vermelho dentro do erro, tinta no
     * resto. E o texto da mensagem não ganha um caractere que o leitor de
     * tela teria de adivinhar.
     */
    const negado = forbidden("Sem permissão.");
    const falha = failure({ message: "Não foi possível carregar." });

    assertTrue(titulo(negado).querySelector(".icon-lock") !== null, "o cadeado não é desenho");
    assertTrue(titulo(falha).querySelector(".icon-warning") !== null, "o aviso não é desenho");
    assertSame(titulo(negado).textContent, "Sem permissão.");
    assertSame(titulo(falha).textContent, "Não foi possível carregar.");
  });
});

suite("shared/components/feedback · a ilustração do estado vazio", () => {
  /** Monta na página: elemento solto não tem estilo, e a máscara é estilo. */
  function montado(node, body) {
    const caixa = document.createElement("div");

    caixa.style.width = "400px";
    document.body.append(caixa);
    caixa.append(node);

    try {
      body(node);
    } finally {
      caixa.remove();
    }
  }

  test("a ilustração é decorativa: quem diz o estado é o título e a descrição", () => {
    const tela = empty({ title: "Página não encontrada", image: "not-found" });
    const desenho = tela.querySelector(".state-image");

    assertSame(desenho.getAttribute("aria-hidden"), "true");
    assertSame(desenho.textContent, "");
  });

  test("a ilustração vem ANTES do título, que é a ordem em que se lê a tela", () => {
    const tela = empty({ title: "Página não encontrada", image: "not-found" });

    assertTrue(tela.firstElementChild.classList.contains("state-image"));
  });

  test("sem pedir imagem, nenhuma entra — o painel e o histórico seguem secos", () => {
    assertNull(empty({ title: "Sem alterações registradas para esta carta." }).querySelector(".state-image"));
  });

  test("cada desenho do conjunto CHEGA ao elemento", () => {
    /*
     * Três nomes, três tokens e três regras: a classe certa não prova que
     * exista desenho do outro lado. Um token com typo entregaria um estado
     * vazio com um buraco no lugar da ilustração, e as asserções de classe
     * passariam todas.
     */
    for (const nome of ["not-found", "empty-catalog", "search"]) {
      montado(empty({ title: "Nada aqui", image: nome }), (tela) => {
        const mascara = getComputedStyle(tela.querySelector(".state-image")).maskImage;

        assertTrue(mascara.includes(".svg"), `${nome} subiu sem máscara: ${mascara}`);
      });
    }
  });

  test("a busca sem resultado reusa a gema do verso, sem arquivo novo", () => {
    montado(empty({ title: "Nenhuma carta encontrada", image: "search" }), (tela) => {
      const mascara = getComputedStyle(tela.querySelector(".state-image")).maskImage;

      assertTrue(mascara.includes("card-back/gem.svg"), mascara);
    });
  });

  test("nome fora do conjunto LANÇA: é erro de programação, não dado", () => {
    assertThrows(() => empty({ title: "Nada aqui", image: "carta-triste" }), TypeError);
  });
});
