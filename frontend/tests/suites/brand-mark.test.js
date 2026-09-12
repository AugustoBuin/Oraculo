/**
 * A marca do Oráculo: a tiragem de três cartas, num tom só.
 *
 * **O desenho é decorativo, e cala.** A palavra "Oráculo" continua sendo texto
 * HTML, então o link do cabeçalho já se chama "Oráculo" para quem usa leitor de
 * tela; a marca ao lado dele só repetiria o nome (§9.4). Ela também não tem
 * texto dentro: SVG carregado como imagem não alcança fonte nenhuma, e letra
 * desenhada sairia com a fonte errada.
 *
 * A cor entra por token, pela máscara (D2, rota A): um `<span>` pintado de
 * `--color-brand` com o SVG como `mask-image`. Por isso a marca é um elemento
 * vazio, e o teste mede o elemento, não traçado nenhum.
 */

import { appHeader } from "@/shared/components/app-header.js";
import { brandMark } from "@/shared/components/brand-mark.js";
import { assertNull, assertSame, assertTrue, suite, test } from "~/runner.js";

suite("shared/components/brand-mark · a marca", () => {
  test("é decorativa: o leitor de tela não anuncia o desenho", () => {
    assertSame(brandMark().getAttribute("aria-hidden"), "true");
  });

  test("não leva texto: o nome é HTML, nunca traçado dentro da imagem", () => {
    const marca = brandMark();

    assertSame(marca.textContent, "");
    assertNull(marca.querySelector("svg"));
  });

  test("sem sigilo por padrão — o cabeçalho a usa a 24px, onde a gema se funde", () => {
    const marca = brandMark();

    assertTrue(marca.classList.contains("brand-mark"));
    assertSame(marca.classList.contains("brand-mark-sigil"), false);
  });

  test("com sigilo, pede a versão de 64px em diante", () => {
    const marca = brandMark({ sigil: true });

    assertTrue(marca.classList.contains("brand-mark"));
    assertTrue(marca.classList.contains("brand-mark-sigil"));
  });

  test("o cabeçalho monta a marca dentro do link, e o link continua se chamando Oráculo", () => {
    const link = appHeader({
      brand: "Oráculo",
      items: [],
      currentPath: "/",
    }).querySelector(".app-brand");

    assertTrue(link.querySelector(".brand-mark") !== null);
    // O nome acessível do link: a marca é `aria-hidden`, então sobra o texto.
    assertSame(link.textContent, "Oráculo");
  });
});
