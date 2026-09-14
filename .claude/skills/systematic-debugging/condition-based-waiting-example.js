/**
 * Espera por condição para a página de testes do frontend.
 *
 * Referência para copiar dentro de `frontend/tests/` quando alguma suíte
 * precisar disso. **Não importe deste arquivo** — ele mora no ferramental de IA,
 * e a suíte do frontend não pode depender da camada de agentes: quem roda os
 * testes não precisa dela (ADR-009).
 *
 * Sem dependência de terceiros (ADR-001): é o `setTimeout` do navegador e mais
 * nada. Cada função devolve o valor observado, para o teste seguir usando.
 */

/** Intervalo entre sondagens. 10ms é barato e não atrapalha o microtask. */
const POLL_INTERVAL_MS = 10;

/** Teto padrão. Generoso o bastante para o contêiner, curto para não travar a suíte. */
const DEFAULT_TIMEOUT_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Espera a condição virar verdadeira e devolve o que ela produziu.
 *
 * A condição é chamada **a cada rodada** — nunca guarde o estado antes do laço,
 * senão você testa uma cópia velha.
 *
 * @template T
 * @param {() => T | undefined | null | false} condition
 * @param {string} description O que estamos esperando, em português, para a mensagem de falha
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<T>}
 */
export async function waitFor(condition, description, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const start = Date.now();

  for (;;) {
    // A condição pode lançar enquanto o DOM ainda não existe. Isso não é falha
    // do teste: é a espera fazendo o trabalho dela.
    let result;

    try {
      result = condition();
    } catch {
      result = undefined;
    }

    if (result) {
      return result;
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(`Tempo esgotado esperando ${description} (${timeoutMs}ms)`);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Espera um elemento aparecer sob a raiz informada.
 *
 * @param {ParentNode} root
 * @param {string} selector
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<Element>}
 */
export function waitForElement(root, selector, options) {
  return waitFor(() => root.querySelector(selector), `o elemento "${selector}" aparecer`, options);
}

/**
 * Espera a quantidade de requisições registradas pelo dublê de `fetch`.
 *
 * @param {{ calls: Array<object> }} fetchDouble
 * @param {number} expected
 * @param {{ timeoutMs?: number }} [options]
 */
export function waitForRequestCount(fetchDouble, expected, options) {
  return waitFor(
    () => (fetchDouble.calls.length >= expected ? fetchDouble.calls : false),
    `${expected} requisição(ões) sair(em)`,
    options,
  );
}

/**
 * Espera a requisição de índice `index` ser abortada.
 *
 * É a espera da corrida do RF-25: a busca antiga precisa morrer antes de a nova
 * responder, senão a resposta velha desenha por cima da certa.
 *
 * @param {{ calls: Array<{ signal?: AbortSignal }> }} fetchDouble
 * @param {number} index
 * @param {{ timeoutMs?: number }} [options]
 */
export function waitForAbort(fetchDouble, index, options) {
  return waitFor(
    () => fetchDouble.calls[index]?.signal?.aborted === true,
    `a requisição ${index} ser abortada`,
    options,
  );
}
