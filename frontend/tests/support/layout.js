/**
 * A rede de segurança de geometria.
 *
 * O OF-004 — campo de imagem inutilizável no desktop — passou por três
 * auditorias `full` e por uma verificação em tela no mesmo dia. Nenhuma pegou,
 * porque ler CSS não mede nada e porque a amostra de larguras daquele dia não
 * **cruzava** o ponto de quebra onde o defeito vivia. Quem achou foi o autor,
 * usando a tela.
 *
 * Este módulo generaliza o que `image-field-layout.test.js` fez para um
 * componente só: montar um pedaço real da interface numa caixa de largura
 * conhecida e **medir**, em vez de conferir que a regra CSS foi escrita. A
 * página de testes carrega as mesmas quatro folhas da aplicação, então o que
 * se mede aqui é o CSS que roda em produção, não uma cópia dele.
 *
 * As três invariantes valem para toda tela e são o contrato de `withScreen`:
 *
 *   1. Nada é mais largo que o contêiner que o hospeda.
 *   2. Nenhuma coluna fica abaixo do mínimo utilizável — o sintoma medível é a
 *      palavra que não cabe inteira na própria caixa.
 *   3. Nada é cortado por uma caixa que esconde o excedente.
 *
 * **A rede é testada.** `layout-geometry.test.js` prova cada invariante contra
 * um caso sabidamente ruim, porque asserção que não consegue falhar passa em
 * tudo e não protege nada. A terceira invariante nasceu justamente assim: a
 * primeira versão comparava `scrollWidth` com `clientWidth` num elemento de
 * overflow visível, que por especificação devolve os dois iguais — ela nunca
 * teria acusado nada, e só o teste da própria rede mostrou isso.
 */

import { scope } from "@/shared/dom/events.js";

/**
 * As larguras de teste, em pixels de CSS.
 *
 * **Não são as extremas.** As extremas foi o que se mediu em 09/09 — 360, 500,
 * 752 e 1424 — e o defeito morava entre elas. Cada par abaixo cerca um ponto
 * de quebra do projeto (36rem = 576, 48rem = 768, 56rem = 896) por fora e por
 * dentro, que é a única amostragem que prova que o componente atravessa a
 * fronteira sem quebrar:
 *
 *   320  360        o piso e o celular comum
 *   544  608        cercam 36rem
 *   736  800        cercam 48rem
 *   864  928        cercam 56rem
 *   1200            a largura confortável de desktop
 */
export const LAYOUT_WIDTHS = [320, 360, 544, 608, 736, 800, 864, 928, 1200];

/**
 * A fonte da raiz dobrada — o critério do F-050, com uma ressalva registrada.
 *
 * O padrão do Chrome é 16px; dobrar a raiz faz toda medida em `rem` dobrar
 * junto, que é o essencial do teste.
 *
 * **O que isto NÃO reproduz:** `rem` dentro de uma `@media` é resolvido contra
 * o valor INICIAL da fonte da raiz, não contra o que a folha declarou. Mudar
 * `html { font-size }` por script move o conteúdo e deixa o ponto de quebra
 * parado; a fonte do navegador de verdade move os dois. A diferença deixa este
 * teste mais SEVERO que a realidade — ele mede o layout com o conteúdo dobrado
 * e a fronteira no lugar, que é exatamente o descasamento que o F-050 proíbe —
 * mas é por isso que ele não substitui a verificação em tela com a fonte do
 * navegador em 200%, e sim a antecipa.
 */
export const ROOT_FONT_DOUBLE = "32px";

/** Subpixel de arredondamento; abaixo disto não é estouro, é layout. */
const TOLERANCE = 0.5;

const px = (value) => `${Math.round(value)}px`;

/** O elemento rola no próprio eixo, então tem direito a conteúdo mais largo. */
function scrollsHorizontally(element) {
  const { overflowX } = getComputedStyle(element);

  return overflowX === "auto" || overflowX === "scroll";
}

/**
 * Sai do fluxo, então não é medido contra o contêiner.
 *
 * `fixed` mede contra a janela e `absolute` contra o ancestral posicionado —
 * o aviso e o link de pular conteúdo caem aqui.
 */
function outOfFlow(element) {
  const { position } = getComputedStyle(element);

  return position === "fixed" || position === "absolute";
}

function invisible(element) {
  const rect = element.getBoundingClientRect();

  return rect.width === 0 && rect.height === 0;
}

/** Um nome curto e reconhecível do elemento, para a mensagem da falha. */
function describe(element) {
  const name = String(element.className).trim();
  const classes = name === "" ? "" : `.${name.split(/\s+/).join(".")}`;

  return `${element.tagName.toLowerCase()}${classes}`;
}

/**
 * Percorre a árvore parando onde a medição deixa de fazer sentido.
 *
 * Um contêiner que rola no próprio eixo encerra o ramo: o que estiver dentro
 * dele pode ser mais largo de propósito — é o caso da tabela de cartas dentro
 * do `.scroll-x`, que é a promessa do RNF-04, não uma violação dela.
 */
function walk(root, visit) {
  for (const child of root.children) {
    if (invisible(child) || outOfFlow(child)) {
      continue;
    }

    visit(child);

    if (!scrollsHorizontally(child)) {
      walk(child, visit);
    }
  }
}

/** Invariante 1: nada ultrapassa a borda do contêiner. */
export function assertWithinContainer(host, context) {
  const limit = host.getBoundingClientRect().right;

  walk(host, (element) => {
    const { right } = element.getBoundingClientRect();

    if (right > limit + TOLERANCE) {
      throw new Error(
        `[${context}] ${describe(element)} passa ${px(right - limit)} da borda do contêiner`,
      );
    }
  });
}

/**
 * Invariante 2: toda palavra cabe inteira na caixa que a mostra.
 *
 * É a forma medível de "nenhuma coluna abaixo de um mínimo utilizável". Foi
 * assim que o OF-004 apareceu na tela: "Remover imagem" saindo uma letra por
 * linha, porque `overflow-wrap: anywhere` no `body` zerava a contribuição de
 * min-content de TODO texto e desligava a proteção natural do navegador contra
 * o colapso da coluna.
 *
 * A medida vem de um `Range` sobre o próprio nó de texto — a largura que o
 * navegador realmente pintou, não uma estimativa de fonte. Quem declara
 * `overflow-wrap: anywhere` está pedindo a quebra de propósito (URL, código,
 * dado do usuário) e por isso é pulado: a invariante existe para achar quem
 * NÃO pediu.
 */
export function assertWholeWords(host, context) {
  const check = (element) => {
    const style = getComputedStyle(element);

    if (
      style.whiteSpace === "nowrap" ||
      style.whiteSpace === "pre" ||
      style.overflowWrap === "anywhere" ||
      style.wordBreak === "break-all" ||
      element.clientWidth === 0
    ) {
      return;
    }

    const available =
      element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) {
        continue;
      }

      const range = document.createRange();
      const words = /\S+/g;
      let match = words.exec(node.data);

      while (match !== null) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);

        const width = range.getBoundingClientRect().width;

        if (width > available + TOLERANCE) {
          throw new Error(
            `[${context}] "${match[0]}" mede ${px(width)} e ${describe(element)} oferece ${px(available)}`,
          );
        }

        match = words.exec(node.data);
      }
    }
  };

  check(host);
  walk(host, check);
}

/**
 * Invariante 3: nada é CORTADO por um contêiner que esconde o excedente.
 *
 * É a outra metade da promessa do RNF-04. `body { overflow-x: hidden }` mantém
 * a página sem rolagem horizontal, mas o preço de manter é que o que passar da
 * borda **some** — perda de conteúdo, não inconveniência (WCAG 1.4.4). O mesmo
 * vale para qualquer caixa com `overflow: hidden` no caminho.
 *
 * Só `hidden` e `clip` entram: `auto` e `scroll` mostram o excedente rolando,
 * que é a saída legítima da tabela de cartas. E quem recorta de propósito para
 * leitor de tela (`.sr-only`, com `clip-path`) sai da conta — o recorte é o
 * objetivo dele.
 *
 * A primeira invariante mede o que passa da borda de FORA; esta mede o que
 * desaparece DENTRO. Uma não pega o caso da outra.
 */
export function assertNothingClipped(host, context) {
  const check = (element) => {
    /*
     * Controle nativo cuida do próprio excedente.
     *
     * `<input type="file">` com a fonte em 200% desenha o botão e o nome do
     * arquivo mais largos que a coluna e recorta o que passa — mas o conteúdo
     * continua alcançável pelo cursor, e o campo de imagem ainda repete o nome
     * do arquivo na linha de status abaixo. Medir isto como perda de conteúdo
     * acusaria o navegador, não o nosso layout.
     */
    if (["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName)) {
      return;
    }

    const style = getComputedStyle(element);

    if (
      (style.overflowX !== "hidden" && style.overflowX !== "clip") ||
      style.clipPath !== "none"
    ) {
      return;
    }

    if (element.scrollWidth > element.clientWidth + TOLERANCE) {
      throw new Error(
        `[${context}] ${describe(element)} corta ${px(element.scrollWidth - element.clientWidth)} do próprio conteúdo`,
      );
    }
  };

  check(host);
  walk(host, check);
}

export function assertLayoutInvariants(host, context) {
  assertWithinContainer(host, context);
  assertWholeWords(host, context);
  assertNothingClipped(host, context);
}

/**
 * Monta um pedaço da interface numa caixa de largura conhecida e mede.
 *
 * A caixa vai direto no `body` para não herdar a `.container` da página de
 * testes — a largura pedida precisa ser a largura de verdade, senão a amostra
 * mede outra coisa.
 *
 * `mount` recebe `{ scope, host }` e devolve o nó (ou `{ node }`); pode ser
 * assíncrono, que é o que permite esperar uma imagem carregar antes de medir.
 * As invariantes rodam sozinhas, antes do corpo do teste: quem chama só
 * acrescenta a medida específica daquela tela.
 */
export async function withScreen(
  { width, rootFontSize = null, mount, label = "" },
  body = () => {},
) {
  const life = scope();
  const host = document.createElement("div");
  const root = document.documentElement;
  const previousFont = root.style.fontSize;

  host.style.width = `${width}px`;
  document.body.append(host);

  if (rootFontSize !== null) {
    root.style.fontSize = rootFontSize;
  }

  const context = [label, `${width}px`, rootFontSize === null ? "" : `fonte ${rootFontSize}`]
    .filter((part) => part !== "")
    .join(" · ");

  try {
    const mounted = await mount({ scope: life, host });
    const node = mounted instanceof Node ? mounted : (mounted?.node ?? null);

    if (node !== null && node.parentNode === null) {
      host.append(node);
    }

    assertLayoutInvariants(host, context);

    return await body({ host, width, context });
  } finally {
    // A fonte da raiz é global: deixá-la dobrada contaminaria toda suíte que
    // rodasse depois, e o teste seguinte falharia por um motivo que não é dele.
    root.style.fontSize = previousFont;
    life.dispose();
    host.remove();
  }
}

/**
 * A mesma tela em todas as larguras que cruzam os pontos de quebra.
 *
 * Roda também com a fonte da raiz dobrada: `rem` escala junto, e o par
 * "largura × fonte" é o que o F-050 exige e o que a amostra de 09/09 não
 * cobriu.
 */
export async function acrossWidths({ mount, label, widths = LAYOUT_WIDTHS }, body = () => {}) {
  for (const width of widths) {
    await withScreen({ width, mount, label }, body);
    await withScreen({ width, mount, label, rootFontSize: ROOT_FONT_DOUBLE }, body);
  }
}
