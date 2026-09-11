/**
 * O seletor de cor da raridade.
 *
 * Um grupo de rádio NATIVO: setas do teclado, um ponto de tabulação só e a
 * posição no grupo anunciada pelo leitor de tela vêm de graça. Cada opção é o
 * próprio selo, com o nome escrito — quem escolhe vê o que vai aparecer na
 * carta, e escolhe pelo nome se não distingue os tons.
 */

import { rarityColorField } from "@/features/catalogs/components/rarity-color-field.js";
import { assertSame, assertTrue, suite, test } from "~/runner.js";

const radios = (campo) => [...campo.wrapper.querySelectorAll('input[type="radio"]')];

suite("features/catalogs/components/rarity-color-field · o seletor", () => {
  test("é um fieldset com legenda e dez rádios nativos do mesmo grupo", () => {
    const campo = rarityColorField({ id: "raridade-cor" });

    assertSame(campo.wrapper.tagName, "FIELDSET");
    assertSame(campo.wrapper.querySelector("legend").textContent, "Cor do selo");
    assertSame(radios(campo).length, 10);
    assertTrue(radios(campo).every((radio) => radio.name === "raridade-cor"), "os rádios não formam um grupo");
  });

  test("cada opção é o próprio selo, com o nome escrito", () => {
    const [, prata] = radios(rarityColorField({ id: "raridade-cor" }));
    const opcao = prata.closest("label");

    assertSame(prata.value, "silver");
    assertTrue(opcao.querySelector(".rarity-badge.rarity-silver") !== null, "a opção não mostra o selo");
    assertSame(opcao.textContent, "Prata");
  });

  test("começa na cor dada e, sem cor, no grafite", () => {
    assertSame(rarityColorField({ id: "a", value: "gold" }).value, "gold");
    assertSame(rarityColorField({ id: "b" }).value, "graphite");
  });

  test("setValue marca outra cor; chave desconhecida volta ao grafite", () => {
    const campo = rarityColorField({ id: "raridade-cor", value: "gold" });

    campo.setValue("obsidian");
    assertSame(campo.value, "obsidian");
    assertSame(radios(campo).filter((radio) => radio.checked).length, 1);

    campo.setValue("dourado");
    assertSame(campo.value, "graphite");
  });

  test("os ids das opções nascem do id do campo, para dois seletores conviverem na tela", () => {
    const [grafite] = radios(rarityColorField({ id: "raridade-cor-4" }));

    assertSame(grafite.id, "raridade-cor-4-graphite");
  });
});
