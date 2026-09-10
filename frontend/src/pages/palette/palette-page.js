/**
 * A paleta, mostrada.
 *
 * Tela de avaliação do design, fora do menu: chega-se a ela pelo endereço
 * (`ROUTES.palette`). Mostra o que o `tokens.css` carregado declara agora —
 * mudou um token, recarregou, está aqui — e mede o contraste de cada par na
 * hora, com os mesmos pares da tabela do `docs/design.md` §3.
 *
 * Os dois temas aparecem juntos porque avaliar paleta é comparar: uma cor que
 * funciona no claro e some no escuro só aparece com os dois à vista.
 */

import { empty } from "@/shared/components/feedback.js";
import { el } from "@/shared/dom/elements.js";
import { scope } from "@/shared/dom/events.js";
import {
  collectTokens,
  contrastPairs,
  contrastRatio,
  readTokenRules,
  resolveColor,
} from "@/shared/theme/palette.js";

const THEMES = [
  { key: "light", label: "Claro" },
  { key: "dark", label: "Escuro" },
];

const ratioFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const minimumFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const shortName = (name) => name.replace("--color-", "");

/**
 * Pinta um nó com o valor de um token.
 *
 * CSSOM, e não o atributo `style` — que `el()` recusa e a CSP barraria. A
 * regra do §10.1 existe para nenhum valor visual nascer fora do `tokens.css`,
 * e aqui nenhum nasce: o que se pinta é o próprio token, lido do arquivo. É o
 * mesmo caminho que o modal já usa.
 */
function paint(node, declarations) {
  for (const [property, value] of Object.entries(declarations)) {
    node.style.setProperty(property, value);
  }

  return node;
}

const swatch = (value) =>
  paint(el("span", { classes: ["palette-swatch"], attrs: { "aria-hidden": "true" } }), {
    "background-color": value,
  });

function table(caption, headings, rows) {
  return el("div", {
    classes: ["scroll-x"],
    children: [
      el("table", {
        classes: ["palette-table"],
        children: [
          el("caption", { text: caption, classes: ["sr-only"] }),
          el("thead", {
            children: [
              el("tr", {
                children: headings.map((text) => el("th", { text, attrs: { scope: "col" } })),
              }),
            ],
          }),
          el("tbody", { children: rows }),
        ],
      }),
    ],
  });
}

function colorsSection(tokens) {
  const rows = tokens.map((token) =>
    el("tr", {
      children: [
        el("th", { attrs: { scope: "row" }, children: [el("code", { text: token.name })] }),
        ...THEMES.map(({ key }) =>
          el("td", { children: [swatch(token[key]), el("code", { text: token[key] })] }),
        ),
      ],
    }),
  );

  return el("section", {
    classes: ["card", "stack"],
    attrs: { "aria-labelledby": "paleta-cores" },
    children: [
      el("h2", { text: "Cores", attrs: { id: "paleta-cores" } }),
      table("Tokens de cor nos dois temas", ["Token", ...THEMES.map(({ label }) => label)], rows),
    ],
  });
}

/** Cada par em cada tema, com a razão já calculada — ou nula, se não mede. */
function measure(tokens) {
  const byName = new Map(tokens.map((token) => [token.name, token]));

  return contrastPairs(tokens.map((token) => token.name)).map((pair) => ({
    ...pair,
    results: THEMES.map(({ key, label }) => {
      const fg = byName.get(pair.fg)[key];
      const bg = byName.get(pair.bg)[key];
      const fgRgb = resolveColor(fg);
      const bgRgb = resolveColor(bg);

      return {
        theme: label,
        fg,
        bg,
        ratio: fgRgb !== null && bgRgb !== null ? contrastRatio(fgRgb, bgRgb) : null,
      };
    }),
  }));
}

/**
 * A linha que responde "a paleta passa?" sem ler a tabela inteira.
 *
 * O pior par é o de MENOR FOLGA sobre o próprio piso, e não o de menor razão:
 * o foco a 3,5:1 passa com folga, e um texto a 4,6:1 está por um fio.
 */
function summary(measurements) {
  const results = measurements.flatMap((pair) =>
    pair.results
      .filter((result) => result.ratio !== null)
      .map((result) => ({ ...result, pair, margin: result.ratio / pair.min })),
  );

  const failing = results.filter((result) => result.ratio < result.pair.min);
  const worst = results.reduce((a, b) => (b.margin < a.margin ? b : a), results[0]);

  const parts = [`${results.length} medidas`];

  if (worst !== undefined) {
    parts.push(
      `menor folga: ${shortName(worst.pair.fg)} sobre ${shortName(worst.pair.bg)}, ` +
        `${worst.theme.toLowerCase()}, ${ratioFormat.format(worst.ratio)}:1`,
    );
  }

  parts.push(failing.length === 0 ? "nenhuma reprova" : `${failing.length} reprovam`);

  return el("p", {
    text: parts.join(" — "),
    classes: failing.length === 0 ? ["text-ink"] : ["palette-verdict-fail"],
  });
}

function verdict(ratio, min) {
  if (ratio === null) {
    return el("span", { text: "não medido", classes: ["palette-verdict", "palette-verdict-none"] });
  }

  // Dois sinais: a palavra diz o resultado, a cor só reforça (§9.4).
  const passes = ratio >= min;

  return el("span", {
    text: passes ? "passa" : "reprova",
    classes: ["palette-verdict", passes ? "palette-verdict-pass" : "palette-verdict-fail"],
  });
}

function contrastSection(tokens) {
  const measurements = measure(tokens);

  const rows = measurements.map((pair) =>
    el("tr", {
      children: [
        el("th", {
          attrs: { scope: "row" },
          children: [
            el("code", { text: shortName(pair.fg) }),
            el("span", { text: " sobre " }),
            el("code", { text: shortName(pair.bg) }),
          ],
        }),
        el("td", { text: `${minimumFormat.format(pair.min)}:1` }),
        ...pair.results.map((result) =>
          el("td", {
            children: [
              paint(
                el("span", {
                  text: "Aa",
                  classes: ["palette-sample"],
                  attrs: { "aria-hidden": "true" },
                }),
                { color: result.fg, "background-color": result.bg },
              ),
              el("span", {
                text: result.ratio === null ? "—" : `${ratioFormat.format(result.ratio)}:1`,
              }),
              verdict(result.ratio, pair.min),
            ],
          }),
        ),
      ],
    }),
  );

  return el("section", {
    classes: ["card", "stack"],
    attrs: { "aria-labelledby": "paleta-contraste" },
    children: [
      el("h2", { text: "Contraste", attrs: { id: "paleta-contraste" } }),
      summary(measurements),
      el("p", {
        text: "Texto pede 4,5:1; o anel de foco, 3:1. Os pares são os da tabela do docs/design.md §3.",
        classes: ["text-muted"],
      }),
      table(
        "Contraste de cada par nos dois temas",
        ["Par", "Mínimo", ...THEMES.map(({ label }) => label)],
        rows,
      ),
    ],
  });
}

/**
 * Raio e sombra, desenhados.
 *
 * A sombra aparece sobre o fundo e a superfície de cada tema, porque é assim
 * que ela existe: a mesma sombra que se lê no claro pode sumir no escuro.
 */
function shapesSection(rules, colors) {
  const color = (name, key) => colors.find((token) => token.name === name)?.[key] ?? "";

  const radii = collectTokens(rules, "--radius-").map((token) =>
    el("figure", {
      classes: ["palette-shape-item"],
      children: [
        paint(el("div", { classes: ["palette-shape", "palette-radius"] }), {
          "border-radius": token.light,
        }),
        el("figcaption", {
          children: [el("code", { text: token.name }), el("span", { text: ` ${token.light}` })],
        }),
      ],
    }),
  );

  const shadows = collectTokens(rules, "--shadow-").flatMap((token) =>
    THEMES.map(({ key, label }) => {
      // Superfície e linha do tema DESTA amostra, não do tema em uso: é a
      // sombra de um cartão escuro sobre fundo escuro que se quer ver.
      const box = paint(el("div", { classes: ["palette-shape"] }), {
        "background-color": color("--color-surface", key),
        "border-color": color("--color-line", key),
        "box-shadow": token[key],
      });

      return el("figure", {
        classes: ["palette-shape-item"],
        children: [
          paint(el("div", { classes: ["palette-stage"], children: [box] }), {
            "background-color": color("--color-bg", key),
          }),
          el("figcaption", {
            children: [el("code", { text: token.name }), el("span", { text: ` · ${label}` })],
          }),
        ],
      });
    }),
  );

  return el("section", {
    classes: ["card", "stack"],
    attrs: { "aria-labelledby": "paleta-formas" },
    children: [
      el("h2", { text: "Raio e sombra", attrs: { id: "paleta-formas" } }),
      el("div", { classes: ["cluster", "palette-shapes"], children: [...radii, ...shadows] }),
    ],
  });
}

/**
 * @param {HTMLElement} root
 * @returns {() => void}
 */
export function palettePage(root) {
  const life = scope();
  const rules = readTokenRules(document.styleSheets);
  const colors = collectTokens(rules, "--color-");

  const header = [
    el("h1", { text: "Paleta" }),
    el("p", {
      text:
        "Lida do tokens.css que o navegador carregou agora, com os dois temas lado a lado. " +
        "Mudou um token, recarregou, está aqui.",
      classes: ["text-muted"],
    }),
  ];

  root.replaceChildren(
    el("div", {
      classes: ["stack-loose"],
      children:
        colors.length === 0
          ? [
              ...header,
              empty({
                title: "Nenhum token de cor encontrado.",
                description: "A folha tokens.css não foi carregada, ou não declara --color-*.",
              }),
            ]
          : [
              ...header,
              colorsSection(colors),
              contrastSection(colors),
              shapesSection(rules, colors),
            ],
    }),
  );

  return () => life.dispose();
}
