/**
 * O painel de catálogo: editar na própria linha, e a escrita com o registro
 * inteiro.
 *
 * A suíte nasceu de dois achados do plano das cores de raridade: a tela nunca
 * ofereceu o "editar" que RF-41 e RF-42 pedem, e reativar mandava
 * `sortOrder: 0` — a "Mítica" reativada pulava para o topo da cascata.
 *
 * O `api` é injetado pela página; passar um falso aqui é a mesma fiação que
 * `catalogs-page.js` faz (§13.3). O que está sob teste é o painel.
 */

import { catalogPanel } from "@/features/catalogs/components/catalog-panel.js";
import { rarityColorField } from "@/features/catalogs/components/rarity-color-field.js";
import { rarityBadge } from "@/shared/components/rarity-badge.js";
import { scope } from "@/shared/dom/events.js";
import { assertEquals, assertFalse, assertSame, assertTrue, suite, test } from "~/runner.js";

const APARENCIA = { field: rarityColorField, badge: rarityBadge };

const MITICA = { ref: 4, id: "mythic", name: "Mítica", active: true, sortOrder: 4, color: "copper" };
const ANTIGA = { ref: 5, id: "old", name: "Antiga", active: false, sortOrder: 5, color: "gold" };
const DOMINARIA = { ref: 9, id: "dom", name: "Dominaria", active: true, sortOrder: 1, color: null };

/** Uma volta da fila de tarefas, sem o estrangulamento do `setTimeout` em aba oculta. */
const assentar = () =>
  new Promise((resolve) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });

async function ate(condicao, voltas = 50) {
  for (let volta = 0; volta < voltas && !condicao(); volta++) {
    await assentar();
  }
}

function apiFalsa(itens) {
  const chamadas = { update: [], create: [] };

  return {
    chamadas,
    list: async () => itens,
    create: async (gameId, data) => {
      chamadas.create.push({ gameId, data });
    },
    update: async (ref, data) => {
      chamadas.update.push({ ref, data });
    },
    deactivate: async () => ({ wasInUse: false }),
  };
}

/** Monta o painel no documento (o foco só existe em nó conectado) e limpa tudo depois. */
async function comPainel({ itens, appearance, singular = "raridade" }, corpo) {
  const life = scope();
  const api = apiFalsa(itens);
  const painel = catalogPanel({
    title: "Catálogo",
    singular,
    gameId: "magic",
    scope: life,
    notify: () => {},
    api,
    appearance,
  });

  document.body.append(painel.node);

  try {
    await ate(() => painel.node.querySelectorAll(".catalog-row").length === itens.length);
    return await corpo({ node: painel.node, api });
  } finally {
    painel.node.remove();
    life.dispose();
  }
}

const porRotulo = (node, rotulo) => node.querySelector(`[aria-label="${rotulo}"]`);

async function abrirEdicao(node, nome) {
  porRotulo(node, `Editar ${nome}`).click();
  await ate(() => node.querySelector(".catalog-edit") !== null);

  return node.querySelector(".catalog-edit");
}

suite("features/catalogs/components/catalog-panel · editar na própria linha", () => {
  test("cada linha oferece Editar, com o nome no rótulo acessível", () =>
    comPainel({ itens: [MITICA, ANTIGA], appearance: APARENCIA }, ({ node }) => {
      assertTrue(porRotulo(node, "Editar Mítica") !== null, "a linha ativa não tem Editar");
      assertTrue(porRotulo(node, "Editar Antiga") !== null, "a linha desativada não tem Editar");
    }));

  test("Editar abre o formulário na linha, com o nome e a cor de agora, e o código travado", () =>
    comPainel({ itens: [MITICA], appearance: APARENCIA }, async ({ node }) => {
      const form = await abrirEdicao(node, "Mítica");

      assertSame(form.querySelector('input[type="text"]').value, "Mítica");
      assertSame(form.querySelector('input[type="radio"]:checked').value, "copper");
      assertTrue(form.textContent.includes("mythic"), "o código não aparece");
      assertFalse(
        [...form.querySelectorAll("input")].some((input) => input.value === "mythic"),
        "o código virou campo editável",
      );
      assertSame(document.activeElement, form.querySelector('input[type="text"]'));
    }));

  test("Salvar manda o registro inteiro: nome novo, ordem e estado de antes, cor escolhida", () =>
    comPainel({ itens: [MITICA], appearance: APARENCIA }, async ({ node, api }) => {
      const form = await abrirEdicao(node, "Mítica");

      form.querySelector('input[type="text"]').value = "Mítica Rara";
      form.querySelector('input[value="obsidian"]').click();
      form.requestSubmit();
      await ate(() => api.chamadas.update.length === 1);

      assertEquals(api.chamadas.update[0], {
        ref: 4,
        data: { name: "Mítica Rara", sortOrder: 4, active: true, color: "obsidian" },
      });
    }));

  test("nome em branco não chama a API e aponta o campo", () =>
    comPainel({ itens: [MITICA], appearance: APARENCIA }, async ({ node, api }) => {
      const form = await abrirEdicao(node, "Mítica");
      const nome = form.querySelector('input[type="text"]');

      nome.value = "   ";
      form.requestSubmit();
      await assentar();

      assertSame(api.chamadas.update.length, 0);
      assertSame(nome.getAttribute("aria-invalid"), "true");
    }));

  test("Cancelar fecha sem chamar a API, e o foco volta ao Editar da linha", () =>
    comPainel({ itens: [MITICA], appearance: APARENCIA }, async ({ node, api }) => {
      const form = await abrirEdicao(node, "Mítica");

      [...form.querySelectorAll("button")].find((botao) => botao.textContent === "Cancelar").click();
      await ate(() => node.querySelector(".catalog-edit") === null);

      assertSame(api.chamadas.update.length, 0);
      assertSame(document.activeElement, porRotulo(node, "Editar Mítica"));
    }));

  test("Esc também cancela", () =>
    comPainel({ itens: [MITICA], appearance: APARENCIA }, async ({ node }) => {
      const form = await abrirEdicao(node, "Mítica");

      form
        .querySelector('input[type="text"]')
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await ate(() => node.querySelector(".catalog-edit") === null);

      assertSame(node.querySelector(".catalog-edit"), null);
    }));
});

suite("features/catalogs/components/catalog-panel · a escrita leva o registro inteiro", () => {
  test("reativar manda a ordem e a cor que vieram da listagem", () =>
    comPainel({ itens: [ANTIGA], appearance: APARENCIA }, async ({ node, api }) => {
      porRotulo(node, "Reativar Antiga").click();
      await ate(() => api.chamadas.update.length === 1);

      assertEquals(api.chamadas.update[0].data, { name: "Antiga", sortOrder: 5, active: true, color: "gold" });
    }));

  test("criar raridade manda a cor escolhida no seletor", () =>
    comPainel({ itens: [MITICA], appearance: APARENCIA }, async ({ node, api }) => {
      const form = node.querySelector(".catalog-form");

      form.querySelector("#raridade-codigo").value = "epic";
      form.querySelector("#raridade-nome").value = "Épica";
      form.querySelector('input[value="tourmaline"]').click();
      form.requestSubmit();
      await ate(() => api.chamadas.create.length === 1);

      assertSame(api.chamadas.create[0].data.color, "tourmaline");
    }));

  test("a linha da raridade mostra o selo do material", () =>
    comPainel({ itens: [MITICA], appearance: APARENCIA }, ({ node }) => {
      assertTrue(
        node.querySelector(".catalog-row .rarity-badge.rarity-copper") !== null,
        "a linha não mostra o selo",
      );
    }));

  test("sem aparência, nada de cor: a edição não tem seletor nem selo", () =>
    comPainel({ itens: [DOMINARIA], singular: "edição" }, async ({ node }) => {
      assertSame(node.querySelector(".rarity-color-field"), null);

      const form = await abrirEdicao(node, "Dominaria");

      assertSame(form.querySelector(".rarity-color-field"), null);
      assertSame(node.querySelector(".rarity-badge"), null);
    }));
});
