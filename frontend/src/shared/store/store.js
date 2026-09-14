/**
 * Store observável mínimo.
 *
 * Guarda **estado de interface** — aba ativa, modal aberto, rascunho de
 * formulário. Estado de servidor mora no cache (`cache.js`) e nunca é copiado
 * para cá "para editar": duas verdades divergem no primeiro erro de rede
 * (PADROES-ENGENHARIA.md §6.1).
 *
 * É a peça que as bibliotecas de estado resolvem em milhares de linhas e que
 * aqui cabe em algumas dezenas, porque o que o projeto precisa é isto.
 */

export function createStore(initialState = {}) {
  let state = Object.freeze({ ...initialState });
  const subscribers = new Set();

  const notify = () => {
    // Itera sobre uma cópia: um assinante que se desinscreve dentro do próprio
    // aviso alteraria o Set durante a iteração.
    for (const subscriber of [...subscribers]) {
      try {
        subscriber(state);
      } catch (error) {
        // Um assinante que lança não pode impedir os outros de receber o
        // aviso — senão metade da tela fica desatualizada em silêncio.
        console.error("[store] assinante lançou", { error });
      }
    }
  };

  return {
    getState: () => state,

    /**
     * Aplica uma alteração parcial.
     *
     * Congela o resultado porque estado mutado por fora não avisa ninguém, e o
     * componente que não recebeu o aviso simplesmente não redesenha — um bug
     * que não deixa rastro.
     */
    setState(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      const merged = Object.freeze({ ...state, ...next });

      // Nada mudou de fato: avisar aqui provocaria redesenho à toa.
      const changed = Object.keys(next).some((key) => !Object.is(state[key], merged[key]));

      if (!changed) {
        return state;
      }

      state = merged;
      notify();

      return state;
    },

    /**
     * Assina e devolve a função de cancelamento.
     *
     * Devolver a limpeza em vez de expor `unsubscribe(fn)` é o que faz o
     * componente conseguir se desinscrever ao desmontar — vazamento de
     * listener é a fonte número um de bug em aplicação feita à mão (§12.4).
     */
    subscribe(subscriber) {
      subscribers.add(subscriber);

      return () => subscribers.delete(subscriber);
    },

    get subscriberCount() {
      return subscribers.size;
    },
  };
}
