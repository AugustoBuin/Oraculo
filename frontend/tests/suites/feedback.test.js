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
import { assertSame, assertTrue, suite, test } from "~/runner.js";

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
});
