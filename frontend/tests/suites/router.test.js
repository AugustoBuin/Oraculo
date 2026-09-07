import { createRouter, matchRoute } from "@/shared/router/router.js";
import { assertNull, assertSame, assertTrue, suite, test } from "~/runner.js";

suite("shared/router · casamento de rota", () => {
  test("casa caminho literal", () => {
    assertSame(JSON.stringify(matchRoute("/cartas", "/cartas")), "{}");
  });

  test("ignora barra final e barra dupla", () => {
    assertTrue(matchRoute("/cartas", "/cartas/") !== null);
  });

  test("extrai parâmetro nomeado", () => {
    assertSame(matchRoute("/cartas/:id", "/cartas/12").id, "12");
  });

  test("extrai vários parâmetros", () => {
    const params = matchRoute("/jogos/:gameId/edicoes/:code", "/jogos/magic/edicoes/dom");

    assertSame(params.gameId, "magic");
    assertSame(params.code, "dom");
  });

  test("decodifica o valor do parâmetro", () => {
    assertSame(matchRoute("/cartas/:nome", "/cartas/Ilha%20Misteriosa").nome, "Ilha Misteriosa");
  });

  test("não casa quando o número de segmentos difere", () => {
    assertNull(matchRoute("/cartas/:id", "/cartas"));
    assertNull(matchRoute("/cartas", "/cartas/12"));
  });

  test("não casa quando o segmento literal difere", () => {
    assertNull(matchRoute("/cartas/:id", "/jogos/12"));
  });

  test("percentual malformado não casa, e não lança", () => {
    // A URL é entrada externa e chega assim. Lançar aqui viraria rejeição não
    // tratada, porque o casamento roda fora do try do render.
    assertNull(matchRoute("/cartas/:id", "/cartas/%E0%A4%A"));
    assertNull(matchRoute("/cartas/:id", "/cartas/%"));
  });
});

suite("shared/router · limpeza entre telas", () => {
  /**
   * Roda o corpo e devolve a URL ao lugar.
   *
   * `pushState` não recarrega, mas deixar a página de testes em outro caminho
   * atrapalharia quem recarregasse depois.
   */
  async function withRouter(routes, body) {
    const original = window.location.pathname + window.location.search;
    const root = document.createElement("div");

    const router = createRouter({
      routes,
      root,
      notFound: () => null,
    });

    const stop = router.start();

    try {
      await body(router, root);
    } finally {
      stop();
      window.history.replaceState({}, "", original);
    }
  }

  test("chama a limpeza da tela anterior antes de montar a próxima", async () => {
    const ordem = [];

    await withRouter(
      [
        {
          path: "/rota-a",
          page: () => {
            ordem.push("monta A");
            return () => ordem.push("limpa A");
          },
        },
        {
          path: "/rota-b",
          page: () => {
            ordem.push("monta B");
            return () => ordem.push("limpa B");
          },
        },
      ],
      async (router) => {
        await router.navigate("/rota-a");
        await router.navigate("/rota-b");

        assertSame(ordem.join(" · "), "monta A · limpa A · monta B");
      },
    );
  });

  test("a limpeza do roteador encerra a tela que está no ar", async () => {
    let limpou = false;

    await withRouter(
      [{ path: "/rota-a", page: () => () => (limpou = true) }],
      async (router) => {
        await router.navigate("/rota-a");
        assertSame(limpou, false);
      },
    );

    // `stop()` já rodou dentro do finally do withRouter.
    assertTrue(limpou, "nenhuma tela pode sobreviver ao roteador (RNF-07)");
  });

  test("página lenta que perde a corrida não desenha por cima", async () => {
    // Mesma corrida do RF-25, aqui no nível da rota: o usuário navega enquanto
    // a página anterior ainda monta.
    const eventos = [];

    await withRouter(
      [
        {
          path: "/lenta",
          page: async () => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            eventos.push("lenta terminou de montar");
            return () => eventos.push("lenta foi encerrada");
          },
        },
        {
          path: "/rapida",
          page: () => {
            eventos.push("rápida montou");
            return () => eventos.push("rápida limpou");
          },
        },
      ],
      async (router) => {
        const lenta = router.navigate("/lenta");
        await router.navigate("/rapida");
        await lenta;

        // A lenta termina depois, percebe que perdeu e encerra o que criou em
        // vez de virar a tela no ar.
        assertSame(
          eventos.join(" · "),
          "rápida montou · lenta terminou de montar · lenta foi encerrada",
        );
      },
    );
  });

  test("rota inexistente cai no notFound sem lançar", async () => {
    let caiu = false;
    const root = document.createElement("div");
    const original = window.location.pathname;

    const router = createRouter({
      routes: [{ path: "/existe", page: () => null }],
      root,
      notFound: () => {
        caiu = true;
        return null;
      },
    });

    const stop = router.start();

    try {
      await router.navigate("/nao-existe");
      assertTrue(caiu);
    } finally {
      stop();
      window.history.replaceState({}, "", original);
    }
  });
});
