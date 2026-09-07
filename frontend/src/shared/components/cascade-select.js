/**
 * Um `select` que depende de outro.
 *
 * **Componente genérico: não conhece jogo, edição nem raridade.** Recebe uma
 * função que carrega as opções a partir do valor do pai, e nada mais. É o que
 * permite a mesma peça servir aos filtros da listagem e ao formulário de
 * cadastro — uma segunda implementação divergiria, e a raridade passaria a
 * aceitar o que a edição recusa (§2.3, §4.1).
 *
 * **A parte que importa é a corrida** (RF-25). Trocar o pai depressa —
 * Magic → Pokémon → Yu-Gi-Oh! em menos de um segundo — não pode deixar a lista
 * errada na tela. Duas defesas, e as duas são necessárias:
 *
 *   1. A requisição em voo é **abortada** quando outra começa.
 *   2. A resposta é comparada com um **token de geração** antes de ser usada,
 *      e descartada se não for a corrente. Abortar sozinho não basta: uma
 *      resposta pode já estar a caminho do `then` quando o abort chega.
 */

import { el } from "@/shared/dom/elements.js";

/** O valor que representa "nada escolhido". */
const EMPTY_VALUE = "";

/**
 * @param {{
 *   id: string,
 *   label: string,
 *   placeholder: string,
 *   emptyLabel?: string,
 *   loadOptions: (parentValue: string, options: { signal: AbortSignal }) => Promise<Array<{id: string, name: string}>>,
 *   onChange?: (value: string) => void,
 *   scope: object,
 * }} config
 */
export function cascadeSelect({
  id,
  label,
  placeholder,
  emptyLabel = "Nada disponível",
  loadOptions,
  onChange,
  scope,
}) {
  const select = el("select", { attrs: { id, name: id }, classes: ["field-input"] });
  const status = el("p", { classes: ["field-hint"], attrs: { id: `${id}-status` } });

  const wrapper = el("div", {
    classes: ["field"],
    children: [
      el("label", { text: label, attrs: { for: id }, classes: ["field-label"] }),
      select,
      status,
    ],
  });

  /** A geração corrente. Toda resposta de geração anterior é descartada. */
  let generation = 0;
  let inFlight = null;
  let parentValue = EMPTY_VALUE;
  let desiredValue = EMPTY_VALUE;

  scope.add(() => inFlight?.abort());

  function setOptions(items) {
    const options = [
      el("option", { text: placeholder, attrs: { value: EMPTY_VALUE } }),
      ...items.map((item) => el("option", { text: item.name, attrs: { value: item.id } })),
    ];

    select.replaceChildren(...options);

    // Restaura a seleção pretendida só se ela existir na lista NOVA. É o que
    // impede uma edição de Magic de continuar selecionada depois de o jogo
    // virar Pokémon (RF-24).
    const found = items.some((item) => item.id === desiredValue);
    select.value = found ? desiredValue : EMPTY_VALUE;
    desiredValue = select.value;
  }

  function setState(state, message = "") {
    // Desabilitado é estado, não estilo: um `select` habilitado e vazio
    // convida ao clique e não explica nada (RF-20, RF-22).
    select.disabled = state !== "ready";
    status.textContent = message;

    select.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    select.setAttribute("aria-describedby", `${id}-status`);
    wrapper.dataset.state = state;
  }

  function reset() {
    select.replaceChildren(el("option", { text: placeholder, attrs: { value: EMPTY_VALUE } }));
    select.value = EMPTY_VALUE;
  }

  /** Recarrega a partir do pai. */
  async function load({ silent = false } = {}) {
    inFlight?.abort();

    if (parentValue === EMPTY_VALUE) {
      reset();
      setState("idle", "Escolha antes o item anterior.");
      return;
    }

    const controller = new AbortController();
    const id = ++generation;

    inFlight = controller;

    if (!silent) {
      reset();
      setState("loading", "Carregando…");
    }

    try {
      const items = await loadOptions(parentValue, { signal: controller.signal });

      // A resposta chegou, mas o usuário já trocou o pai: ela é de uma
      // pergunta que ninguém está mais fazendo. Descartar aqui é a segunda
      // defesa do RF-25, e é a que pega o caso em que o abort chegou tarde.
      if (id !== generation) {
        return;
      }

      if (items.length === 0) {
        reset();
        setState("empty", emptyLabel);
        return;
      }

      setOptions(items);
      setState("ready", "");
    } catch (error) {
      if (id !== generation || controller.signal.aborted) {
        return;
      }

      // Falha não trava o formulário: o campo fica com estado de erro e uma
      // ação de tentar de novo, e os outros campos continuam utilizáveis
      // (RF-26).
      reset();
      setState("failed", "Não foi possível carregar. Tente novamente.");
      wrapper.dataset.error = "true";
      throw error;
    }
  }

  scope.on(select, "change", () => {
    desiredValue = select.value;
    onChange?.(select.value);
  });

  setState("idle", "Escolha antes o item anterior.");

  return {
    wrapper,
    select,

    get value() {
      return select.value;
    },

    /** Define a seleção pretendida, aplicada quando a lista tiver o item. */
    setValue(value) {
      desiredValue = typeof value === "string" ? value : EMPTY_VALUE;
      const found = [...select.options].some((option) => option.value === desiredValue);
      select.value = found ? desiredValue : EMPTY_VALUE;
    },

    /**
     * Troca o pai: recarrega a lista e **reseta a seleção anterior** (RF-24).
     *
     * O reset é imediato e não espera a resposta chegar — deixar a seleção
     * velha na tela enquanto a lista nova carrega é o que faz o usuário achar
     * que ela sobreviveu à troca.
     */
    async setParent(value, { keepSelection = false } = {}) {
      const next = typeof value === "string" ? value : EMPTY_VALUE;

      if (!keepSelection) {
        desiredValue = EMPTY_VALUE;
      }

      parentValue = next;

      return load();
    },

    /** Recarrega mantendo o pai — é a ação de "tentar novamente" do RF-26. */
    retry() {
      delete wrapper.dataset.error;
      return load();
    },

    get state() {
      return wrapper.dataset.state;
    },
  };
}
