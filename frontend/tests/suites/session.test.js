import { getCsrfToken } from "@/shared/api/csrf.js";
import { cache } from "@/shared/store/cache.js";
import {
  clearSession,
  getUser,
  hasLevel,
  isAuthenticated,
  setSession,
  subscribeToSession,
} from "@/shared/session/session.js";
import { assertFalse, assertSame, assertThrows, assertTrue, suite, test } from "~/runner.js";

const editor = { id: 2, name: "Editor de Catálogo", role: "EDITOR", level: 2 };
const admin = { id: 1, name: "Administrador", role: "ADMIN", level: 3 };
const viewer = { id: 3, name: "Consulta", role: "VIEWER", level: 1 };

/** A sessão é global por natureza; todo teste devolve o estado limpo. */
function withSession(user, body) {
  try {
    setSession({ user, csrfToken: "token-de-teste" });
    body();
  } finally {
    clearSession();
  }
}

suite("shared/session · hierarquia de permissão", () => {
  test("ADMIN alcança tudo que EDITOR e VIEWER alcançam", () => {
    withSession(admin, () => {
      assertTrue(hasLevel("ADMIN"));
      assertTrue(hasLevel("EDITOR"));
      assertTrue(hasLevel("VIEWER"));
    });
  });

  test("EDITOR alcança VIEWER, mas não ADMIN", () => {
    withSession(editor, () => {
      assertTrue(hasLevel("VIEWER"));
      assertTrue(hasLevel("EDITOR"));
      assertFalse(hasLevel("ADMIN"), "o botão de catálogos não pode aparecer para o editor");
    });
  });

  test("VIEWER não alcança nenhuma escrita", () => {
    withSession(viewer, () => {
      assertTrue(hasLevel("VIEWER"));
      assertFalse(hasLevel("EDITOR"));
      assertFalse(hasLevel("ADMIN"));
    });
  });

  test("sem sessão, nenhum nível é alcançado", () => {
    clearSession();

    assertFalse(hasLevel("VIEWER"));
    assertFalse(hasLevel("ADMIN"));
  });

  test("papel desconhecido LANÇA em vez de esconder tudo em silêncio", () => {
    // `n >= undefined` é falso: sem esta guarda, um papel escrito errado
    // esconderia a tela inteira e ninguém descobriria pelo uso.
    withSession(admin, () => {
      assertThrows(() => hasLevel("SUPERADMIN"), TypeError);
      assertThrows(() => hasLevel("editor"), TypeError);
    });
  });

  test("usuário sem nível numérico não alcança nada", () => {
    withSession({ id: 9, name: "Estranho", role: "ADMIN" }, () => {
      assertFalse(hasLevel("VIEWER"), "o nível vem do servidor; ausente é ausente");
    });
  });
});

suite("shared/session · ciclo de vida", () => {
  test("guarda usuário e token na mesma operação", () => {
    withSession(editor, () => {
      assertSame(getUser().name, "Editor de Catálogo");
      assertTrue(isAuthenticated());
      assertSame(getCsrfToken(), "token-de-teste");
    });
  });

  test("o logout limpa usuário, token E cache", async () => {
    // Logout parcial é vazamento entre usuários no mesmo navegador (§8.4): sem
    // limpar o cache, a listagem do usuário anterior apareceria para o
    // próximo, antes da primeira requisição responder.
    setSession({ user: editor, csrfToken: "token-de-teste" });
    await cache.fetchOnce("cards|1", async () => "cartas do editor", { ttlMs: 60000 });

    assertSame(cache.peek("cards|1"), "cartas do editor");

    clearSession();

    assertSame(getUser(), null);
    assertFalse(isAuthenticated());
    assertSame(getCsrfToken(), null);
    assertSame(cache.peek("cards|1"), undefined, "o dado do usuário anterior sobreviveu");
  });

  test("avisa quem assina quando a sessão muda", () => {
    const recebidos = [];
    const unsubscribe = subscribeToSession((state) => recebidos.push(state.user?.role ?? null));

    try {
      setSession({ user: editor, csrfToken: "t" });
      clearSession();
    } finally {
      unsubscribe();
    }

    assertSame(recebidos.join(","), "EDITOR,");
  });

  test("subscribeToSession devolve o cancelamento", () => {
    let avisos = 0;
    const unsubscribe = subscribeToSession(() => avisos++);

    setSession({ user: editor, csrfToken: "t" });
    unsubscribe();
    clearSession();

    assertSame(avisos, 1);
  });
});
