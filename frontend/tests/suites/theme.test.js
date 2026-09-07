import { STORAGE_KEYS, THEME_PREFERENCES } from "@/shared/config/constants.js";
import { onSystemThemeChange, readPreference, resolveTheme } from "@/shared/theme/theme.js";
import { assertSame, assertTrue, suite, test } from "~/runner.js";

/**
 * Guarda e devolve o que estava no armazenamento.
 *
 * A página de testes divide a origem com a aplicação, então o teste que
 * escreve precisa desfazer — senão um teste interfere no outro e, pior,
 * na própria aplicação (§13.4).
 */
function withStoredPreference(value, body) {
  const previous = window.localStorage.getItem(STORAGE_KEYS.themePreference);

  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEYS.themePreference);
    } else {
      window.localStorage.setItem(STORAGE_KEYS.themePreference, value);
    }
    body();
  } finally {
    if (previous === null) {
      window.localStorage.removeItem(STORAGE_KEYS.themePreference);
    } else {
      window.localStorage.setItem(STORAGE_KEYS.themePreference, previous);
    }
  }
}

suite("shared/theme", () => {
  test("sem nada guardado, o padrão é acompanhar o sistema", () => {
    withStoredPreference(null, () => {
      assertSame(readPreference(), THEME_PREFERENCES.SYSTEM);
    });
  });

  test("lê a preferência guardada quando ela é válida", () => {
    withStoredPreference(THEME_PREFERENCES.DARK, () => {
      assertSame(readPreference(), THEME_PREFERENCES.DARK);
    });
  });

  test("valor de lixo no armazenamento vira SYSTEM", () => {
    // O armazenamento é dado de fora e não é confiável nem por formato: sem a
    // allowlist, isto viraria data-theme="<lixo>" no <html> (§8.5).
    withStoredPreference('"><script>alert(1)</script>', () => {
      assertSame(readPreference(), THEME_PREFERENCES.SYSTEM);
    });
  });

  test("armazenamento que LANÇA não derruba a leitura", () => {
    // Em janela anônima ou com dados do site bloqueados, o próprio ACESSO a
    // localStorage lança — não devolve nulo. O dublê é na fronteira do
    // navegador, não num módulo do projeto (§13.3).
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");

    try {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("acesso ao armazenamento bloqueado");
        },
      });

      assertSame(readPreference(), THEME_PREFERENCES.SYSTEM);
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });

  test("escolha explícita vence o sistema nos dois sentidos", () => {
    assertSame(resolveTheme(THEME_PREFERENCES.LIGHT), THEME_PREFERENCES.LIGHT);
    assertSame(resolveTheme(THEME_PREFERENCES.DARK), THEME_PREFERENCES.DARK);
  });

  test("SYSTEM resolve para um dos dois temas concretos", () => {
    const resolved = resolveTheme(THEME_PREFERENCES.SYSTEM);

    assertTrue(
      resolved === THEME_PREFERENCES.LIGHT || resolved === THEME_PREFERENCES.DARK,
      `SYSTEM nunca é um tema em si, e resolveu para ${resolved}`,
    );
  });

  test("onSystemThemeChange devolve a função que remove o listener", () => {
    const cleanup = onSystemThemeChange(() => {});

    assertSame(typeof cleanup, "function");
    cleanup();
  });
});
