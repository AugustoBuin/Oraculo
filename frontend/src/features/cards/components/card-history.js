/**
 * O histórico de alterações da carta — quem, o quê e quando (RF-18).
 *
 * **Carregado sob demanda.** Fica dentro de um `<details>`, e a busca só sai
 * quando alguém abre: trazer a trilha de auditoria junto da tela de edição
 * seria pagar uma requisição que a maioria das edições não usa (§12.2).
 *
 * `<details>` também resolve o teclado de graça — abrir, fechar e o estado
 * anunciado vêm do elemento nativo (§9.1).
 */

import { ApiError, userMessage } from "@/shared/api/errors.js";
import { button } from "@/shared/components/button.js";
import { empty, failure, forbidden, loading } from "@/shared/components/feedback.js";
import { el } from "@/shared/dom/elements.js";
import { getCardHistory } from "@/features/cards/api/cards-api.js";

/** Os rótulos em português das ações que o backend registra. */
const ACTION_LABELS = {
  created: "Cadastrou",
  updated: "Alterou",
  deleted: "Excluiu",
  restored: "Restaurou",
};

/** Rótulos dos campos, para o histórico não falar em nome de coluna. */
const FIELD_LABELS = {
  nameEn: "Nome em inglês",
  namePt: "Nome em português",
  game: "Jogo",
  edition: "Edição",
  rarity: "Raridade",
  image: "Imagem",
};

/**
 * Data e hora por `Intl`.
 *
 * API nativa do navegador em vez de pacote (§8.6), e formatação por localidade
 * em vez de concatenação à mão — que erraria fuso, ordem e separador.
 */
const formatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatMoment(iso) {
  const date = new Date(iso);

  // Data inválida vira o texto cru em vez de "Invalid Date" na tela (§7.1).
  return Number.isNaN(date.getTime()) ? iso : formatter.format(date);
}

const presentValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "vazio";
  }

  return String(value);
};

function changeLines(changes) {
  const lines = [];

  for (const [fieldName, change] of Object.entries(changes)) {
    if (change === null || typeof change !== "object") {
      continue;
    }

    const label = FIELD_LABELS[fieldName] ?? fieldName;

    lines.push(
      el("li", {
        classes: ["cluster", "history-change"],
        children: [
          el("span", { text: label, classes: ["history-field"] }),
          // Os valores vêm do banco e vão por `textContent`, como todo dado do
          // catálogo (§8.3).
          el("span", {
            text: `${presentValue(change.from)} → ${presentValue(change.to)}`,
            classes: ["wrap-anywhere"],
          }),
        ],
      }),
    );
  }

  return lines;
}

function entryNode(entry) {
  const action = ACTION_LABELS[entry.action] ?? entry.action;
  const who = entry.userName ?? "Usuário removido";

  const children = [
    el("p", {
      classes: ["cluster", "cluster-baseline", "history-header"],
      children: [
        el("strong", { text: action }),
        el("span", { text: ` por ${who}` }),
        el("time", {
          text: formatMoment(entry.createdAt),
          attrs: { datetime: entry.createdAt },
          classes: ["text-muted"],
        }),
      ],
    }),
  ];

  const lines = changeLines(entry.changes);

  if (lines.length > 0) {
    children.push(el("ul", { classes: ["history-changes"], children: lines }));
  }

  return el("li", { classes: ["history-entry"], children });
}

/**
 * @param {{ cardId: number, scope: object }} config
 */
export function cardHistory({ cardId, scope }) {
  const body = el("div", { classes: ["history-body"] });
  let loaded = false;

  const details = el("details", {
    classes: ["history"],
    children: [
      el("summary", { text: "Histórico de alterações", classes: ["history-summary"] }),
      body,
    ],
  });

  async function load() {
    body.replaceChildren(loading("Carregando o histórico…"));

    const controller = new AbortController();
    scope.add(() => controller.abort());

    try {
      const entries = await getCardHistory(cardId, { signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      if (entries.length === 0) {
        // Carta sem histórico é estado vazio, não erro: pode ter sido criada
        // antes de a trilha existir.
        body.replaceChildren(
          empty({ title: "Sem alterações registradas para esta carta." }),
        );
        return;
      }

      body.replaceChildren(el("ol", { classes: ["history-list"], children: entries.map(entryNode) }));
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      // `403` não é falha: é nível insuficiente, e a tela diz isso sem
      // sugerir que algo quebrou (ADR-007).
      if (error instanceof ApiError && error.isForbidden) {
        body.replaceChildren(forbidden("Você não tem permissão para ver o histórico."));
        return;
      }

      body.replaceChildren(
        failure({
          message: userMessage(error),
          action: button({
            label: "Tentar novamente",
            variant: "secondary",
            scope,
            onClick: () => load(),
          }).node,
        }),
      );
    }
  }

  scope.on(details, "toggle", () => {
    if (details.open && !loaded) {
      loaded = true;
      load();
    }
  });

  return { node: details };
}
