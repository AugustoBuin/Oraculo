import { api, setSessionExpiredHandler } from "@/shared/api/client.js";
import { getCsrfToken } from "@/shared/api/csrf.js";
import { ApiError, MALFORMED_MESSAGE } from "@/shared/api/errors.js";
import {
  changePassword,
  loadSession,
  login,
  logout,
} from "@/features/auth/api/auth-api.js";
import { clearSession, getUser, isAuthenticated } from "@/shared/session/session.js";
import { cache } from "@/shared/store/cache.js";
import { fetchDouble } from "~/doubles/fetch.js";
import {
  assertFalse,
  assertNull,
  assertRejects,
  assertSame,
  assertTrue,
  suite,
  test,
} from "~/runner.js";

const sessionPayload = {
  data: {
    user: { id: 2, name: "Editor de Catálogo", email: "editor@oraculo.local", role: "EDITOR", level: 2 },
    csrfToken: "a".repeat(64),
  },
};

async function withFetch(body) {
  const double = fetchDouble();

  try {
    await body(double);
    assertSame(double.unexpected.length, 0, `requisição não prevista: ${double.unexpected}`);
  } finally {
    double.restore();
    clearSession();
  }
}

suite("features/auth/api · entrada", () => {
  test("guarda usuário e token na sessão", async () => {
    await withFetch(async (double) => {
      double.onJson("POST", "/api/auth/login", sessionPayload);

      const user = await login({ email: "editor@oraculo.local", password: "oraculo123" });

      assertSame(user.name, "Editor de Catálogo");
      assertSame(user.level, 2);
      assertTrue(isAuthenticated());
      assertSame(getCsrfToken(), "a".repeat(64));
    });
  });

  test("manda só e-mail e senha no corpo", async () => {
    await withFetch(async (double) => {
      double.onJson("POST", "/api/auth/login", sessionPayload);

      await login({ email: "editor@oraculo.local", password: "oraculo123" });

      const enviado = JSON.parse(double.lastCall.body);
      assertSame(Object.keys(enviado).sort().join(","), "email,password");
    });
  });

  test("resposta fora do contrato vira mensagem de reserva, não tela vazia", async () => {
    // O `level` é o que decide o que aparece na tela. Ausente ou como texto, a
    // navegação sumiria em silêncio — falhar é melhor (§5.2, §7.3).
    await withFetch(async (double) => {
      double.onJson("POST", "/api/auth/login", {
        data: { user: { id: 2, name: "X", role: "EDITOR", level: "2" }, csrfToken: "t" },
      });

      const error = await assertRejects(login({ email: "a@b.c", password: "x" }), ApiError);
      assertSame(error.message, MALFORMED_MESSAGE);
      assertFalse(isAuthenticated(), "sessão meio montada é pior que nenhuma");
    });
  });

  test("token vazio na resposta também é recusado", async () => {
    await withFetch(async (double) => {
      double.onJson("POST", "/api/auth/login", {
        data: { user: sessionPayload.data.user, csrfToken: "" },
      });

      // Sem token, toda escrita seguinte levaria 403 sem explicação.
      await assertRejects(login({ email: "a@b.c", password: "x" }), ApiError);
    });
  });

  test("não engole o erro: quem chama precisa distinguir 401 de 429", async () => {
    await withFetch(async (double) => {
      double.on("POST", "/api/auth/login", {
        status: 429,
        body: JSON.stringify({ message: "Muitas tentativas. Tente novamente em alguns minutos." }),
      });

      const error = await assertRejects(login({ email: "a@b.c", password: "x" }), ApiError);
      assertSame(error.status, 429);
    });
  });
});

suite("features/auth/api · leitura da sessão", () => {
  test("401 devolve nulo, porque é o caminho normal de quem não entrou", async () => {
    await withFetch(async (double) => {
      double.on("GET", "/api/auth/session", { status: 401, body: "" });

      assertNull(await loadSession());
      assertFalse(isAuthenticated());
    });
  });

  test("sessão válida é guardada", async () => {
    await withFetch(async (double) => {
      double.onJson("GET", "/api/auth/session", sessionPayload);

      const user = await loadSession();

      assertSame(user.role, "EDITOR");
      assertSame(getCsrfToken(), "a".repeat(64), "o token é rebuscado no boot");
    });
  });

  test("erro que não é 401 sobe, em vez de virar 'não logado'", async () => {
    // Tratar um 500 como ausência de sessão mandaria o usuário para o login
    // sem motivo, e ele não conseguiria entrar.
    await withFetch(async (double) => {
      double.on("GET", "/api/auth/session", { status: 500, body: "" });

      const error = await assertRejects(loadSession(), ApiError);
      assertSame(error.status, 500);
    });
  });
});

suite("features/auth/api · saída e troca de senha", () => {
  test("o logout limpa a sessão local", async () => {
    await withFetch(async (double) => {
      double.onJson("POST", "/api/auth/login", sessionPayload);
      double.on("DELETE", "/api/auth/session", { status: 204 });

      await login({ email: "a@b.c", password: "x" });
      await logout();

      assertNull(getUser());
      assertNull(getCsrfToken());
    });
  });

  test("o logout limpa mesmo quando a rede cai", async () => {
    // Deixar o usuário logado na tela porque o servidor não respondeu é o pior
    // dos dois mundos: ele acha que saiu e os dados continuam ali.
    await withFetch(async (double) => {
      double.onJson("POST", "/api/auth/login", sessionPayload);
      double.on("DELETE", "/api/auth/session", { networkFailure: true });

      await login({ email: "a@b.c", password: "x" });
      await cache.fetchOnce("cards|1", async () => "cartas", { ttlMs: 60000 });

      try {
        await logout();
      } catch {
        // a falha de rede sobe, e é isso mesmo
      }

      assertNull(getUser());
      assertNull(getCsrfToken());
      assertSame(cache.peek("cards|1"), undefined, "cache do usuário anterior sobreviveu");
    });
  });

  test("a troca de senha não manda userId, e encerra a sessão local", async () => {
    // O userId vem da sessão, no servidor. Aceitá-lo do cliente transformaria
    // a rota em "troque a senha de quem eu quiser" (RN-08). E a operação
    // revoga todas as sessões, inclusive a de quem pediu (RF-05).
    await withFetch(async (double) => {
      double.onJson("POST", "/api/auth/login", sessionPayload);
      double.on("PUT", "/api/auth/password", { status: 204 });

      await login({ email: "a@b.c", password: "x" });
      await changePassword({ currentPassword: "oraculo123", newPassword: "novaSenha123" });

      const enviado = JSON.parse(double.lastCall.body);
      assertSame(Object.keys(enviado).sort().join(","), "currentPassword,newPassword");
      assertFalse(isAuthenticated(), "o servidor revogou tudo; a tela precisa acompanhar");
    });
  });
});

suite("features/auth/api · o 401 ambíguo", () => {
  /**
   * O contrato usa 401 para três coisas: sessão ausente, sessão expirada e
   * credencial recusada. O tratador central não distingue as três, então as
   * rotas que apresentam o próprio erro precisam se declarar autossuficientes.
   * Sem isso, errar a senha expulsa a pessoa dizendo que a sessão expirou.
   */
  async function comTratador(body) {
    let avisos = 0;
    setSessionExpiredHandler(() => avisos++);

    try {
      await withFetch((double) => body(double, () => avisos));
    } finally {
      setSessionExpiredHandler(null);
    }

    return avisos;
  }

  test("senha errada no login NÃO dispara o aviso de sessão expirada", async () => {
    const avisos = await comTratador(async (double) => {
      double.on("POST", "/api/auth/login", {
        status: 401,
        body: JSON.stringify({ message: "E-mail ou senha inválidos." }),
      });

      const error = await assertRejects(login({ email: "a@b.c", password: "x" }), ApiError);
      assertSame(error.message, "E-mail ou senha inválidos.");
    });

    assertSame(avisos, 0, "o formulário mostra o próprio erro; o sistema não é o culpado");
  });

  test("senha atual errada na troca NÃO expulsa para o login", async () => {
    const avisos = await comTratador(async (double) => {
      double.on("PUT", "/api/auth/password", {
        status: 401,
        body: JSON.stringify({ message: "Senha atual incorreta." }),
      });

      await assertRejects(
        changePassword({ currentPassword: "errada", newPassword: "novaSenha123" }),
        ApiError,
      );
    });

    assertSame(avisos, 0);
  });

  test("401 numa leitura comum DISPARA o aviso, que é o caso de verdade", async () => {
    const avisos = await comTratador(async (double) => {
      double.on("GET", "/api/cards", { status: 401, body: "" });
      await assertRejects(api.get("/cards"), ApiError);
    });

    assertSame(avisos, 1);
  });

  test("401 no logout não avisa: a sessão já tinha morrido", async () => {
    const avisos = await comTratador(async (double) => {
      double.on("DELETE", "/api/auth/session", { status: 401, body: "" });

      try {
        await logout();
      } catch {
        // sobe, e tudo bem
      }
    });

    assertSame(avisos, 0);
  });
});
