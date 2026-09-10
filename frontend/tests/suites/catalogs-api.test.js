/**
 * A leitura de catálogos da administração.
 *
 * A suíte nasceu do OF-002: `listForAdmin` sequer ACEITAVA um `signal`, então
 * as duas listagens da tela de administração não tinham como ser canceladas —
 * sair da tela deixava as respostas chegando a um DOM já descartado (RNF-07,
 * `PADROES-ENGENHARIA.md` §12.4).
 *
 * O que se fixa aqui é a ponta testável: que o sinal chega até a fronteira da
 * rede e que abortar de fato interrompe a leitura em voo. As guardas depois do
 * `await`, nas páginas, são camada de DOM — roteiro manual, por ADR-004.
 */

import {
  createRarity,
  listEditionsForAdmin,
  listRaritiesForAdmin,
  updateEdition,
  updateRarity,
} from "@/features/catalogs/api/catalogs-api.js";
import { fetchDouble } from "~/doubles/fetch.js";
import { assertFalse, assertSame, assertTrue, suite, test } from "~/runner.js";

/** Instala o dublê, roda o corpo e restaura o `fetch` — inclusive se falhar. */
async function comRede(body) {
  const double = fetchDouble();

  try {
    return await body(double);
  } finally {
    double.restore();
  }
}

const ITENS = { data: [{ id: "dom", ref: 4, name: "Dominaria", active: true }] };

/**
 * Aborta uma leitura em voo e devolve `true` se ela de fato foi interrompida.
 *
 * O que se mede é COMPORTAMENTO, não identidade de objeto: o cliente HTTP tem
 * controlador próprio, por causa do teto de espera, e encaminha o abort de quem
 * chamou por um listener que ele remove no `finally` (`client.js:213-216`).
 * O sinal que chega ao `fetch` é o dele, nunca o nosso — comparar os dois
 * falharia mesmo com o cancelamento funcionando perfeitamente.
 */
async function abortaEmVoo(double, path, ler) {
  // Resposta que nunca chega: é o caso real de sair da tela enquanto a
  // listagem ainda está no ar.
  double.on("GET", path, { hang: true });

  const controller = new AbortController();
  const pendente = ler(controller.signal);

  controller.abort();

  try {
    await pendente;
    return false;
  } catch {
    return true;
  }
}

suite("features/catalogs/api · a listagem de administração é cancelável", () => {
  test("a leitura chega à rede com um sinal — antes não havia como passar um", () =>
    comRede(async (double) => {
      double.onJson("GET", "/api/games/magic/editions", ITENS);

      await listEditionsForAdmin("magic", { signal: new AbortController().signal });

      assertTrue(double.lastCall.signal instanceof AbortSignal);
    }));

  test("abortar interrompe a listagem de edições em voo", () =>
    comRede(async (double) => {
      const interrompeu = await abortaEmVoo(double, "/api/games/magic/editions", (signal) =>
        listEditionsForAdmin("magic", { signal }),
      );

      assertTrue(interrompeu);
    }));

  test("as raridades cancelam pelo mesmo caminho", () =>
    comRede(async (double) => {
      const interrompeu = await abortaEmVoo(double, "/api/games/magic/rarities", (signal) =>
        listRaritiesForAdmin("magic", { signal }),
      );

      assertTrue(interrompeu);
    }));

  test("chamar sem opções continua funcionando — a tela que não cancela não quebra", () =>
    comRede(async (double) => {
      double.onJson("GET", "/api/games/magic/editions", ITENS);

      const items = await listEditionsForAdmin("magic");

      assertSame(items.length, 1);
      assertSame(items[0].id, "dom");
    }));
});

suite("features/catalogs/api · a escrita leva o registro inteiro", () => {
  test("a listagem da administração traz a ordem e, na raridade, a cor", () =>
    comRede(async (double) => {
      double.onJson("GET", "/api/games/magic/rarities", {
        data: [{ id: "mythic", ref: 4, name: "Mítica", active: false, sortOrder: 4, color: "copper" }],
      });

      const [mitica] = await listRaritiesForAdmin("magic");

      assertSame(mitica.sortOrder, 4);
      assertSame(mitica.color, "copper");
    }));

  test("a edição vem com a ordem e sem cor", () =>
    comRede(async (double) => {
      double.onJson("GET", "/api/games/magic/editions", { data: [{ ...ITENS.data[0], sortOrder: 2 }] });

      const [dominaria] = await listEditionsForAdmin("magic");

      assertSame(dominaria.sortOrder, 2);
      assertSame(dominaria.color, null);
    }));

  test("alterar raridade manda a cor e a ordem — o PUT é substituição", () =>
    comRede(async (double) => {
      double.on("PUT", "/api/rarities/4", { status: 204 });

      await updateRarity(4, { name: " Mítica ", sortOrder: 4, active: true, color: "copper" });

      const corpo = JSON.parse(double.lastCall.body);
      assertSame(corpo.name, "Mítica");
      assertSame(corpo.sortOrder, 4);
      assertSame(corpo.color, "copper");
    }));

  test("alterar edição não manda cor nenhuma", () =>
    comRede(async (double) => {
      double.on("PUT", "/api/editions/7", { status: 204 });

      await updateEdition(7, { name: "Dominaria", sortOrder: 1, active: true, color: "copper" });

      assertFalse("color" in JSON.parse(double.lastCall.body));
    }));

  test("criar raridade manda a cor escolhida", () =>
    comRede(async (double) => {
      double.onJson("POST", "/api/games/magic/rarities", { data: { id: 9 } }, 201);

      await createRarity("magic", { code: "epic", name: "Épica", sortOrder: 0, color: "tourmaline" });

      assertSame(JSON.parse(double.lastCall.body).color, "tourmaline");
    }));
});
