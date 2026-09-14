/**
 * Campo de formulário com rótulo e erro acessíveis.
 *
 * Existe para que a parte que se esquece — associar o `label` ao `input`,
 * anunciar o erro para leitor de tela — seja a parte que vem de graça. Rótulo
 * solto e erro só colorido de vermelho são os dois defeitos de acessibilidade
 * mais comuns em formulário feito à mão (PADROES-ENGENHARIA.md §9.1).
 */

import { el } from "@/shared/dom/elements.js";

/**
 * @param {{
 *   id: string,
 *   label: string,
 *   type?: string,
 *   name?: string,
 *   autocomplete?: string,
 *   required?: boolean,
 *   hint?: string,
 * }} config
 */
export function field({
  id,
  label,
  type = "text",
  name = id,
  autocomplete,
  required = false,
  hint,
}) {
  const errorId = `${id}-erro`;
  const hintId = `${id}-dica`;

  const input = el("input", {
    attrs: {
      id,
      name,
      type,
      autocomplete,
      required,
      // Anuncia a dica desde o início; o erro entra e sai de `aria-describedby`
      // junto com a mensagem, para o leitor de tela não anunciar um erro que
      // já foi corrigido.
      "aria-describedby": hint === undefined ? undefined : hintId,
    },
    classes: ["field-input"],
  });

  const errorNode = el("p", {
    classes: ["field-error"],
    attrs: { id: errorId, hidden: true },
  });

  const children = [el("label", { text: label, attrs: { for: id }, classes: ["field-label"] })];

  if (hint !== undefined) {
    children.push(el("p", { text: hint, attrs: { id: hintId }, classes: ["field-hint"] }));
  }

  children.push(input, errorNode);

  const wrapper = el("div", { classes: ["field"], children });

  const describedBy = () => (hint === undefined ? [] : [hintId]);

  return {
    wrapper,
    input,

    get value() {
      return input.value;
    },

    /**
     * Marca o campo como inválido e anuncia a mensagem.
     *
     * `aria-invalid` mais `aria-describedby` é o par que faz o leitor de tela
     * dizer **qual** campo está errado e **por quê**. Só pintar a borda de
     * vermelho não anuncia nada — e falha a regra dos dois sinais (§9.4).
     */
    setError(message) {
      errorNode.textContent = message;
      errorNode.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", [...describedBy(), errorId].join(" "));
    },

    clearError() {
      errorNode.textContent = "";
      errorNode.hidden = true;
      input.removeAttribute("aria-invalid");

      const described = describedBy();

      if (described.length === 0) {
        input.removeAttribute("aria-describedby");
        return;
      }

      input.setAttribute("aria-describedby", described.join(" "));
    },

    get hasError() {
      return input.getAttribute("aria-invalid") === "true";
    },
  };
}
