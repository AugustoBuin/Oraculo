/**
 * O selo de uma raridade: o nome, sobre o fundo do material, com uma marca.
 *
 * **A marca é o que o separa dos selos de estado.** Os estados usam o mesmo
 * desenho de fundo e tinta (`badge-attention` e irmãos), e um "Ouro" sem a
 * marca seria lido como aviso. Ela é decorativa (`aria-hidden`): o nome está
 * sempre escrito, e cor nunca é o único sinal (§9).
 *
 * A cor entra por classe (`rarity-<chave>`), nunca por `style` — a CSP não tem
 * `unsafe-inline`. Chave desconhecida vira grafite, o selo neutro.
 */

import { el } from "@/shared/dom/elements.js";
import { rarityColor } from "@/shared/theme/rarity-colors.js";

/**
 * @param {{ name: string, color?: string }} rarity
 * @returns {HTMLElement}
 */
export function rarityBadge({ name, color }) {
  return el("span", {
    classes: ["badge", "rarity-badge", `rarity-${rarityColor(color)}`],
    children: [
      el("span", { classes: ["rarity-mark"], attrs: { "aria-hidden": "true" } }),
      // `textContent`, sempre: o nome da raridade é dado editável pelo ADMIN.
      el("span", { text: name }),
    ],
  });
}
