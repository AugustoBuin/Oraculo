import { api, buildUrl, request } from "@/shared/api/client.js";
import { clearCsrfToken, setCsrfToken } from "@/shared/api/csrf.js";
import {
  ApiError,
  FALLBACK_MESSAGE,
  MALFORMED_MESSAGE,
  NetworkError,
  TIMEOUT_MESSAGE,
  TimeoutError,
  userMessage,
} from "@/shared/api/errors.js";
import { fetchDouble } from "~/doubles/fetch.js";
import {
  assertRejects,
  assertSame,
  assertTrue,
  suite,
  test,
} from "~/runner.js";

/**
 * Instala o dublê, roda o corpo e restaura — sempre.
 *
 * Sem o `finally`, um teste que falha deixaria o `fetch` trocado e derrubaria
 * todos os seguintes: teste que interfere no outro é dívida, não proteção
 * (§13.4).
 */
async function withFetch(body) {
  const double = fetchDouble();

  try {
    await body(double);
    assertSame(double.unexpected.length, 0, `requisição não prevista: ${double.unexpected}`);
  } finally {
    double.restore();
    clearCsrfToken();
  }
}

suite("shared/api/client · montagem da URL", () => {
  test("prefixa a API e mantém o caminho", () => {
    assertSame(buildUrl("/cards"), "/api/cards");
  });

  test("omite parâmetro vazio em vez de mandá-lo em branco", () => {
    // `?search=` faria o servidor filtrar por string vazia em vez de não
    // filtrar — e a listagem voltaria vazia sem motivo aparente.
    assertSame(buildUrl("/cards", { search: "", game: null, page: undefined }), "/api/cards");
  });

  test("mantém o zero, que é valor e não ausência", () => {
    assertSame(buildUrl("/cards", { page: 0 }), "/api/cards?page=0");
  });

  test("escapa acento e espaço", () => {
    // Nome de carta em português passa por aqui o tempo todo.
    assertSame(buildUrl("/cards", { search: "Ilha Misteriosa" }), "/api/cards?search=Ilha+Misteriosa");
    assertSame(buildUrl("/cards", { search: "Anão" }), "/api/cards?search=An%C3%A3o");
  });

  test("combina vários filtros", () => {
    const url = buildUrl("/cards", { game: "magic", edition: "dom", page: 2 });

    assertSame(url, "/api/cards?game=magic&edition=dom&page=2");
  });
});

suite("shared/api/client · CSRF", () => {
  test("leitura não manda o token", async () => {
    await withFetch(async (double) => {
      setCsrfToken("abc123");
      double.onJson("GET", "/api/cards", { data: [] });

      await api.get("/cards");

      assertSame(double.lastCall.headers["X-CSRF-Token"], undefined);
    });
  });

  test("escrita manda o token quando há sessão", async () => {
    await withFetch(async (double) => {
      setCsrfToken("abc123");
      double.onJson("POST", "/api/cards", { data: {} }, 201);

      await api.post("/cards", { nameEn: "Black Lotus" });

      assertSame(double.lastCall.headers["X-CSRF-Token"], "abc123");
    });
  });

  test("o login não manda o cabeçalho, porque ainda não há token", async () => {
    await withFetch(async (double) => {
      // A isenção acontece sozinha: o login é a rota que EMITE o token.
      clearCsrfToken();
      double.onJson("POST", "/api/auth/login", { data: {} });

      await api.post("/auth/login", { email: "a@b.c", password: "x" });

      assertSame(double.lastCall.headers["X-CSRF-Token"], undefined);
    });
  });

  test("o token não vai para o armazenamento nem para a URL", async () => {
    await withFetch(async (double) => {
      setCsrfToken("segredo-csrf");
      double.onJson("POST", "/api/cards", { data: {} }, 201);

      await api.post("/cards", { nameEn: "X" });

      // Varre o armazenamento inteiro em vez de conferir uma chave escolhida:
      // checar uma chave que nunca foi escrita passa à toa e não protege nada.
      const guardado = [
        ...Object.entries(window.localStorage),
        ...Object.entries(window.sessionStorage),
      ].some(([key, value]) => key.includes("segredo-csrf") || value.includes("segredo-csrf"));

      assertSame(guardado, false, "o token não pode ser persistido: XSS lê os dois na hora");
      assertSame(document.cookie.includes("segredo-csrf"), false);
      assertSame(double.lastCall.url.includes("segredo-csrf"), false, "nem na URL");
    });
  });

  test("a requisição vai com credenciais da mesma origem", async () => {
    await withFetch(async (double) => {
      double.onJson("GET", "/api/cards", { data: [] });

      await api.get("/cards");

      assertSame(double.lastCall.credentials, "same-origin");
    });
  });
});

suite("shared/api/client · corpo da resposta", () => {
  test("204 devolve nulo sem tentar desserializar", async () => {
    await withFetch(async (double) => {
      // É o logout. `JSON.parse("")` lançaria e quebraria a saída da sessão.
      double.on("DELETE", "/api/auth/session", { status: 204 });

      assertSame(await api.delete("/auth/session"), null);
    });
  });

  test("corpo vazio com 200 devolve nulo", async () => {
    await withFetch(async (double) => {
      double.on("GET", "/api/cards", { status: 200, body: "" });

      assertSame(await api.get("/cards"), null);
    });
  });

  test("corpo malformado vira mensagem de reserva, não erro de sintaxe", async () => {
    await withFetch(async (double) => {
      double.on("GET", "/api/cards", { status: 200, body: "{isto não é json" });

      const error = await assertRejects(api.get("/cards"), ApiError);
      assertSame(error.message, MALFORMED_MESSAGE);
    });
  });

  test("envia FormData sem escrever o Content-Type", async () => {
    await withFetch(async (double) => {
      // O navegador precisa escrever o delimitador sozinho; escrever à mão
      // aqui quebraria todo upload de imagem.
      setCsrfToken("abc");
      double.onJson("POST", "/api/uploads/card-image", { data: {} }, 201);

      const form = new FormData();
      form.set("file", new Blob(["x"]), "c.png");
      await api.post("/uploads/card-image", form);

      assertSame(double.lastCall.headers["Content-Type"], undefined);
    });
  });
});

suite("shared/api/client · tradução de erro", () => {
  test("prefere a mensagem do servidor, que é específica e segura", async () => {
    await withFetch(async (double) => {
      double.on("POST", "/api/cards", {
        status: 400,
        body: JSON.stringify({ message: "A edição selecionada não pertence ao jogo escolhido." }),
      });

      const error = await assertRejects(api.post("/cards", {}), ApiError);
      assertSame(error.message, "A edição selecionada não pertence ao jogo escolhido.");
    });
  });

  test("cai no mapa por status quando o servidor não manda mensagem", async () => {
    await withFetch(async (double) => {
      double.on("GET", "/api/cards", { status: 500, body: "" });

      const error = await assertRejects(api.get("/cards"), ApiError);
      assertSame(error.message, "Algo deu errado do nosso lado. Tente novamente em instantes.");
    });
  });

  test("preserva o mapa de erros por campo para o formulário", async () => {
    await withFetch(async (double) => {
      double.on("POST", "/api/cards", {
        status: 400,
        body: JSON.stringify({
          message: "Verifique os campos destacados.",
          errors: { nameEn: "O nome em inglês é obrigatório." },
        }),
      });

      const error = await assertRejects(api.post("/cards", {}), ApiError);
      assertSame(error.errors.nameEn, "O nome em inglês é obrigatório.");
    });
  });

  test("401 e 403 são distinguíveis, porque levam a fluxos diferentes", async () => {
    await withFetch(async (double) => {
      double.on("GET", "/api/cards", { status: 401, body: "" });
      const unauthorized = await assertRejects(api.get("/cards"), ApiError);
      assertTrue(unauthorized.isUnauthorized, "401 leva ao login");
      assertSame(unauthorized.isForbidden, false);

      double.on("GET", "/api/games", { status: 403, body: "" });
      const forbidden = await assertRejects(api.get("/games"), ApiError);
      assertTrue(forbidden.isForbidden, "403 NÃO desloga (ADR-007)");
      assertSame(forbidden.isUnauthorized, false);
    });
  });

  test("falha de rede vira NetworkError com texto acionável", async () => {
    await withFetch(async (double) => {
      double.on("GET", "/api/cards", { networkFailure: true });

      const error = await assertRejects(api.get("/cards"), NetworkError);
      assertSame(error.message.includes("conexão"), true);
    });
  });

  test("tempo esgotado vira TimeoutError, não erro cru de aborto", async () => {
    await withFetch(async (double) => {
      double.on("GET", "/api/cards", { hang: true });

      const error = await assertRejects(request("/cards", { timeoutMs: 20 }), TimeoutError);
      assertSame(error.message, TIMEOUT_MESSAGE);
    });
  });

  test("cancelamento deliberado NÃO vira mensagem de erro", async () => {
    await withFetch(async (double) => {
      // É o caminho normal da cascata (RF-25) e o da tela que morre. Mostrar
      // "falha de rede" aqui seria assustar o usuário com o funcionamento
      // correto.
      double.on("GET", "/api/games/magic/editions", { hang: true });

      const controller = new AbortController();
      const pending = request("/games/magic/editions", { signal: controller.signal });
      controller.abort();

      const error = await assertRejects(pending, Error);
      assertSame(error instanceof TimeoutError, false, "não é tempo esgotado");
      assertSame(error instanceof NetworkError, false, "não é falha de rede");
      assertSame(error.name, "AbortError");
    });
  });
});

suite("shared/api/errors · mensagem para o usuário", () => {
  test("erro de programação nunca vaza o texto técnico", () => {
    // "Cannot read properties of undefined (reading 'id')" é exatamente o que
    // o §7.1 proíbe de chegar à tela.
    const raw = new TypeError("Cannot read properties of undefined (reading 'id')");

    assertSame(userMessage(raw), FALLBACK_MESSAGE);
  });

  test("ApiError sem mensagem cai na reserva", () => {
    assertSame(userMessage(new ApiError(500, "")), FALLBACK_MESSAGE);
  });

  test("valores impossíveis não viram texto na tela", () => {
    assertSame(userMessage(null), FALLBACK_MESSAGE);
    assertSame(userMessage(undefined), FALLBACK_MESSAGE);
    assertSame(userMessage({}), FALLBACK_MESSAGE);
  });

  test("mensagem construída por nós passa", () => {
    assertSame(userMessage(new ApiError(409, "Já existe uma carta com este nome nesta edição.")),
      "Já existe uma carta com este nome nesta edição.");
  });
});
