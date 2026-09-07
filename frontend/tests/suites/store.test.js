import { cacheKey, createCache } from "@/shared/store/cache.js";
import { createStore } from "@/shared/store/store.js";
import { assertSame, assertThrows, assertTrue, suite, test } from "~/runner.js";

suite("shared/store/store", () => {
  test("avisa os assinantes quando o estado muda", () => {
    const store = createStore({ aba: "galeria" });
    const recebidos = [];

    store.subscribe((state) => recebidos.push(state.aba));
    store.setState({ aba: "tabela" });

    assertSame(recebidos.join(","), "tabela");
  });

  test("não avisa quando nada mudou de fato", () => {
    // Avisar à toa provoca redesenho à toa, que é a forma mais discreta de
    // deixar a tela lenta sem erro nenhum no console.
    const store = createStore({ aba: "galeria" });
    let avisos = 0;

    store.subscribe(() => avisos++);
    store.setState({ aba: "galeria" });

    assertSame(avisos, 0);
  });

  test("subscribe devolve a função de cancelamento", () => {
    const store = createStore({ n: 0 });
    let avisos = 0;

    const unsubscribe = store.subscribe(() => avisos++);
    store.setState({ n: 1 });
    unsubscribe();
    store.setState({ n: 2 });

    assertSame(avisos, 1, "o assinante cancelado não deveria receber mais nada");
    assertSame(store.subscriberCount, 0);
  });

  test("o estado sai congelado", () => {
    // Estado mutado por fora não avisa ninguém, e o componente que não recebeu
    // o aviso simplesmente não redesenha — bug sem rastro.
    const store = createStore({ n: 0 });

    assertTrue(Object.isFrozen(store.getState()));
  });

  test("assinante que lança não impede os outros de receber", () => {
    const store = createStore({ n: 0 });
    let recebeu = false;

    store.subscribe(() => {
      throw new Error("falha proposital");
    });
    store.subscribe(() => {
      recebeu = true;
    });

    store.setState({ n: 1 });

    assertTrue(recebeu, "metade da tela ficaria desatualizada em silêncio");
  });

  test("cancelar dentro do próprio aviso não quebra a iteração", () => {
    const store = createStore({ n: 0 });
    let segundo = false;
    let cancelar = null;

    cancelar = store.subscribe(() => cancelar());
    store.subscribe(() => {
      segundo = true;
    });

    store.setState({ n: 1 });

    assertTrue(segundo);
  });

  test("aceita função para derivar do estado anterior", () => {
    const store = createStore({ n: 1 });

    store.setState((state) => ({ n: state.n + 1 }));

    assertSame(store.getState().n, 2);
  });
});

suite("shared/store/cache · chave", () => {
  test("monta a chave a partir de primitivos", () => {
    assertSame(cacheKey("cards", 1, 20, "magic"), "cards|1|20|magic");
  });

  test("trata nulo e indefinido como ausência, não como texto", () => {
    assertSame(cacheKey("cards", null, undefined), "cards||");
  });

  test("RECUSA objeto, que é a armadilha do §5.4", () => {
    // Passar { page, perPage } funcionaria e produziria uma chave diferente a
    // cada render, sem nunca dar erro: cache que nunca acerta.
    assertThrows(() => cacheKey("cards", { page: 1 }), TypeError);
    assertThrows(() => cacheKey("cards", [1, 2]), TypeError);
  });
});

suite("shared/store/cache · leitura", () => {
  const policy = { ttlMs: 1000 };

  test("exige política de validade explícita", () => {
    // Leitura sem prazo declarado é achado ALTO em auditoria (§17.1).
    const cache = createCache();

    return cache
      .fetchOnce("x", async () => 1, {})
      .then(
        () => {
          throw new Error("deveria ter lançado");
        },
        (error) => assertTrue(error instanceof TypeError),
      );
  });

  test("duas chamadas em paralelo disparam UM carregamento", async () => {
    // Componentes irmãos pedindo o mesmo dado geram requisições repetidas e
    // estados divergentes na mesma tela (§5.5).
    const cache = createCache();
    let chamadas = 0;

    const loader = async () => {
      chamadas++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "dados";
    };

    const [a, b] = await Promise.all([
      cache.fetchOnce("cards|1", loader, policy),
      cache.fetchOnce("cards|1", loader, policy),
    ]);

    assertSame(chamadas, 1);
    assertSame(a, "dados");
    assertSame(b, "dados");
  });

  test("serve do cache enquanto está fresco, sem chamar o carregador", async () => {
    const cache = createCache();
    let chamadas = 0;

    const loader = async () => {
      chamadas++;
      return chamadas;
    };

    await cache.fetchOnce("games", loader, policy);
    const segunda = await cache.fetchOnce("games", loader, policy);

    assertSame(chamadas, 1);
    assertSame(segunda, 1);
  });

  test("recarrega depois de vencido", async () => {
    let agora = 0;
    const cache = createCache({ now: () => agora });
    let chamadas = 0;

    const loader = async () => ++chamadas;

    await cache.fetchOnce("cards", loader, { ttlMs: 100 });
    agora = 150;
    await cache.fetchOnce("cards", loader, { ttlMs: 100 });

    assertSame(chamadas, 2);
  });

  test("falha não trava a chave: tentar de novo tenta de novo", async () => {
    // Sem remover o em-voo no erro, a chave devolveria para sempre a mesma
    // promessa rejeitada, e o botão de "tentar novamente" não tentaria nada.
    const cache = createCache();
    let chamadas = 0;

    const loader = async () => {
      chamadas++;
      if (chamadas === 1) throw new Error("rede caiu");
      return "ok";
    };

    try {
      await cache.fetchOnce("cards", loader, policy);
    } catch {
      // esperado
    }

    assertSame(await cache.fetchOnce("cards", loader, policy), "ok");
    assertSame(chamadas, 2);
  });

  test("invalida o escopo mínimo, não o cache inteiro", async () => {
    // Alterar uma carta não muda a lista de edições. Derrubar tudo a cada
    // mutação transforma cache em enfeite (§5.4).
    const cache = createCache();

    await cache.fetchOnce(cacheKey("cards", 1), async () => "lista", policy);
    await cache.fetchOnce(cacheKey("catalogs", "games"), async () => "jogos", policy);

    cache.invalidate("cards");

    assertSame(cache.peek(cacheKey("cards", 1)), undefined);
    assertSame(cache.peek(cacheKey("catalogs", "games")), "jogos");
  });

  test("invalidate não derruba chave que só começa parecido", async () => {
    const cache = createCache();

    await cache.fetchOnce("cards", async () => "a", policy);
    await cache.fetchOnce("cardsets", async () => "b", policy);

    cache.invalidate("cards");

    assertSame(cache.peek("cards"), undefined);
    assertSame(cache.peek("cardsets"), "b", "prefixo não é 'começa com o texto'");
  });

  test("clear esvazia tudo", async () => {
    const cache = createCache();

    await cache.fetchOnce("a", async () => 1, policy);
    await cache.fetchOnce("b", async () => 2, policy);
    cache.clear();

    assertSame(cache.size, 0);
  });
});
