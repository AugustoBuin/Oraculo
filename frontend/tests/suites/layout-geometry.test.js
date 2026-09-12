/**
 * A geometria das telas principais, medida.
 *
 * Esta suíte existe por causa da lição do OF-004: **amostrar larguras não
 * basta se a amostra não cruza os pontos de quebra**, e ler o CSS não pega
 * nada disso. As três invariantes de `support/layout.js` rodam para cada tela
 * em nove larguras que cercam cada ponto de quebra por fora e por dentro, e em
 * cada uma delas duas vezes: com a fonte do navegador normal e a 200%.
 *
 * **O recorte de cada teste é a caixa, não a janela.** Cada tela é montada
 * dentro de um contêiner de largura conhecida enquanto a janela do navegador
 * continua larga — que é a situação real de todo componente deste projeto: o
 * formulário vive numa coluna de 40rem, os cartões da conta vivem em metade da
 * página, e o painel de catálogo vive em metade disso. Uma `@media` de viewport
 * responde à janela e erra as três; é essa diferença que os testes medem.
 */

import { cardGallery } from "@/features/cards/components/card-gallery.js";
import { cardHistory } from "@/features/cards/components/card-history.js";
import { cardImageField } from "@/features/cards/components/card-image-field.js";
import { cardTable } from "@/features/cards/components/card-table.js";
import { empty } from "@/shared/components/feedback.js";
import { deleteCardPreview } from "@/features/cards/components/delete-card-dialog.js";
import { catalogPanel } from "@/features/catalogs/components/catalog-panel.js";
import { rarityColorField } from "@/features/catalogs/components/rarity-color-field.js";
import { invalidateCatalogs } from "@/features/catalogs/api/catalogs-api.js";
import { changePasswordForm } from "@/features/auth/components/change-password-form.js";
import { readCardQuery } from "@/features/cards/utils/card-query.js";
import { appHeader } from "@/shared/components/app-header.js";
import { button } from "@/shared/components/button.js";
import { pagination } from "@/shared/components/pagination.js";
import { rarityBadge } from "@/shared/components/rarity-badge.js";
import { el } from "@/shared/dom/elements.js";
import { cardsFilters } from "@/pages/cards/cards-filters.js";
import { palettePage } from "@/pages/palette/palette-page.js";
import { ROUTES, visibleNavigation } from "@/pages/app-shell/navigation.js";
import { fetchDouble } from "~/doubles/fetch.js";
import {
  LAYOUT_WIDTHS,
  acrossWidths,
  assertControlsKeepWords,
  assertNothingClipped,
  assertWholeWords,
  assertWithinContainer,
} from "~/support/layout.js";
import { assertThrows, assertTrue, suite, test } from "~/runner.js";

/** A proporção de uma carta de TCG, e a largura que disparou o OF-004. */
const IMAGEM_LARGURA = 488;
const IMAGEM_ALTURA = 680;

/** Um pixel de folga para comparação de topo entre duas caixas. */
const MESMA_LINHA = 1;

const rem = () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

/**
 * Espera uma volta da fila de tarefas: componente que busca ao montar.
 *
 * `MessageChannel` e não `setTimeout(0)`: com a aba em segundo plano, o
 * navegador estica cada `setTimeout` para um segundo ou mais, e esta suíte
 * espera dezenas de vezes — a execução passava de meio minuto para vários.
 * Mensagem entre portas não entra nesse estrangulamento, e a semântica é a
 * mesma: uma tarefa depois, com as promessas da montagem já resolvidas.
 */
const assentar = () =>
  new Promise((resolve) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });

/**
 * Espera a tela chegar ao estado que o teste quer medir.
 *
 * Um número fixo de voltas é aposta: `fetch` → leitura do corpo → desenho
 * leva mais de uma tarefa, e o teste que esperasse uma só mediria o estado de
 * CARREGAMENTO — e passaria, porque um indicador de progresso não estoura
 * coluna nenhuma. Quem chama ainda afirma a condição depois: se ela nunca
 * chegar, a falha diz isso, em vez de o teste passar vazio.
 */
async function ate(condicao, voltas = 50) {
  for (let volta = 0; volta < voltas && !condicao(); volta++) {
    await assentar();
  }
}

/**
 * Nomes que existem de verdade e são o pior caso da grade.
 *
 * Carta de TCG tem nome longo com hífen e vírgula, e o campo em português
 * costuma ser mais longo que o original — é o dado real que aperta a coluna,
 * não uma cadeia inventada de trezentos caracteres.
 */
function cartas() {
  return [
    {
      id: 7,
      nameEn: "Blue-Eyes Alternative Ultimate Dragon",
      namePt: "Dragão Definitivo Alternativo de Olhos Azuis",
      imageUrl: null,
      game: { name: "Yu-Gi-Oh!" },
      edition: { name: "Legendary Duelists: Season 3" },
      rarity: { name: "Ultra Rara Colecionador" },
    },
    {
      id: 9,
      nameEn: "Karn, Scion of Urza",
      namePt: "Karn, Descendente de Urza",
      imageUrl: null,
      game: { name: "Magic: The Gathering" },
      edition: { name: "Dominaria" },
      rarity: { name: "Mítica" },
    },
  ];
}

/**
 * Uma imagem que carrega de verdade, com a medida intrínseca de uma carta.
 *
 * Precisa **carregar**: `<img>` sem `src` não contribui medida nenhuma, e o
 * defeito do OF-004 dependia justamente do natural da imagem. `blob:` porque a
 * CSP admite (`img-src 'self' https: blob:`) e `data:` não — e porque assim o
 * teste não depende de rede, que o faria passar por acidente quando ela
 * falhasse.
 */
function imagemDeCarta() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGEM_LARGURA}" height="${IMAGEM_ALTURA}"></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const image = document.createElement("img");

  image.className = "image-preview-media";
  image.src = url;

  return { image, pronta: image.decode(), revoke: () => URL.revokeObjectURL(url) };
}

/**
 * Uma caixa de largura conhecida, para provar a rede contra um caso ruim.
 */
function comCaixaDe(largura, corpo) {
  const host = document.createElement("div");

  host.style.width = `${largura}px`;
  document.body.append(host);

  try {
    return corpo(host);
  } finally {
    host.remove();
  }
}

/**
 * Uma caixa larga demais, com altura de verdade.
 *
 * A altura não é decoração: caixa de altura zero não gera área de rolagem, e
 * a comparação de `scrollWidth` com `clientWidth` devolvia os dois iguais —
 * o próprio auto-teste passava sem acusar nada.
 */
function caixaDe300() {
  const largo = el("div");

  largo.style.width = "300px";
  largo.style.height = "10px";

  return largo;
}

/**
 * A rede medindo a si mesma.
 *
 * Sem isto a suíte acima seria a armadilha do teste vazio: uma invariante que
 * não consegue falhar passa em tudo e não protege nada — foi exatamente o que
 * aconteceu com a primeira versão do teste do OF-004, que media uma imagem sem
 * `src` e passava sem a correção.
 *
 * Vale especialmente para a palavra inteira: enquanto `overflow-wrap: anywhere`
 * morou no `body`, essa invariante pulava TODO elemento da página, porque todo
 * elemento herdava a declaração. Ela só passou a ter dentes quando a quebra foi
 * escopada — e é este teste que prova que os dentes existem.
 */
suite("tests/support/layout · a rede de segurança acusa o que deve acusar", () => {
  test("a palavra que não cabe na própria caixa é acusada", () =>
    comCaixaDe(40, (host) => {
      host.append(el("p", { text: "Remover imagem" }));

      assertThrows(
        () => assertWholeWords(host, "prova"),
        Error,
        "a coluna de 40px coube uma palavra inteira, o que não é possível",
      );
    }));

  test("a palavra cabe quando a caixa é larga, e aí nada é acusado", () =>
    comCaixaDe(400, (host) => {
      host.append(el("p", { text: "Remover imagem" }));

      assertWholeWords(host, "prova");
    }));

  test("quem pede a quebra de propósito não é acusado", () =>
    comCaixaDe(40, (host) => {
      // O texto que veio de fora declara `.wrap-anywhere` e sai da conta: a
      // invariante existe para achar quem NÃO pediu a quebra.
      host.append(el("p", { text: "augusto.henrique@oraculo.local", classes: ["wrap-anywhere"] }));

      assertWholeWords(host, "prova");
    }));

  test("o controle que HERDOU a quebra em qualquer ponto é acusado", () =>
    comCaixaDe(400, (host) => {
      /*
       * O ponto cego que este caso fecha: a invariante da palavra inteira
       * PULA quem computa `anywhere`, e a propriedade é herdada — uma regra
       * escrita na célula desce para o botão dentro dela, e o botão sai da
       * conta junto. Foi assim que "Excluir" saiu como "Excl / uir" na visão
       * tabela sem nenhum teste reclamar.
       */
      const celula = el("div", { classes: ["wrap-anywhere"] });

      celula.append(el("button", { text: "Excluir", classes: ["button"] }));
      host.append(celula);

      assertThrows(
        () => assertControlsKeepWords(host, "prova"),
        Error,
        "o botão herdou a quebra em qualquer ponto e ninguém acusou",
      );
    }));

  test("o controle que NÃO herdou a quebra passa", () =>
    comCaixaDe(400, (host) => {
      host.append(el("button", { text: "Excluir", classes: ["button"] }));

      assertControlsKeepWords(host, "prova");
    }));

  test("o elemento mais largo que o contêiner é acusado", () =>
    comCaixaDe(100, (host) => {
      const largo = caixaDe300();

      host.append(largo);

      assertThrows(
        () => assertWithinContainer(host, "prova"),
        Error,
        "300px couberam numa caixa de 100px",
      );
    }));

  test("o conteúdo cortado por uma caixa que esconde o excedente é acusado", () =>
    comCaixaDe(100, (host) => {
      host.style.overflowX = "hidden";
      host.append(caixaDe300());

      assertThrows(
        () => assertNothingClipped(host, "prova"),
        Error,
        "a caixa de 100px cortou 200px e não acusou",
      );
    }));

  test("o contêiner que ROLA no próprio eixo não é acusado", () =>
    comCaixaDe(100, (host) => {
      // É a saída legítima da tabela de cartas: o excedente continua
      // alcançável, então não há perda de conteúdo a acusar.
      host.style.overflowX = "auto";
      host.append(caixaDe300());

      assertNothingClipped(host, "prova");
    }));
});

suite("styles/layout · a geometria das telas principais", () => {
  test("o campo de imagem cruza os pontos de quebra sem espremer os controles", async () => {
    let liberar = () => {};

    const mount = async ({ scope }) => {
      const field = cardImageField({ scope });
      const { image, pronta, revoke } = imagemDeCarta();

      liberar = revoke;
      field.node.querySelector(".image-preview").replaceChildren(image);
      await pronta;

      return field.node;
    };

    try {
      await acrossWidths({ mount, label: "campo de imagem" }, ({ host, context }) => {
        const controles = host.querySelector(".image-field-controls").getBoundingClientRect();
        const preview = host.querySelector(".image-preview").getBoundingClientRect();
        const campo = host.querySelector(".image-field").getBoundingClientRect();

        /*
         * O contrato da primitiva Sidebar, medido: ou a barra desceu para a
         * linha de baixo, ou o conteúdo ao lado dela tem pelo menos o mínimo
         * declarado. O que o OF-004 produziu foi o terceiro caso — os dois na
         * mesma linha com 46px de coluna, um caractere de largura.
         */
        if (Math.abs(controles.top - preview.top) > MESMA_LINHA) {
          return;
        }

        const minimo = Math.min(20 * rem(), campo.width);

        assertTrue(
          controles.width >= minimo - MESMA_LINHA,
          `[${context}] os controles ficaram com ${Math.round(controles.width)}px ao lado da imagem; o mínimo é ${Math.round(minimo)}px`,
        );
      });
    } finally {
      liberar();
    }
  });

  test("a galeria de cartas cruza os pontos de quebra sem estourar a coluna", () =>
    acrossWidths(
      {
        label: "galeria",
        /*
         * As duas larguras a mais são a VIRADA DA GALERIA, e ela acontece num
         * pixel: com 399 há uma coluna só e a carta tem 367px; com 400 são
         * duas colunas de 176px. A carta muda de tamanho por um fator de dois
         * de uma largura para a seguinte, e é justamente aí que um desenho em
         * porcentagem — o verso — tem chance de quebrar. As larguras padrão
         * da rede cercam os pontos de quebra do LAYOUT, que são outros.
         */
        widths: [...LAYOUT_WIDTHS, 399, 400].sort((a, b) => a - b),
        // Sem `.node`: `cardGallery` devolve o próprio elemento. Com ele, o
        // valor montado era `undefined`, nada era anexado, e esta linha da
        // rede media uma caixa VAZIA — passava sempre, protegendo nada.
        mount: ({ scope }) =>
          cardGallery({ cards: cartas(), onOpen: () => {}, onDelete: () => {}, scope }),
      },
      ({ host, context }) => {
        /*
         * O verso da carta é DUAS CAMADAS DE MÁSCARA, e máscara não tem nó no
         * DOM: `querySelector` não alcança, e afirmar que a regra foi escrita
         * no CSS não prova que ela chegou ao elemento. Medir o estilo
         * computado do pseudoelemento é o que prova — e é o mesmo motivo pelo
         * qual esta rede existe (OF-004).
         *
         * As duas cartas do cenário estão sem imagem de propósito: é assim
         * que o seed tem The One Ring e Celebration Pikachu.
         */
        const verso = host.querySelector(".card-image-empty");

        assertTrue(verso !== null, `[${context}] a carta sem imagem não montou o espaço reservado`);

        const moldura = getComputedStyle(verso, "::before").maskImage;
        const gema = getComputedStyle(verso, "::after").maskImage;

        assertTrue(
          moldura.includes("card-back/frame.svg"),
          `[${context}] o verso subiu sem a moldura: ${moldura}`,
        );
        assertTrue(
          gema.includes("card-back/gem.svg"),
          `[${context}] o verso subiu sem a gema: ${gema}`,
        );
      },
    ));

  test("o modal de exclusão põe a miniatura ao lado do texto, ou embaixo dele", () =>
    acrossWidths(
      {
        label: "exclusão",
        /*
         * O modal em si não entra na rede: o `openModal` prende a caixa ao
         * `document.body` e a largura dela vem da JANELA, não do contêiner
         * que esta rede controla. O que tem geometria é o arranjo do
         * conteúdo, e é ele que se monta aqui — o nó real que o modal
         * recebe, não uma cópia parecida.
         *
         * O nome mais longo do seed de propósito: é ele que empurra o título
         * e obriga a explicação a caber ao lado da miniatura.
         */
        mount: ({ scope }) =>
          deleteCardPreview({
            card: {
              nameEn: "Blue-Eyes Alternative Ultimate Dragon",
              imageUrl: null,
            },
            scope,
          }),
      },
      ({ host, context }) => {
        const miniatura = host.querySelector(".sidebar-side").getBoundingClientRect();
        const texto = host.querySelector(".sidebar-content").getBoundingClientRect();
        const caixa = host.querySelector(".sidebar").getBoundingClientRect();

        // O mesmo contrato da primitiva que o OF-004 quebrou: ou a barra
        // desceu, ou o que está ao lado dela tem pelo menos o piso declarado.
        if (Math.abs(miniatura.top - texto.top) > MESMA_LINHA) {
          return;
        }

        const minimo = Math.min(14 * rem(), caixa.width);

        assertTrue(
          texto.width >= minimo - MESMA_LINHA,
          `[${context}] a explicação ficou com ${Math.round(texto.width)}px ao lado da miniatura; o mínimo é ${Math.round(minimo)}px`,
        );
      },
    ));

  test("a tabela de cartas rola no próprio eixo e não na página", () =>
    acrossWidths(
      {
        label: "tabela",
        // `cardTable` já devolve o `.scroll-x` que rola: envolvê-la de novo
        // criaria um contêiner que não rola por fora do que rola, e o teste
        // mediria a embalagem em vez da tabela.
        mount: ({ scope }) =>
          cardTable({ cards: cartas(), onOpen: () => {}, onDelete: () => {}, scope }),
      },
      ({ host, context }) => {
        const wrapper = host.querySelector(".card-table-wrapper");

        // A promessa do RNF-04 tem duas metades, e só a segunda costuma ser
        // verificada: a página não rola **porque** o contêiner rola.
        assertTrue(
          wrapper.scrollWidth > wrapper.clientWidth || wrapper.clientWidth >= 40 * rem(),
          `[${context}] a tabela nem coube nem ganhou rolagem própria`,
        );
      },
    ));

  test("os estados vazios cruzam os pontos de quebra com a ilustração", () =>
    acrossWidths(
      {
        label: "estados vazios",
        /*
         * Os três de uma vez: eles são blocos independentes numa coluna, e o
         * que interessa medir é a ilustração — `min(12rem, 100%)` some da
         * conta em tela larga e passa a valer em tela estreita, que é onde
         * uma largura fixa estouraria.
         */
        mount: ({ scope: life }) =>
          el("div", {
            classes: ["stack"],
            children: [
              empty({
                title: "Página não encontrada",
                description: "O endereço não corresponde a nenhuma tela do portal.",
                as: "h1",
                image: "not-found",
              }),
              empty({
                title: "Nenhuma carta cadastrada ainda",
                description: "Quando o catálogo receber a primeira carta, ela aparece aqui.",
                image: "empty-catalog",
              }),
              empty({
                title: "Nenhuma carta encontrada",
                description: "Nenhuma carta corresponde à busca e aos filtros escolhidos.",
                image: "search",
                action: button({
                  label: "Limpar busca e filtros",
                  variant: "secondary",
                  scope: life,
                  onClick: () => {},
                }).node,
              }),
            ],
          }),
      },
      ({ host, context }) => {
        const caixa = host.getBoundingClientRect();

        for (const desenho of host.querySelectorAll(".state-image")) {
          const medida = desenho.getBoundingClientRect();

          assertTrue(
            medida.width > 0 && medida.height > 0,
            `[${context}] a ilustração subiu sem caixa: ${Math.round(medida.width)}x${Math.round(medida.height)}`,
          );
          assertTrue(
            medida.width <= caixa.width + 1,
            `[${context}] a ilustração mede ${Math.round(medida.width)}px numa caixa de ${Math.round(caixa.width)}px`,
          );
        }
      },
    ));

  test("o cabeçalho cruza os pontos de quebra sem cortar nenhuma ação", () =>
    acrossWidths({
      label: "cabeçalho",
      mount: () =>
        appHeader({
          brand: "Oráculo",
          items: visibleNavigation(() => true),
          currentPath: ROUTES.cards,
          actions: [
            el("button", { text: "Tema escuro", classes: ["button", "button-ghost"] }),
            el("button", { text: "Sair", classes: ["button", "button-ghost"] }),
          ],
        }),
    }));

  test("a paginação cruza os pontos de quebra sem estourar", () =>
    acrossWidths({
      label: "paginação",
      // Idem: `pagination` também devolve o elemento, e esta linha media vazio.
      mount: ({ scope }) =>
        pagination({ page: 3, totalPages: 12, total: 237, onChange: () => {}, scope }),
    }));

  test("a barra de filtros cruza os pontos de quebra sem estourar", async () => {
    const rede = fetchDouble();

    rede.onJson("GET", "/api/games", {
      data: [
        { id: "magic-the-gathering", name: "Magic: The Gathering" },
        { id: "yu-gi-oh", name: "Yu-Gi-Oh!" },
      ],
    });

    try {
      const jogos = (host) => host.querySelectorAll("#jogo option").length;

      await acrossWidths(
        {
          label: "filtros",
          mount: async ({ scope }) => {
            const filters = cardsFilters({ query: readCardQuery(""), scope, onChange: () => {} });

            await ate(() => jogos(filters.node) > 2);

            return filters.node;
          },
        },
        ({ host, context }) => {
          // O rótulo "Todos os jogos" mais os dois do dublê: sem eles a barra
          // estaria medindo o estado de carregamento da lista de jogos.
          assertTrue(jogos(host) > 2, `[${context}] a lista de jogos não chegou`);
        },
      );
    } finally {
      // O cache de catálogos é longo de propósito (§5.4): deixá-lo cheio faria
      // a próxima suíte medir uma lista que ela não pediu.
      invalidateCatalogs();
      rede.restore();
    }
  });

  test("os dois painéis de catálogo cruzam os pontos de quebra sem estourar", () => {
    /*
     * O `api` do painel é injetado pela página — passar um aqui é a mesma
     * fiação que `catalogs-page.js` faz, não um dublê do nosso próprio módulo
     * (§13.3). O que está sob medida é a grade dos dois painéis.
     */
    const catalogo = (itens) => ({
      list: async () => itens,
      create: async () => {},
      update: async () => {},
      deactivate: async () => ({ wasInUse: false }),
    });

    return acrossWidths({
      label: "catálogos",
      mount: async ({ scope }) => {
        const edicoes = catalogPanel({
          title: "Edições",
          singular: "edição",
          gameId: "magic-the-gathering",
          scope,
          notify: () => {},
          api: catalogo([
            { ref: 1, id: "dominaria-united", name: "Dominaria United", active: true },
            { ref: 2, id: "phyrexia-all-will-be-one", name: "Phyrexia: All Will Be One", active: false },
          ]),
        });

        const raridades = catalogPanel({
          title: "Raridades",
          singular: "raridade",
          gameId: "magic-the-gathering",
          scope,
          notify: () => {},
          api: catalogo([{ ref: 3, id: "mitica", name: "Mítica", active: true, sortOrder: 4, color: "copper" }]),
          // A mesma aparência que `catalogs-page.js` injeta: o formulário de
          // criação traz o seletor de cor, e ele entra na medida.
          appearance: { field: rarityColorField, badge: rarityBadge },
        });

        const panels = el("div", {
          classes: ["switcher", "catalog-panels"],
          children: [edicoes.node, raridades.node],
        });

        await ate(() => panels.querySelectorAll(".catalog-row").length === 3);

        return panels;
      },
    }, ({ host, context }) => {
      // As três linhas precisam estar na tela: é nelas que mora o código de
      // catálogo, a cadeia longa sem espaço que prova o escopo da quebra.
      assertTrue(
        host.querySelectorAll(".catalog-row").length === 3,
        `[${context}] os painéis não desenharam as três linhas`,
      );
    });
  });

  test("a raridade em edição, com o seletor de cor, cruza os pontos de quebra sem estourar", () => {
    /*
     * A linha em edição é o arranjo mais apertado do painel: nome, seletor de
     * dez opções e dois botões. "Obsidiana" é a opção de mínimo mais largo —
     * "Água-marinha" quebra no hífen, "Quartzo rosa" no espaço.
     *
     * Os dois painéis entram no `.switcher`, como `catalogs-page.js` monta.
     * Item de flex não encolhe abaixo do próprio min-content, e é esse mínimo
     * que estoura. Montado sozinho num bloco, o painel transbordaria para
     * dentro do próprio padding, onde a medida contra a borda do contêiner não
     * alcança — foi assim que a moldura dupla da opção passou por aqui.
     */
    const catalogo = (itens) => ({
      list: async () => itens,
      create: async () => {},
      update: async () => {},
      deactivate: async () => ({ wasInUse: false }),
    });

    return acrossWidths({
      label: "raridade em edição",
      mount: async ({ scope }) => {
        const edicoes = catalogPanel({
          title: "Edições",
          singular: "edição",
          gameId: "magic-the-gathering",
          scope,
          notify: () => {},
          api: catalogo([{ ref: 1, id: "dominaria-united", name: "Dominaria United", active: true }]),
        });

        const raridades = catalogPanel({
          title: "Raridades",
          singular: "raridade",
          gameId: "magic-the-gathering",
          scope,
          notify: () => {},
          api: catalogo([
            { ref: 3, id: "ultra-rara-colecionador", name: "Ultra Rara Colecionador", active: true, sortOrder: 5, color: "rose-quartz" },
          ]),
          appearance: { field: rarityColorField, badge: rarityBadge },
        });

        const panels = el("div", {
          classes: ["switcher", "catalog-panels"],
          children: [edicoes.node, raridades.node],
        });

        await ate(() => raridades.node.querySelector('[data-edit-ref="3"]') !== null);
        raridades.node.querySelector('[data-edit-ref="3"]').click();
        await ate(() => raridades.node.querySelector(".catalog-edit .rarity-color-field") !== null);

        return panels;
      },
    }, ({ host, context }) => {
      // Mede-se o estado aberto, e não o de carregamento: sem o seletor na
      // tela, a medida passaria vazia.
      assertTrue(
        host.querySelector(".catalog-edit .rarity-color-field") !== null,
        `[${context}] a edição não abriu com o seletor`,
      );
    });
  });

  test("o histórico da carta cruza os pontos de quebra sem cortar o valor", async () => {
    const rede = fetchDouble();

    rede.onJson("GET", "/api/cards/7/history", {
      data: [
        {
          action: "updated",
          createdAt: "2026-09-09T14:32:00-03:00",
          userName: "Augusto Henrique Buin",
          changes: {
            // O valor de `image` é um endereço inteiro sem espaço: é o pior
            // caso da linha, e o que prova o escopo da quebra.
            image: { from: null, to: "/api/media/9f8c1d4b2a7e5306f1c8b9d4e2a7f350.jpg" },
            nameEn: { from: "Karn, Scion of Urza", to: "Karn, Silver Golem" },
          },
        },
      ],
    });

    try {
      await acrossWidths(
        {
          label: "histórico",
          mount: async ({ scope }) => {
            const history = cardHistory({ cardId: 7, scope });

            // O painel só busca quando abre — é `<details>`, e medir fechado
            // mediria a legenda, não o conteúdo.
            history.node.open = true;
            history.node.dispatchEvent(new Event("toggle"));
            await ate(() => history.node.querySelectorAll(".history-change").length === 2);

            // Dentro de um `.card`, como `card-form-page.js` o monta. Sem o
            // cartão a linha ganha o respiro do padding de volta, e o piso
            // rígido que esta tela tinha cabia por acidente — o teste passava
            // sem a correção.
            return el("section", { classes: ["card"], children: [history.node] });
          },
        },
        ({ host, context }) => {
          // A condição do defeito, afirmada: sem as linhas de alteração na
          // tela, não há coluna de nome de campo para medir.
          assertTrue(
            host.querySelectorAll(".history-change").length === 2,
            `[${context}] o histórico não desenhou as duas alterações`,
          );
        },
      );
    } finally {
      rede.restore();
    }
  });

  test("a paleta cruza os pontos de quebra sem estourar", () =>
    acrossWidths(
      {
        label: "paleta",
        mount: ({ scope, host }) => {
          scope.add(palettePage(host));
        },
      },
      ({ host, context }) => {
        // A condição, afirmada: sem as linhas das duas tabelas na tela, a
        // medida seria de uma página vazia, e passaria.
        const linhas = host.querySelectorAll(".palette-table tbody tr").length;

        assertTrue(linhas > 40, `[${context}] a paleta desenhou ${linhas} linhas de tabela`);
      },
    ));

  test("a tela de conta cruza os pontos de quebra sem espremer nenhuma coluna", () =>
    acrossWidths({
      label: "conta",
      mount: ({ scope }) =>
        el("div", {
          classes: ["switcher", "account-layout"],
          children: [
            el("section", {
              classes: ["card", "stack"],
              attrs: { "aria-label": "Dados da conta" },
              children: [
                el("h2", { text: "Conta" }),
                el("p", { text: "Augusto Henrique Buin", classes: ["text-ink", "wrap-anywhere"] }),
                // E-mail é dado do usuário e é a cadeia longa sem espaço que
                // mais aparece nesta tela: é ele quem prova o escopo da quebra.
                el("p", {
                  text: "augusto.henrique.buin@oraculo.local",
                  classes: ["text-muted", "wrap-anywhere"],
                }),
                el("p", { text: "Perfil: Administrador", classes: ["text-muted"] }),
              ],
            }),
            el("section", {
              classes: ["card"],
              children: [changePasswordForm({ scope, onChanged: () => {} }).node],
            }),
          ],
        }),
    }));
});
