/**
 * O botão de tema: o ícone do estado, e o rótulo que o diz por escrito.
 *
 * O rótulo diz o ESTADO e o `aria-label` diz a AÇÃO — sem os dois, quem usa
 * leitor de tela ouve "Tema: sistema" e não sabe o que o clique faz. Esta
 * suíte nasceu com o P6, quando o caractere de fonte virou desenho: o ícone
 * passou a ser elemento, e o que não pode mudar é justamente o resto.
 *
 * **Nenhum teste aqui clica.** Clicar grava a preferência e pinta o `<html>`
 * da própria página de testes; o que se mede é a montagem.
 */

import { STORAGE_KEYS, THEME_PREFERENCES } from "@/shared/config/constants.js";
import { themeToggle } from "@/shared/components/theme-toggle.js";
import { scope } from "@/shared/dom/events.js";
import { assertSame, assertTrue, suite, test } from "~/runner.js";

/**
 * A página de testes divide a origem com a aplicação: o que se escreve no
 * armazenamento tem de ser desfeito, ou o teste troca o tema de quem estava
 * usando o Oráculo na aba ao lado (§13.4).
 */
function comPreferencia(value, body) {
  const previous = window.localStorage.getItem(STORAGE_KEYS.themePreference);

  try {
    window.localStorage.setItem(STORAGE_KEYS.themePreference, value);

    const life = scope();

    try {
      body(themeToggle({ scope: life }).node);
    } finally {
      life.dispose();
    }
  } finally {
    if (previous === null) {
      window.localStorage.removeItem(STORAGE_KEYS.themePreference);
    } else {
      window.localStorage.setItem(STORAGE_KEYS.themePreference, previous);
    }
  }
}

suite("shared/components/theme-toggle · o botão de tema", () => {
  test("monta o ícone do estado como desenho, e não como caractere", () => {
    comPreferencia(THEME_PREFERENCES.DARK, (node) => {
      const desenho = node.querySelector(".icon");

      assertTrue(desenho !== null, "o botão não montou ícone nenhum");
      assertTrue(desenho.classList.contains("icon-theme-dark"), desenho.className);
      assertSame(desenho.getAttribute("aria-hidden"), "true");
    });
  });

  test("cada preferência traz o próprio desenho", () => {
    const esperado = {
      [THEME_PREFERENCES.SYSTEM]: "icon-theme-system",
      [THEME_PREFERENCES.LIGHT]: "icon-theme-light",
      [THEME_PREFERENCES.DARK]: "icon-theme-dark",
    };

    for (const [preferencia, classe] of Object.entries(esperado)) {
      comPreferencia(preferencia, (node) => {
        assertTrue(node.querySelector(`.${classe}`) !== null, `${preferencia} não trouxe ${classe}`);
      });
    }
  });

  test("o rótulo continua escrito, e o ícone não entra no texto", () => {
    comPreferencia(THEME_PREFERENCES.LIGHT, (node) => {
      // Sem o ícone dentro do texto: o desenho é máscara, e o nome acessível
      // do botão não pode ganhar um caractere que ninguém consegue ler.
      assertSame(node.textContent, "Tema: claro");
    });
  });

  test("o aria-label continua dizendo a ação, e não só o estado", () => {
    comPreferencia(THEME_PREFERENCES.LIGHT, (node) => {
      assertSame(node.getAttribute("aria-label"), "Tema: claro. Alternar para Tema: escuro.");
      assertSame(node.getAttribute("title"), "Alternar para Tema: escuro");
    });
  });

  test("o tema resolvido continua no dataset, que é o que a tela lê", () => {
    comPreferencia(THEME_PREFERENCES.DARK, (node) => {
      assertSame(node.dataset.resolvedTheme, "dark");
    });
  });
});
