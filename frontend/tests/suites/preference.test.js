import { CARD_VIEWS, DEFAULT_CARD_VIEW } from "@/shared/config/constants.js";
import { readPreference, writePreference } from "@/shared/storage/preference.js";
import { assertFalse, assertSame, assertTrue, suite, test } from "~/runner.js";

const CHAVE = "oraculo:teste-preferencia";
const ACEITOS = Object.values(CARD_VIEWS);

/** Guarda e devolve o armazenamento: a página de testes divide a origem com a aplicação. */
function comArmazenamento(body) {
  const anterior = window.localStorage.getItem(CHAVE);

  try {
    body();
  } finally {
    if (anterior === null) {
      window.localStorage.removeItem(CHAVE);
    } else {
      window.localStorage.setItem(CHAVE, anterior);
    }
  }
}

suite("shared/storage/preference", () => {
  test("sem nada guardado, devolve o padrão", () => {
    comArmazenamento(() => {
      window.localStorage.removeItem(CHAVE);

      assertSame(readPreference(CHAVE, ACEITOS, DEFAULT_CARD_VIEW), "gallery");
    });
  });

  test("lê o valor guardado quando ele é aceito", () => {
    comArmazenamento(() => {
      writePreference(CHAVE, CARD_VIEWS.TABLE, ACEITOS);

      assertSame(readPreference(CHAVE, ACEITOS, DEFAULT_CARD_VIEW), "table");
    });
  });

  test("valor de lixo cai no padrão em vez de chegar à interface", () => {
    // O armazenamento é dado de fora (§8.5): sem a allowlist, isto viraria uma
    // visão de listagem que não existe, e a tela ficaria vazia sem explicação.
    comArmazenamento(() => {
      window.localStorage.setItem(CHAVE, '"><script>alert(1)</script>');

      assertSame(readPreference(CHAVE, ACEITOS, DEFAULT_CARD_VIEW), "gallery");
    });
  });

  test("recusa gravar valor fora da allowlist", () => {
    comArmazenamento(() => {
      assertFalse(writePreference(CHAVE, "visao-inventada", ACEITOS));
      assertSame(window.localStorage.getItem(CHAVE), null);
    });
  });

  test("armazenamento que LANÇA devolve o padrão, sem derrubar a tela", () => {
    // Janela anônima e dados do site bloqueados fazem o ACESSO lançar — não
    // devolver nulo. O dublê é na fronteira do navegador (§13.3).
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");

    try {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("acesso bloqueado");
        },
      });

      assertSame(readPreference(CHAVE, ACEITOS, DEFAULT_CARD_VIEW), "gallery");
      assertFalse(writePreference(CHAVE, CARD_VIEWS.TABLE, ACEITOS), "gravar deveria falhar sem lançar");
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });

  test("a galeria é o padrão, e a tabela é a alternativa", () => {
    // Decisão de UX nº 3: carta é objeto visual, e quem opera o catálogo
    // reconhece pela arte antes de ler o nome.
    assertSame(DEFAULT_CARD_VIEW, CARD_VIEWS.GALLERY);
    assertTrue(ACEITOS.includes(CARD_VIEWS.TABLE));
  });
});
