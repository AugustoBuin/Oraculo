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
 *
 * E, no fim, **a virada** — a carta girando e a aplicação entrando atrás dela.
 * Aqui o olho é ainda menos útil: meio segundo passa depressa demais para se
 * conferir a ordem dos passos, e é justamente a ordem que carrega os defeitos.
 */

import { loginPage } from "@/pages/login/login-page.js";
import { clearSession } from "@/shared/session/session.js";
import { fetchDouble } from "~/doubles/fetch.js";
import { assertFalse, assertSame, assertTrue, suite, test } from "~/runner.js";

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

/**
 * A sessão que o servidor devolve quando a credencial confere (§3.1 do
 * contrato). O `level` é o que decide a navegação — sem ele a entrada nem
 * chega a acontecer.
 */
const SESSAO = {
  data: {
    user: { id: 3, name: "Consulta", email: "consulta@oraculo.local", role: "VIEWER", level: 1 },
    csrfToken: "c".repeat(64),
  },
};

/** Uma volta da fila de tarefas, sem o estrangulamento do `setTimeout` em aba oculta. */
const voltaDaFila = () =>
  new Promise((resolve) => {
    const canal = new MessageChannel();

    canal.port1.onmessage = () => resolve();
    canal.port2.postMessage(null);
  });

/**
 * Espera uma condição, com teto.
 *
 * A entrada atravessa rede dublada, leitura de corpo e promessa de animação —
 * contar voltas na mão seria adivinhação. E esperar para sempre travaria a
 * página de testes em vez de acusar o defeito.
 */
async function ate(condicao, mensagem, voltas = 80) {
  for (let volta = 0; volta < voltas; volta += 1) {
    if (condicao()) {
      return;
    }

    await voltaDaFila();
  }

  throw new Error(`tempo esgotado: ${mensagem}`);
}

/**
 * Monta a entrada com o `fetch` dublado e entrega as alavancas da virada.
 *
 * `onAuthenticated` faz aqui o que o `appShell` faz na aplicação e a virada
 * enxerga: troca o conteúdo da raiz e traz o próprio `<main>` focável. Ele
 * guarda o estado da raiz **no instante da troca** — é lá, e só lá, que dá
 * para provar que a aplicação entrou invisível.
 */
async function naEntrada(corpo, { resposta } = {}) {
  const rede = fetchDouble();

  rede.on("POST", "/api/auth/login", resposta ?? { status: 200, body: JSON.stringify(SESSAO) });

  const raiz = document.createElement("div");

  document.body.append(raiz);

  const entrada = [];

  const entrar = (user) => {
    const estilo = getComputedStyle(raiz);

    entrada.push({ user, opacidade: estilo.opacity, transicao: estilo.transitionProperty });

    const principal = document.createElement("main");

    principal.id = "conteudo";
    principal.tabIndex = -1;
    raiz.replaceChildren(principal);
  };

  const limpar = loginPage(raiz, { onAuthenticated: entrar });
  const carta = raiz.querySelector(".login-card");

  const submeter = () => {
    raiz.querySelector("#email").value = "consulta@oraculo.local";
    raiz.querySelector("#senha").value = "oraculo123";
    raiz.querySelector(".login-form").requestSubmit();
  };

  try {
    await corpo({
      raiz,
      carta,
      entrada,
      submeter,
      virando: () => carta.dataset.state === "turning",

      /*
       * Terminar a animação à mão é o que torna o teste determinístico: aba em
       * segundo plano não anima, e esperar 320ms de relógio deixaria a suíte
       * refém da visibilidade da janela.
       */
      terminarAVirada: () => carta.getAnimations().forEach((animacao) => animacao.finish()),
    });

    assertSame(rede.unexpected.length, 0, `requisição não prevista: ${rede.unexpected}`);
  } finally {
    limpar();
    raiz.remove();
    rede.restore();
    clearSession();
  }
}

/**
 * A virada.
 *
 * A carta que a pessoa acabou de preencher vira, e a aplicação entra atrás
 * dela. O que esta suíte protege é a ORDEM e o que ela custa: a carta não vira
 * antes de o servidor responder, não vira quando a credencial é recusada, e
 * ninguém fica sem foco no caminho.
 */
suite("pages/login · a virada", () => {
  test("a carta não vira enquanto o servidor não responde", () =>
    naEntrada(
      async ({ submeter, virando }) => {
        submeter();

        for (let volta = 0; volta < 5; volta += 1) {
          await voltaDaFila();
        }

        assertFalse(virando(), "a carta virou antes de o servidor responder");
      },
      { resposta: { hang: true } },
    ));

  test("a aplicação só entra depois que a carta termina de virar", () =>
    naEntrada(async ({ carta, entrada, submeter, virando, terminarAVirada }) => {
      submeter();

      await ate(virando, "a carta não virou depois da resposta");

      const virada = carta.getAnimations().filter((a) => a.animationName === "leave-flip");

      assertSame(virada.length, 1, "a virada não é a animação `leave-flip` do CSS");
      assertSame(entrada.length, 0, "a aplicação entrou antes de a carta virar");

      terminarAVirada();

      await ate(() => entrada.length === 1, "a aplicação não entrou depois da virada");
      assertSame(entrada[0].user.name, "Consulta");
    }));

  test("o formulário continua travado enquanto a carta vira", () =>
    naEntrada(async ({ raiz, submeter, virando }) => {
      submeter();

      await ate(virando, "a carta não virou depois da resposta");

      const entrar = raiz.querySelector(".login-form .button");

      assertTrue(entrar.disabled, "o botão voltou a aceitar envio no meio da virada");
      assertSame(entrar.getAttribute("aria-busy"), "true");
    }));

  test("credencial recusada NÃO vira a carta", () =>
    naEntrada(
      async ({ raiz, entrada, submeter, virando }) => {
        submeter();

        await ate(
          () => raiz.querySelector(".form-alert").textContent !== "",
          "o erro não apareceu no formulário",
        );

        assertFalse(virando(), "a carta virou com a credencial recusada");
        assertSame(entrada.length, 0, "a aplicação entrou com a credencial recusada");
      },
      { resposta: { status: 401, body: JSON.stringify({ message: "E-mail ou senha inválidos." }) } },
    ));

  test("a aplicação entra invisível e aparece por TRANSIÇÃO de opacidade", () =>
    naEntrada(async ({ raiz, entrada, submeter, virando, terminarAVirada }) => {
      submeter();
      await ate(virando, "a carta não virou depois da resposta");
      terminarAVirada();
      await ate(() => entrada.length === 1, "a aplicação não entrou depois da virada");

      /*
       * O estado de chegada NÃO transiciona, e é isso que o teste guarda.
       *
       * Com movimento reduzido o projeto declara transição de `opacity` em
       * todo elemento (§11.3): sem uma exceção explícita, ficar invisível
       * também vira transição, a tela esmaece PARA invisível e volta — sem
       * virada e sem esmaecimento. Rodar a suíte com
       * `--force-prefers-reduced-motion` foi o que revelou.
       */
      assertSame(entrada[0].opacidade, "0", "a aplicação entrou visível: não há esmaecimento");
      assertSame(entrada[0].transicao, "none", "o estado de chegada esmaece em vez de nascer");

      // E o que vem DEPOIS é transição, não animação: é o que sobrevive a
      // quem pediu menos movimento.
      assertTrue(
        getComputedStyle(raiz).transitionProperty.includes("opacity"),
        getComputedStyle(raiz).transitionProperty,
      );
      assertFalse(
        raiz.classList.contains("enter-fade-start"),
        "a aplicação ficou presa em invisível",
      );
    }));

  test("o foco não se perde: ele vai para o conteúdo da tela que entrou", () =>
    naEntrada(async ({ raiz, entrada, submeter, virando, terminarAVirada }) => {
      submeter();
      await ate(virando, "a carta não virou depois da resposta");
      terminarAVirada();
      await ate(() => entrada.length === 1, "a aplicação não entrou depois da virada");

      assertSame(document.activeElement, raiz.querySelector("#conteudo"));
    }));
});
