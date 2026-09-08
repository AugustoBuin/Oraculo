/**
 * A visão em tabela.
 *
 * Existe porque quem trabalha em volume precisa comparar campos lado a lado —
 * a galeria obriga a percorrer cartão por cartão. A escolha é do usuário e é
 * lembrada (Decisão de UX nº 3 do PRD).
 */

import { el } from "@/shared/dom/elements.js";

const COLUMNS = [
  { key: "nameEn", label: "Nome (EN)" },
  { key: "namePt", label: "Nome (PT)" },
  { key: "game", label: "Jogo" },
  { key: "edition", label: "Edição" },
  { key: "rarity", label: "Raridade" },
];

const cellText = (card, key) => {
  if (key === "namePt") {
    // Ausência é ausência (RN-03), e um travessão diz isso melhor do que uma
    // célula vazia, que parece dado faltando por engano.
    return card.namePt ?? "—";
  }

  const value = card[key];

  return typeof value === "object" && value !== null ? value.name : value;
};

/**
 * @param {{ cards: object[], onOpen?: (id: number) => void, scope: object }} config
 */
export function cardTable({ cards, onOpen, onDelete, scope }) {
  const columns = onDelete === undefined
    ? COLUMNS
    : [...COLUMNS, { key: null, label: "Ações" }];

  const head = el("thead", {
    children: [
      el("tr", {
        children: columns.map((column) =>
          // `scope="col"` é o que faz o leitor de tela anunciar o cabeçalho
          // junto de cada célula. Sem ele a tabela vira uma lista de valores
          // soltos para quem não a enxerga (§9.1).
          el("th", { text: column.label, attrs: { scope: "col" } }),
        ),
      }),
    ],
  });

  const byId = new Map(cards.map((card) => [card.id, card]));

  const body = el("tbody", {
    children: cards.map((card) => {
      const cells = COLUMNS.map((column) => el("td", { text: cellText(card, column.key) }));

      if (onDelete !== undefined) {
        cells.push(
          el("td", {
            children: [
              el("button", {
                text: "Excluir",
                attrs: {
                  type: "button",
                  "data-action": "delete",
                  "aria-label": `Excluir ${card.nameEn}`,
                },
                classes: ["button", "button-danger", "card-delete"],
              }),
            ],
          }),
        );
      }

      return el("tr", {
        attrs: { "data-card-id": card.id, tabindex: "0" },
        classes: ["card-row"],
        children: cells,
      });
    }),
  });

  const table = el("table", {
    classes: ["card-table"],
    children: [
      el("caption", { text: "Cartas do catálogo", classes: ["sr-only"] }),
      head,
      body,
    ],
  });

  if (onOpen !== undefined || onDelete !== undefined) {
    const act = (target) => {
      const row = target.closest?.("[data-card-id]");
      const id = Number(row?.dataset.cardId);

      if (!Number.isInteger(id)) {
        return;
      }

      // Excluir vence abrir: sem isto, clicar em "Excluir" também navegaria
      // para a edição.
      if (target.closest?.('[data-action="delete"]') !== null) {
        onDelete?.(byId.get(id));
        return;
      }

      onOpen?.(id);
    };

    // Um listener no corpo da tabela, não um por linha (§12.3).
    scope.on(body, "click", (event) => act(event.target));

    // Tudo que se faz com o mouse se faz com o teclado (§9.2). A linha tem
    // `tabindex`, então Enter e Espaço precisam agir — é o que um `button`
    // nativo daria de graça e uma linha de tabela não dá. O botão de excluir
    // é nativo e já trata os dois, então o evento dele não chega aqui como
    // tecla da linha.
    scope.on(body, "keydown", (event) => {
      if (event.target.closest?.('[data-action="delete"]') !== null) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        act(event.target);
      }
    });
  }

  /*
   * A tabela rola no PRÓPRIO eixo; a página nunca rola na horizontal
   * (§10.5, RNF-04). `tabindex` no contêiner porque região rolável precisa ser
   * alcançável por teclado — sem ele, quem navega sem mouse não consegue ver
   * as colunas da direita.
   */
  return el("div", {
    classes: ["scroll-x", "card-table-wrapper"],
    attrs: { tabindex: "0", role: "region", "aria-label": "Tabela de cartas" },
    children: [table],
  });
}
