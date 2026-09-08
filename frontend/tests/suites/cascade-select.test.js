import { cascadeSelect } from "@/shared/components/cascade-select.js";
import { scope } from "@/shared/dom/events.js";
import { assertFalse, assertSame, assertTrue, suite, test } from "~/runner.js";

/** Um carregador controlável: cada chamada devolve uma promessa que o teste resolve. */
function loaderDouble() {
  const calls = [];

  const load = (parent, { signal } = {}) =>
    new Promise((resolve, reject) => {
      const call = { parent, resolve, reject, signal, aborted: false };
      signal?.addEventListener("abort", () => {
        call.aborted = true;
        reject(new DOMException("Abortada", "AbortError"));
      });
      calls.push(call);
    });

  return { load, calls, get last() { return calls[calls.length - 1]; } };
}

const opcoes = (select) => [...select.options].map((o) => o.textContent);
const proximoQuadro = () => new Promise((r) => setTimeout(r, 0));

function comCascata(body) {
  const life = scope();
  const loader = loaderDouble();

  const cascade = cascadeSelect({
    id: `teste-${Math.random().toString(36).slice(2)}`,
    label: "Edição",
    placeholder: "Selecione",
    scope: life,
    loadOptions: loader.load,
  });

  return Promise.resolve(body({ cascade, loader })).finally(() => life.dispose());
}

suite("shared/components/cascade-select · estado inicial", () => {
  test("inicia DESABILITADO, sem pai escolhido (RF-20, RF-27)", () =>
    comCascata(({ cascade }) => {
      assertTrue(cascade.select.disabled);
      assertSame(cascade.state, "idle");
    }));

  test("permanece desabilitado enquanto carrega (RF-22)", () =>
    comCascata(async ({ cascade }) => {
      cascade.setParent("magic");
      await proximoQuadro();

      assertTrue(cascade.select.disabled, "habilitar antes de a lista chegar convida ao clique");
      assertSame(cascade.state, "loading");
      assertSame(cascade.select.getAttribute("aria-busy"), "true");
    }));

  test("habilita e popula quando a resposta chega (RF-23)", () =>
    comCascata(async ({ cascade, loader }) => {
      const pending = cascade.setParent("magic");
      await proximoQuadro();

      loader.last.resolve([{ id: "dom", name: "Dominaria" }]);
      await pending;

      assertFalse(cascade.select.disabled);
      assertSame(opcoes(cascade.select).join(","), "Selecione,Dominaria");
      assertSame(cascade.state, "ready");
    }));

  test("lista vazia é estado próprio, não erro", () =>
    comCascata(async ({ cascade, loader }) => {
      const pending = cascade.setParent("magic");
      await proximoQuadro();
      loader.last.resolve([]);
      await pending;

      assertSame(cascade.state, "empty");
      assertTrue(cascade.select.disabled);
    }));
});

suite("shared/components/cascade-select · RF-25, a corrida", () => {
  test("trocar o pai ABORTA a requisição anterior", () =>
    comCascata(async ({ cascade, loader }) => {
      cascade.setParent("magic");
      await proximoQuadro();
      const primeira = loader.last;

      cascade.setParent("pokemon");
      await proximoQuadro();

      assertTrue(primeira.aborted, "a busca do jogo antigo continuou viva");
    }));

  test("resposta ATRASADA de jogo já trocado é DESCARTADA", () =>
    comCascata(async ({ cascade, loader }) => {
      /*
       * O caso que o RF-25 caça, e que abortar sozinho não resolve: a resposta
       * do Magic já estava a caminho do `then` quando o abort chegou. Sem a
       * comparação de geração, ela sobrescreveria a lista do Pokémon.
       */
      cascade.setParent("magic");
      await proximoQuadro();
      const magic = loader.calls[0];

      const pendente = cascade.setParent("pokemon");
      await proximoQuadro();

      loader.calls[1].resolve([{ id: "base", name: "Base Set" }]);
      await pendente;

      // Agora o Magic responde, tarde.
      magic.resolve([{ id: "dom", name: "Dominaria" }]);
      await proximoQuadro();
      await proximoQuadro();

      assertSame(
        opcoes(cascade.select).join(","),
        "Selecione,Base Set",
        "a resposta atrasada do jogo anterior venceu a corrida",
      );
    }));

  test("três trocas em sequência terminam com a lista da última", () =>
    comCascata(async ({ cascade, loader }) => {
      cascade.setParent("magic");
      await proximoQuadro();
      cascade.setParent("pokemon");
      await proximoQuadro();
      const ultimo = cascade.setParent("yugioh");
      await proximoQuadro();

      loader.calls[2].resolve([{ id: "lob", name: "Legend of Blue Eyes" }]);
      await ultimo;

      // As duas primeiras respondem depois, fora de ordem.
      loader.calls[0].resolve([{ id: "dom", name: "Dominaria" }]);
      loader.calls[1].resolve([{ id: "base", name: "Base Set" }]);
      await proximoQuadro();
      await proximoQuadro();

      assertSame(opcoes(cascade.select).join(","), "Selecione,Legend of Blue Eyes");
    }));
});

suite("shared/components/cascade-select · reset e erro", () => {
  test("trocar o pai RESETA a seleção anterior (RF-24)", () =>
    comCascata(async ({ cascade, loader }) => {
      const primeira = cascade.setParent("magic");
      await proximoQuadro();
      loader.last.resolve([{ id: "dom", name: "Dominaria" }]);
      await primeira;

      cascade.select.value = "dom";
      cascade.select.dispatchEvent(new Event("change"));
      assertSame(cascade.value, "dom");

      const segunda = cascade.setParent("pokemon");
      await proximoQuadro();
      loader.last.resolve([{ id: "base", name: "Base Set" }]);
      await segunda;

      assertSame(cascade.value, "", "a edição do jogo anterior continuou selecionada");
    }));

  test("a seleção só sobrevive se existir na lista NOVA", () =>
    comCascata(async ({ cascade, loader }) => {
      // É o caso de restaurar a partir da URL: `?jogo=magic&edicao=dom` deve
      // manter "dom"; `?jogo=magic&edicao=inventada` não pode.
      cascade.setValue("dom");
      const pending = cascade.setParent("magic", { keepSelection: true });
      await proximoQuadro();
      loader.last.resolve([{ id: "dom", name: "Dominaria" }]);
      await pending;

      assertSame(cascade.value, "dom");
    }));

  test("seleção inexistente na lista nova cai no vazio", () =>
    comCascata(async ({ cascade, loader }) => {
      cascade.setValue("nao-existe");
      const pending = cascade.setParent("magic", { keepSelection: true });
      await proximoQuadro();
      loader.last.resolve([{ id: "dom", name: "Dominaria" }]);
      await pending;

      assertSame(cascade.value, "");
    }));

  test("limpar o pai devolve o campo ao estado inicial", () =>
    comCascata(async ({ cascade, loader }) => {
      const pending = cascade.setParent("magic");
      await proximoQuadro();
      loader.last.resolve([{ id: "dom", name: "Dominaria" }]);
      await pending;

      await cascade.setParent("");

      assertTrue(cascade.select.disabled);
      assertSame(cascade.state, "idle");
      assertSame(cascade.value, "");
    }));

  test("a ação de tentar de novo só aparece na falha (RF-26)", () =>
    comCascata(async ({ cascade, loader }) => {
      const acao = () => cascade.wrapper.querySelector(".field-footer button");

      assertTrue(acao().hidden, "no estado inicial não há o que repetir");

      const pending = cascade.setParent("magic");
      await proximoQuadro();
      assertTrue(acao().hidden, "carregando não é falha");

      loader.last.reject(new Error("rede caiu"));
      await pending.catch(() => {});

      assertFalse(acao().hidden, "sem a ação, o campo morre na primeira falha de rede");

      // `hidden` tira o botão da ordem de foco: um botão invisível que ainda
      // recebe Tab é uma parada fantasma para quem navega por teclado.
      const retomada = cascade.retry();
      await proximoQuadro();
      loader.last.resolve([{ id: "dom", name: "Dominaria" }]);
      await retomada;

      assertTrue(acao().hidden, "resolvida a falha, a ação some");
    }));

  test("falha vira estado de erro sem travar o campo (RF-26)", () =>
    comCascata(async ({ cascade, loader }) => {
      const pending = cascade.setParent("magic");
      await proximoQuadro();
      loader.last.reject(new Error("rede caiu"));

      await pending.catch(() => {});

      assertSame(cascade.state, "failed");
      // `retry()` existe e recarrega: o campo não fica morto.
      const retry = cascade.retry();
      await proximoQuadro();
      loader.last.resolve([{ id: "dom", name: "Dominaria" }]);
      await retry;

      assertSame(cascade.state, "ready");
      assertSame(opcoes(cascade.select).join(","), "Selecione,Dominaria");
    }));
});
