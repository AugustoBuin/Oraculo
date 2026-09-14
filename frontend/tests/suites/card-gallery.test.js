/**
 * A grade de cartas.
 *
 * A suíte nasceu do OF-003, achado pela auditoria final de 09/09 e confirmado
 * na tela: na galeria — a visão PADRÃO da listagem — o cartão não era focável e
 * a grade só escutava `click`. Tabulando a partir da busca, o foco ia do
 * "Excluir" de uma carta direto ao "Excluir" da seguinte, sem parar no cartão.
 *
 * O recorte é o que torna o defeito grave: quem usa só o teclado alcançava a
 * ação DESTRUTIVA de toda carta e não alcançava carta nenhuma. Dava para
 * excluir tudo sem mouse e não dava para abrir nada.
 *
 * A visão tabela já resolvia isso (`card-table.js`): `tabindex` na linha e um
 * `keydown` no contêiner. Aqui a grade passa a fazer o mesmo, e estes testes
 * fixam o comportamento nos dois lados — o que abre e o que não pode abrir.
 */

import { cardGallery } from "@/features/cards/components/card-gallery.js";
import { scope } from "@/shared/dom/events.js";
import { assertCount, assertSame, assertTrue, suite, test } from "~/runner.js";

/** Duas cartas já normalizadas por `parseCard`, no formato que a grade consome. */
function cartas() {
  return [
    {
      id: 7,
      nameEn: "Blue-Eyes White Dragon",
      namePt: "Dragão Branco de Olhos Azuis",
      imageUrl: null,
      game: { name: "Yu-Gi-Oh!" },
      edition: { name: "Legend of Blue Eyes" },
      rarity: { name: "Secreta" },
    },
    {
      id: 9,
      nameEn: "Dark Magician",
      namePt: null,
      imageUrl: null,
      game: { name: "Yu-Gi-Oh!" },
      edition: { name: "Metal Raiders" },
      rarity: { name: "Rara" },
    },
  ];
}

/**
 * Monta a grade, entrega ao corpo do teste e encerra o escopo no fim — inclusive
 * quando o teste falha, que é quando o vazamento passaria despercebido.
 */
function comGrade(body, { canDelete = true } = {}) {
  const life = scope();
  const abertas = [];
  const excluidas = [];

  try {
    const grid = cardGallery({
      cards: cartas(),
      onOpen: (id) => abertas.push(id),
      onDelete: canDelete ? (card) => excluidas.push(card.id) : undefined,
      scope: life,
    });

    return body({ grid, abertas, excluidas });
  } finally {
    life.dispose();
  }
}

/** Dispara uma tecla de verdade, que sobe até o listener da grade. */
function teclar(target, key) {
  const evento = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(evento);
  return evento;
}

suite("features/cards/components/card-gallery · o cartão alcançável por teclado", () => {
  test("o cartão é focável — sem isso o Tab pula direto para o Excluir seguinte", () =>
    comGrade(({ grid }) => {
      const tiles = grid.querySelectorAll("[data-card-id]");

      assertCount(tiles, 2);

      for (const tile of tiles) {
        assertSame(tile.getAttribute("tabindex"), "0");
      }
    }));

  test("Enter no cartão abre a carta", () =>
    comGrade(({ grid, abertas }) => {
      teclar(grid.querySelector('[data-card-id="9"]'), "Enter");

      assertSame(abertas.length, 1);
      assertSame(abertas[0], 9);
    }));

  test("Espaço no cartão abre a carta", () =>
    comGrade(({ grid, abertas }) => {
      teclar(grid.querySelector('[data-card-id="7"]'), " ");

      assertSame(abertas.length, 1);
      assertSame(abertas[0], 7);
    }));

  test("Espaço no cartão não rola a página — o evento é cancelado", () =>
    comGrade(({ grid }) => {
      const evento = teclar(grid.querySelector('[data-card-id="7"]'), " ");

      assertTrue(evento.defaultPrevented);
    }));

  test("tecla qualquer no cartão não abre nada — só Enter e Espaço agem", () =>
    comGrade(({ grid, abertas }) => {
      teclar(grid.querySelector('[data-card-id="7"]'), "a");
      teclar(grid.querySelector('[data-card-id="7"]'), "ArrowDown");

      assertCount(abertas, 0);
    }));
});

suite("features/cards/components/card-gallery · excluir vence abrir", () => {
  test("Enter no botão de excluir não abre a carta", () =>
    comGrade(({ grid, abertas }) => {
      /*
       * O botão é nativo: o navegador de verdade traduz Enter em `click`, e é
       * o `click` que exclui. O que se fixa aqui é o outro lado — que a tecla
       * NÃO seja lida também como "abrir", o que faria uma exclusão navegar
       * para a edição da carta que se quer excluir.
       */
      teclar(grid.querySelector('[data-card-id="9"] [data-action="delete"]'), "Enter");

      assertCount(abertas, 0);
    }));

  test("clicar em excluir continua excluindo, e não abre", () =>
    comGrade(({ grid, abertas, excluidas }) => {
      grid
        .querySelector('[data-card-id="9"] [data-action="delete"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

      assertSame(excluidas.length, 1);
      assertSame(excluidas[0], 9);
      assertCount(abertas, 0);
    }));

  test("clicar no cartão continua abrindo — o mouse não regrediu", () =>
    comGrade(({ grid, abertas }) => {
      grid
        .querySelector('[data-card-id="7"] .card-name')
        .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

      assertSame(abertas.length, 1);
      assertSame(abertas[0], 7);
    }));
});

suite("features/cards/components/card-gallery · a grade sem abrir", () => {
  /*
   * Parada de tabulação que não faz nada é ruído para quem navega por teclado:
   * a pessoa para no cartão, aperta Enter e não acontece nada. Por isso o
   * `tabindex` acompanha `onOpen`, e não a mera existência do cartão.
   */
  function semAbrir(config) {
    const life = scope();

    try {
      const grid = cardGallery({ cards: cartas(), scope: life, ...config });

      for (const tile of grid.querySelectorAll("[data-card-id]")) {
        assertSame(tile.getAttribute("tabindex"), null);
      }
    } finally {
      life.dispose();
    }
  }

  test("grade só de leitura não tem cartão focável — não há o que operar", () => semAbrir({}));

  test("grade que só exclui também não — o botão de excluir já é focável sozinho", () =>
    semAbrir({ onDelete: () => {} }));
});
