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
export function cardTable({ cards, onOpen, scope }) {
  const head = el("thead", {
    children: [
      el("tr", {
        children: COLUMNS.map((column) =>
          // `scope="col"` é o que faz o leitor de tela anunciar o cabeçalho
          // junto de cada célula. Sem ele a tabela vira uma lista de valores
          // soltos para quem não a enxerga (§9.1).
          el("th", { text: column.label, attrs: { scope: "col" } }),
        ),
      }),
    ],
  });

  const body = el("tbody", {
    children: cards.map((card) =>
      el("tr", {
        attrs: { "data-card-id": card.id, tabindex: "0" },
        classes: ["card-row"],
        children: COLUMNS.map((column) =>
          el("td", { text: cellText(card, column.key) }),
        ),
      }),
    ),
  });

  const table = el("table", {
    classes: ["card-table"],
    children: [
      el("caption", { text: "Cartas do catálogo", classes: ["sr-only"] }),
      head,
      body,
    ],
  });

  if (onOpen !== undefined) {
    const open = (target) => {
      const row = target.closest?.("[data-card-id]");
      const id = Number(row?.dataset.cardId);

      if (Number.isInteger(id)) {
        onOpen(id);
      }
    };

    // Um listener no corpo da tabela, não um por linha (§12.3).
    scope.on(body, "click", (event) => open(event.target));

    // Tudo que se faz com o mouse se faz com o teclado (§9.2). A linha tem
    // `tabindex`, então Enter e Espaço precisam abrir — é o que um `button`
    // nativo daria de graça e uma linha de tabela não dá.
    scope.on(body, "keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(event.target);
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
