/**
 * A tela de entrada: a mesa, a carta em pé e as duas deitadas.
 *
 * A cena é feita de três coisas e cada uma existe por um motivo diferente:
 *
 * - a **mesa** é o fundo do layout, e vem por token para a virada não revelar
 *   a aplicação num tema diferente do da cena;
 * - a **carta em pé** é o próprio cartão do formulário — não um desenho atrás
 *   dele. O formulário está sobre o verso da carta que acabou de ser tirada;
 * - as **duas deitadas** são a mesma imagem, a da direita espelhada no CSS.
 *   Elas são decoração e somem quando não cabem inteiras.
 *
 * O que esta suíte protege é o que o olho não vê: que a cena não roube o
 * formulário. Ele é `<main>`, recebe o foco ao abrir e funciona antes de
 * qualquer imagem chegar.
 */

import { loginPage } from "@/pages/login/login-page.js";
import { assertSame, assertTrue, suite, test } from "~/runner.js";

/** Monta a tela numa caixa da página: sem estar no documento, não há estilo. */
function naPagina(body, { notice } = {}) {
  const raiz = document.createElement("div");

  document.body.append(raiz);

  const limpar = loginPage(raiz, { onAuthenticated: () => {}, notice });

  try {
    body(raiz);
  } finally {
    limpar();
    raiz.remove();
  }
}

suite("pages/login · a cena da entrada", () => {
  test("o formulário é o conteúdo da página, e não um modal sobre ela", () => {
    naPagina((raiz) => {
      const principal = raiz.querySelector("main.login-layout");

      assertTrue(principal !== null, "a tela não montou o <main>");
      assertSame(principal.getAttribute("id"), "conteudo");
      assertTrue(principal.querySelector(".login-card form") !== null, "o formulário sumiu");
    });
  });

  test("o campo de e-mail recebe o foco ao abrir", () => {
    naPagina((raiz) => {
      assertSame(document.activeElement, raiz.querySelector("#email"));
    });
  });

  test("as duas cartas deitadas são decoração: caladas e sem texto", () => {
    naPagina((raiz) => {
      const deitadas = raiz.querySelectorAll(".login-side");

      assertSame(deitadas.length, 2);

      for (const carta of deitadas) {
        assertSame(carta.getAttribute("aria-hidden"), "true");
        assertSame(carta.textContent, "");
      }
    });
  });

  test("a da direita é a MESMA imagem, espelhada — não um segundo arquivo", () => {
    naPagina((raiz) => {
      const [esquerda, direita] = raiz.querySelectorAll(".login-side");

      assertSame(
        getComputedStyle(esquerda).backgroundImage,
        getComputedStyle(direita).backgroundImage,
      );
      assertTrue(direita.classList.contains("login-side-mirrored"), direita.className);
    });
  });

  test("a mesa e a carta deitada chegam por token, e não escritas no componente", () => {
    naPagina((raiz) => {
      const mesa = getComputedStyle(raiz.querySelector(".login-layout")).backgroundImage;
      const deitada = getComputedStyle(raiz.querySelector(".login-side")).backgroundImage;

      assertTrue(mesa.includes("assets/login/table"), `a mesa não chegou: ${mesa}`);
      assertTrue(deitada.includes("assets/login/card"), `a carta deitada não chegou: ${deitada}`);
    });
  });

  test("o aviso de sessão vencida continua aparecendo dentro do formulário", () => {
    naPagina(
      (raiz) => {
        assertTrue(raiz.querySelector(".login-card .form-alert").textContent.length > 0);
      },
      { notice: "Sua sessão expirou. Entre de novo para continuar." },
    );
  });
});
