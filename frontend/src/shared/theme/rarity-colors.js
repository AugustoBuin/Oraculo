/**
 * A paleta de cores de raridade: dez materiais, e só eles.
 *
 * Espelha `App\Shared\Enum\RarityColor`; a fonte comum dos dois é a tabela do
 * `api-contract.md` §4. Cada chave é um par de fundo e tinta definido em
 * `tokens.css` (`--color-rarity-<chave>` e `--color-on-rarity-<chave>`) e
 * medido nos dois temas — por isso a paleta é fechada, e não um hexadecimal
 * livre. A ordem é a do seletor.
 */

export const RARITY_COLORS = Object.freeze([
  Object.freeze({ key: "graphite", label: "Grafite" }),
  Object.freeze({ key: "silver", label: "Prata" }),
  Object.freeze({ key: "copper", label: "Cobre" }),
  Object.freeze({ key: "gold", label: "Ouro" }),
  Object.freeze({ key: "olivine", label: "Olivina" }),
  Object.freeze({ key: "patina", label: "Pátina" }),
  Object.freeze({ key: "aquamarine", label: "Água-marinha" }),
  Object.freeze({ key: "tourmaline", label: "Turmalina" }),
  Object.freeze({ key: "rose-quartz", label: "Quartzo rosa" }),
  Object.freeze({ key: "obsidian", label: "Obsidiana" }),
]);

/** O selo neutro de antes da paleta: raridade que ninguém pintou fica como era. */
export const DEFAULT_RARITY_COLOR = "graphite";

const KEYS = new Set(RARITY_COLORS.map((color) => color.key));

/**
 * A chave da paleta, ou o padrão.
 *
 * Uma cor que o cliente não conhece — gravada direto no banco, ou de uma
 * paleta mais nova que este código — vira grafite em vez de derrubar a carta:
 * cor é enfeite de leitura, e não pode ser o motivo de uma carta sumir da
 * galeria.
 */
export function rarityColor(raw) {
  return typeof raw === "string" && KEYS.has(raw) ? raw : DEFAULT_RARITY_COLOR;
}
