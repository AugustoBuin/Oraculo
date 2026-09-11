/**
 * O seletor de cor da raridade.
 *
 * **Um grupo de rádio nativo**, e não uma grade de botões pintados: setas do
 * teclado, um ponto de tabulação só e a posição no grupo anunciada pelo leitor
 * de tela vêm do navegador, sem código (§9.1).
 *
 * **Cada opção é o próprio selo**, com o nome escrito. Quem escolhe vê
 * exatamente o que vai aparecer na carta, e escolhe pelo nome se não distingue
 * os tons. A opção marcada se distingue por duas coisas — o círculo preenchido
 * do rádio e a borda na cor da ação —, nunca só por cor.
 */

import { rarityBadge } from "@/shared/components/rarity-badge.js";
import { el } from "@/shared/dom/elements.js";
import { RARITY_COLORS, rarityColor } from "@/shared/theme/rarity-colors.js";

/**
 * @param {{ id: string, value?: string }} config `id` nomeia o grupo e prefixa o
 *   id de cada opção, para dois seletores conviverem na mesma tela.
 */
export function rarityColorField({ id, value }) {
  const radios = RARITY_COLORS.map(({ key }) =>
    el("input", { attrs: { type: "radio", name: id, value: key, id: `${id}-${key}` } }),
  );

  const options = RARITY_COLORS.map(({ key, label }, index) =>
    el("label", {
      attrs: { for: `${id}-${key}` },
      classes: ["rarity-option"],
      children: [radios[index], rarityBadge({ name: label, color: key })],
    }),
  );

  const wrapper = el("fieldset", {
    classes: ["rarity-color-field"],
    children: [
      el("legend", { text: "Cor do selo", classes: ["field-label"] }),
      el("div", { classes: ["rarity-color-options"], children: options }),
    ],
  });

  const setValue = (key) => {
    const chosen = rarityColor(key);

    for (const radio of radios) {
      radio.checked = radio.value === chosen;
    }
  };

  setValue(value);

  return {
    wrapper,

    get value() {
      return radios.find((radio) => radio.checked)?.value ?? rarityColor(undefined);
    },

    setValue,
  };
}
