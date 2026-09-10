/**
 * O cartão da galeria.
 *
 * Carta é objeto visual: quem opera um catálogo reconhece pela arte antes de
 * ler o nome — é a Decisão de UX nº 3 do PRD, e o motivo de a galeria ser a
 * visão padrão.
 */

import { button } from "@/shared/components/button.js";
import { el } from "@/shared/dom/elements.js";

/**
 * A proporção de uma carta de TCG, em números.
 *
 * Vai nos atributos `width`/`height` para o navegador conhecer a proporção
 * **antes** de a imagem chegar. Sem isso a grade dá um salto a cada imagem que
 * carrega, e quem estava lendo perde a linha (§12.2).
 */
const CARD_WIDTH = 488;
const CARD_HEIGHT = 680;

/**
 * Espaço reservado legível.
 *
 * Nunca um ícone de imagem quebrada (RF-34). Mostra o nome, que é a informação
 * que a arte daria — quem procura a carta continua encontrando.
 */
function imagePlaceholder(card) {
  return el("div", {
    classes: ["card-image", "card-image-empty"],
    attrs: { role: "img", "aria-label": `Sem imagem para ${card.nameEn}` },
    children: [el("span", { text: card.nameEn, classes: ["card-image-empty-text"] })],
  });
}

/**
 * @param {object} card já normalizado por `parseCard`
 * @param {{ scope: object, canDelete?: boolean, canOpen?: boolean }} config
 */
export function cardTile(card, { scope, canDelete = false, canOpen = false }) {
  const media = el("div", { classes: ["card-media"] });

  if (card.imageUrl === null) {
    media.append(imagePlaceholder(card));
  } else {
    const image = el("img", {
      classes: ["card-image"],
      attrs: {
        // A URL já passou pela allowlist de esquema na borda (`parseCard`), e
        // `el()` recusaria de novo se não tivesse.
        src: card.imageUrl,
        // Decorativa: o nome está logo abaixo, em texto. Um `alt` repetindo o
        // nome faria o leitor de tela dizer a mesma coisa duas vezes (§9.5).
        alt: "",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        loading: "lazy",
        decoding: "async",
      },
    });

    // A imagem pode simplesmente não existir mais no endereço informado. Isso
    // é falha de recurso opcional: silenciosa para quem usa, e o espaço
    // reservado entra no lugar do ícone quebrado (§7.3, RF-34).
    scope.on(image, "error", () => image.replaceWith(imagePlaceholder(card)), { once: true });

    media.append(image);
  }

  const names = [
    // `textContent` sempre: nome de carta é dado editável, e o catálogo é
    // exatamente onde alguém digitaria `<script>` para ver o que acontece.
    //
    // `h2` porque o cartão é seção direta da página, e a página é dona do
    // `h1`. Um `h3` aqui pularia o nível intermediário: quem navega por
    // cabeçalhos ouve o salto como seção faltando e procura o que não existe.
    // O tamanho vem de `.card-name`, não do nível — trocar o nível não mexe
    // na aparência (§9.2).
    el("h2", { text: card.nameEn, classes: ["card-name"] }),
  ];

  if (card.namePt !== null) {
    names.push(el("p", { text: card.namePt, classes: ["card-name-pt"] }));
  }

  const body = [
    ...names,
    el("p", { text: card.game.name, classes: ["card-meta"] }),
    el("p", { text: card.edition.name, classes: ["card-meta"] }),
    el("span", { text: card.rarity.name, classes: ["badge"] }),
  ];

  if (canDelete) {
    /*
     * A ação é marcada por `data-action` e não recebe listener próprio: quem
     * escuta é a grade, com UM listener para todos os cartões (§12.3). Numa
     * listagem de volume, a diferença é entre um listener e mil.
     *
     * `button` nativo, não `div` clicável: Enter e Espaço vêm de graça.
     */
    body.push(
      el("button", {
        text: "Excluir",
        attrs: {
          type: "button",
          "data-action": "delete",
          // O nome vai no rótulo acessível porque "Excluir" repetido vinte
          // vezes na grade não diz a quem navega por áudio o que será
          // excluído (§9.3).
          "aria-label": `Excluir ${card.nameEn}`,
        },
        classes: ["button", "button-danger", "card-delete"],
      }),
    );
  }

  return el("article", {
    classes: ["card-tile"],
    attrs: {
      // Lido pela delegação de evento do contêiner: um listener para a grade
      // inteira, não um por cartão (§12.3).
      "data-card-id": card.id,
      /*
       * O cartão inteiro é o alvo de abrir, então o cartão inteiro precisa ser
       * alcançável sem mouse (§9.2) — a mesma decisão que a linha da tabela já
       * tomava. Sem isto, o Tab pulava de "Excluir" para "Excluir": a única
       * ação alcançável por teclado em cada carta era a destrutiva (OF-003).
       *
       * `tabindex` só quando há o que abrir. Parada de tabulação que não faz
       * nada é ruído: a pessoa para no cartão, aperta Enter e nada acontece.
       * O anel de foco vem da regra global de `:focus-visible` (base.css), não
       * de estilo próprio — cartão e linha de tabela devem parecer a mesma
       * coisa quando focados.
       */
      ...(canOpen ? { tabindex: "0" } : {}),
    },
    children: [media, el("div", { classes: ["card-body"], children: body })],
  });
}
