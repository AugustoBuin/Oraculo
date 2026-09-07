/**
 * Listeners, timers e requisições com limpeza obrigatória.
 *
 * Em aplicação sem framework, listener que não sai, timer que não é cancelado
 * e requisição que ninguém aborta são **a principal causa de degradação depois
 * de meia hora de uso** (PADROES-ENGENHARIA.md §12.4). A convenção do projeto
 * é a que o RNF-07 cobra: toda função de montagem devolve uma função de
 * limpeza, e quem monta guarda.
 *
 * O `scope()` daqui existe para que guardar seja mais fácil do que esquecer.
 */

/**
 * Registra um listener e devolve a função que o remove.
 *
 * Devolver a limpeza em vez de expor `removeEventListener` evita o erro mais
 * comum da remoção manual: passar um `handler` ou um `options` diferente do
 * que foi registrado, o que não dá erro nenhum — só não remove.
 */
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);

  return () => target.removeEventListener(type, handler, options);
}

/**
 * Um escopo de vida: junta tudo o que precisa morrer junto.
 *
 * Cada tela ou componente cria um escopo, registra nele o que criar, e devolve
 * o `dispose` para quem montou. Uma chamada derruba listeners, timers,
 * observadores e requisições em voo — sem uma lista de limpeza escrita à mão,
 * que é onde sempre falta um item.
 */
export function scope() {
  /** @type {Array<() => void>} */
  const teardowns = [];
  let disposed = false;

  const add = (teardown) => {
    if (disposed) {
      // Registrar em escopo morto vazaria em silêncio: a limpeza já rodou e
      // não vai rodar de novo. Encerrar na hora é melhor do que descobrir
      // depois de meia hora de uso.
      teardown();
      return teardown;
    }

    teardowns.push(teardown);

    return teardown;
  };

  return {
    /** Registra uma limpeza arbitrária. */
    add,

    /** `on()`, já preso ao escopo. */
    on: (target, type, handler, options) => add(on(target, type, handler, options)),

    /** `setTimeout` que se cancela junto com o escopo. */
    timeout: (handler, delayMs) => {
      const id = window.setTimeout(handler, delayMs);
      add(() => window.clearTimeout(id));
      return id;
    },

    /** `setInterval` que se cancela junto com o escopo. */
    interval: (handler, delayMs) => {
      const id = window.setInterval(handler, delayMs);
      add(() => window.clearInterval(id));
      return id;
    },

    /**
     * Um `AbortController` cujo `signal` vai para o cliente HTTP.
     *
     * É o que faz a requisição da tela morrer com a tela — e é a mesma peça
     * que a cascata usa para descartar resposta de jogo já trocado (RF-25).
     */
    controller: () => {
      const controller = new AbortController();
      add(() => controller.abort());
      return controller;
    },

    /**
     * Encerra tudo, na ordem inversa do registro.
     *
     * Cada limpeza roda dentro do próprio try/catch: uma que lança não pode
     * impedir as seguintes de rodar, ou o vazamento que se queria evitar
     * acontece justamente no caminho de erro.
     */
    dispose: () => {
      disposed = true;

      while (teardowns.length > 0) {
        const teardown = teardowns.pop();

        try {
          teardown();
        } catch (error) {
          console.error("[scope] falha ao limpar", { error });
        }
      }
    },

    get isDisposed() {
      return disposed;
    },
  };
}
