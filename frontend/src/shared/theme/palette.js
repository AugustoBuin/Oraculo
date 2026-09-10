/**
 * A paleta como o `tokens.css` a declara agora, e o contraste de cada par.
 *
 * Existe para a tela `/paleta`, que serve para avaliar mudança de cor sem
 * refazer conta à mão. Duas garantias fazem ela valer alguma coisa:
 *
 * - **Os tokens são lidos da folha carregada, não de uma lista.** Uma lista
 *   escrita à mão mentiria na primeira cor acrescentada ou renomeada — e uma
 *   informação falsa é pior que a falta dela.
 * - **O contraste é o da WCAG 2.x, com os mesmos pares da tabela do
 *   `docs/design.md` §3.** Se a tela e a tabela discordassem, uma das duas
 *   estaria errada.
 */

/** Piso de contraste para texto (WCAG 1.4.3). */
const TEXT_MINIMUM = 4.5;

/** Piso para componente de interface, como o anel de foco (WCAG 1.4.11). */
const COMPONENT_MINIMUM = 3;

const LIGHT_SELECTOR = ":root";

/*
 * O escuro é lido só da regra explícita. `tokens.css` o declara também sob
 * `prefers-color-scheme`, com os mesmos valores — ler as duas faria uma
 * divergência futura entre elas aparecer como token duplicado, em vez de
 * aparecer como o erro que é.
 */
const DARK_SELECTOR = ':root[data-theme="dark"]';

/** Luminância relativa, sobre sRGB de 8 bits, como a WCAG define. */
function relativeLuminance([red, green, blue]) {
  const channel = (value) => {
    const c = value / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/**
 * A razão de contraste entre duas cores em `[r, g, b]`, de 1 a 21.
 *
 * A ordem não importa: a fórmula põe sempre a mais clara em cima.
 */
export function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );

  return (lighter + 0.05) / (darker + 0.05);
}

let paintContext = null;

function context() {
  if (paintContext === null) {
    const canvas = document.createElement("canvas");

    canvas.width = 1;
    canvas.height = 1;
    paintContext = canvas.getContext("2d", { willReadFrequently: true });
  }

  return paintContext;
}

/**
 * Converte qualquer cor que o navegador entenda em `[r, g, b]`.
 *
 * Quem interpreta a cor é o próprio navegador, pintando um pixel: hexadecimal,
 * `rgb()`, `hsl()` e `oklch()` saem do mesmo caminho, sem um parser escrito
 * aqui para cada sintaxe — `oklch()` é para onde uma paleta nova tende a ir.
 *
 * Devolve `null` para o que não dá para medir com honestidade: valor que não
 * é cor, referência a outro token (`var()` passa em `CSS.supports`, mas o
 * canvas não a resolve e manteria em silêncio a cor anterior) e cor com
 * transparência, cujo contraste depende do que estiver atrás dela.
 */
export function resolveColor(value) {
  if (typeof value !== "string") {
    return null;
  }

  const color = value.trim();

  if (color === "" || color.includes("var(") || !CSS.supports("color", color)) {
    return null;
  }

  const paint = context();

  paint.clearRect(0, 0, 1, 1);
  paint.fillStyle = color;
  paint.fillRect(0, 0, 1, 1);

  const [red, green, blue, alpha] = paint.getImageData(0, 0, 1, 1).data;

  return alpha === 255 ? [red, green, blue] : null;
}

/**
 * As regras de token das folhas carregadas, em forma de dado simples.
 *
 * Só regra de estilo de primeiro nível entra: o bloco `@media` da preferência
 * do sistema fica de fora de propósito (ver `DARK_SELECTOR`). Folha de outra
 * origem lança ao ler `cssRules` e é pulada — não existe nenhuma hoje, e a
 * tela não deve cair se um dia existir.
 *
 * @param {StyleSheetList | CSSStyleSheet[]} styleSheets
 * @returns {Array<{ selector: string, declarations: Array<[string, string]> }>}
 */
export function readTokenRules(styleSheets) {
  const rules = [];

  for (const sheet of Array.from(styleSheets)) {
    let cssRules;

    try {
      cssRules = sheet.cssRules;
    } catch {
      continue;
    }

    for (const rule of Array.from(cssRules)) {
      if (!(rule instanceof CSSStyleRule)) {
        continue;
      }

      const declarations = Array.from(rule.style)
        .filter((name) => name.startsWith("--"))
        .map((name) => [name, rule.style.getPropertyValue(name).trim()]);

      if (declarations.length > 0) {
        rules.push({ selector: rule.selectorText, declarations });
      }
    }
  }

  return rules;
}

/**
 * Os tokens com o prefixo pedido, com o valor claro e o escuro lado a lado.
 *
 * A ordem é a da declaração no tema claro, que é a ordem em que o arquivo
 * agrupa os papéis. Token sem valor no escuro herda o do claro, exatamente
 * como a cascata faz na tela.
 *
 * @returns {Array<{ name: string, light: string, dark: string }>}
 */
export function collectTokens(rules, prefix) {
  const light = new Map();
  const dark = new Map();

  for (const { selector, declarations } of rules) {
    const target =
      selector === LIGHT_SELECTOR ? light : selector === DARK_SELECTOR ? dark : null;

    if (target === null) {
      continue;
    }

    for (const [name, value] of declarations) {
      if (name.startsWith(prefix)) {
        target.set(name, value);
      }
    }
  }

  return [...light.keys()].map((name) => ({
    name,
    light: light.get(name),
    dark: dark.get(name) ?? light.get(name),
  }));
}

/**
 * Os pares a medir, tirados dos nomes dos tokens — a mesma regra que produziu
 * a tabela do `docs/design.md` §3:
 *
 * - toda **tinta** é medida sobre cada **superfície** (`--color-bg` e o que
 *   começa com `--color-surface`);
 * - a tinta de uma superfície de ação (`--color-on-X`) é medida sobre ela;
 * - cada cor é medida sobre a própria versão suave (`--color-X-soft`);
 * - **componente** — o anel de foco e a borda de controle (`--color-border`)
 *   — é medido sobre as superfícies a 3:1, que é o piso da WCAG 1.4.11 para o
 *   que identifica um controle, e não o de texto.
 *
 * A linha (`--color-line`) não entra: é decorativa — divisória, borda de
 * cartão —, e não identifica controle nenhum. É tinta quem não é superfície,
 * versão suave, tinta de ação, linha nem componente. A convenção de nome é o
 * que permite a um token novo entrar na conta sozinho.
 *
 * @param {string[]} names
 * @returns {Array<{ fg: string, bg: string, min: number }>}
 */
export function contrastPairs(names) {
  const declared = new Set(names);
  const isSurface = (name) => name === "--color-bg" || name.startsWith("--color-surface");
  const isComponent = (name) => name === "--color-focus" || name.startsWith("--color-border");
  const isInk = (name) =>
    !isSurface(name) &&
    !isComponent(name) &&
    !name.endsWith("-soft") &&
    !name.startsWith("--color-on-") &&
    name !== "--color-line";

  const surfaces = names.filter(isSurface);
  const pairs = [];

  for (const name of names.filter(isInk)) {
    for (const surface of surfaces) {
      pairs.push({ fg: name, bg: surface, min: TEXT_MINIMUM });
    }

    const soft = `${name}-soft`;

    if (declared.has(soft)) {
      pairs.push({ fg: name, bg: soft, min: TEXT_MINIMUM });
    }

    const ink = name.replace("--color-", "--color-on-");

    if (declared.has(ink)) {
      pairs.push({ fg: ink, bg: name, min: TEXT_MINIMUM });
    }
  }

  for (const name of names.filter(isComponent)) {
    for (const surface of surfaces) {
      pairs.push({ fg: name, bg: surface, min: COMPONENT_MINIMUM });
    }
  }

  return pairs;
}
