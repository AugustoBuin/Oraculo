/**
 * O campo de imagem, medido de verdade.
 *
 * Regressão introduzida por `63b6413` (F-050, "o layout sobrevive à fonte do
 * navegador em 200%"): a pré-visualização ganhou `width: min(8rem, 100%)`, que
 * resolve o caso estreito e quebra o largo. A trilha `auto` do grid se
 * dimensiona pelo **max-content** do item, e a porcentagem de `min(…, 100%)`
 * não resolve durante o dimensionamento intrínseco — sobra a largura NATURAL
 * da imagem, 488px, a proporção de uma carta.
 *
 * O resultado: a trilha reservava 488px, o item pintava 128px, e a coluna dos
 * controles era espremida até o mínimo. Como `overflow-wrap: anywhere` é
 * herdado do `body`, esse mínimo é **um caractere** — "Remover imagem" saía
 * uma letra por linha, com 379px de espaço vazio ao lado.
 *
 * Esta suíte mede geometria real, e por isso precisa do documento: a página de
 * testes já carrega `components.css`, então o que se mede aqui é o CSS que a
 * aplicação usa, não uma cópia dele.
 */

import { cardImageField } from "@/features/cards/components/card-image-field.js";
import { scope } from "@/shared/dom/events.js";
import { assertTrue, suite, test } from "~/runner.js";

/** Acima de 36rem, que é onde o grid de duas colunas entra. */
const LARGURA = 800;

/** A proporção de uma carta de TCG, e a largura que disparava o defeito. */
const IMAGEM_LARGURA = 488;
const IMAGEM_ALTURA = 680;

/**
 * Uma imagem que carrega de verdade, com a medida intrínseca de uma carta.
 *
 * Precisa **carregar**: `<img>` sem `src` não contribui medida nenhuma, e o
 * defeito depende justamente do natural da imagem. `blob:` porque a CSP admite
 * (`img-src 'self' https: blob:`) e `data:` não — e porque assim o teste não
 * depende de rede, que o faria passar por acidente quando ela falhasse.
 */
function imagemDeCarta() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGEM_LARGURA}" height="${IMAGEM_ALTURA}"></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const image = document.createElement("img");

  image.className = "image-preview-media";
  image.src = url;

  return {
    image,
    pronta: image.decode(),
    revoke: () => URL.revokeObjectURL(url),
  };
}

async function comCampoMedido(body) {
  const life = scope();
  const host = document.createElement("div");
  const { image, pronta, revoke } = imagemDeCarta();

  host.style.width = `${LARGURA}px`;
  document.body.append(host);

  try {
    const field = cardImageField({ scope: life });
    host.append(field.node);

    const preview = field.node.querySelector(".image-preview");
    preview.replaceChildren(image);
    await pronta;

    const medir = (el) => Math.round(el.getBoundingClientRect().width);

    return body({
      controles: medir(field.node.querySelector(".image-field-controls")),
      preview: medir(preview),
      campo: medir(field.node),
      naturalDaImagem: image.naturalWidth,
    });
  } finally {
    revoke();
    life.dispose();
    host.remove();
  }
}

suite("features/cards/components/card-image-field · a geometria do campo", () => {
  test("a coluna dos controles não é espremida pela imagem ao lado", () =>
    comCampoMedido(({ controles, naturalDaImagem }) => {
      /*
       * A condição do defeito, afirmada em vez de suposta: sem imagem grande
       * carregada não há nada para espremer, e a suíte passaria vazia sem
       * ninguém perceber.
       */
      assertTrue(
        naturalDaImagem === IMAGEM_LARGURA,
        `a imagem do teste mediu ${naturalDaImagem}px em vez de ${IMAGEM_LARGURA}`,
      );

      // Antes da correção esta medida era 46px — um caractere de largura.
      assertTrue(
        controles > 300,
        `os controles ficaram com ${controles}px; a imagem ao lado os espremeu`,
      );
    }));

  test("a pré-visualização não reserva a largura natural da imagem", () =>
    comCampoMedido(({ preview }) => {
      // 8rem = 128px. A trilha chegava a reservar 488, os naturais da carta.
      assertTrue(
        preview <= 160,
        `a pré-visualização ocupou ${preview}px; deveria ficar em 8rem`,
      );
    }));

  test("as duas colunas juntas usam a largura disponível, sem buraco", () =>
    comCampoMedido(({ controles, preview, campo }) => {
      /*
       * O sintoma que se vê na tela é o BURACO: 379px de nada entre a
       * miniatura e a borda do campo. Medir só as colunas não o pegaria — a
       * soma delas contra o campo, sim.
       */
      const sobra = campo - controles - preview;

      assertTrue(
        sobra < 120,
        `sobraram ${sobra}px sem uso entre as colunas e a borda do campo`,
      );
    }));
});
