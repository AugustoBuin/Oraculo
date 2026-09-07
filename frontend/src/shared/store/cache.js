/**
 * Cache de leitura remota, com deduplicação de chamadas em voo.
 *
 * É o que as bibliotecas de cache fazem, e cabe em um arquivo
 * (PADROES-ENGENHARIA.md §5.5). Resolve as duas armadilhas que o §5.4 nomeia:
 *
 *   - **Chave instável.** A chave é montada só de primitivos, e `cacheKey()`
 *     recusa objeto. Objeto novo a cada render é chave nova, é cache que nunca
 *     acerta — e o sintoma é uma tela lenta sem erro nenhum no console.
 *   - **Invalidação larga demais.** `invalidate()` recebe prefixo e derruba o
 *     escopo mínimo. Limpar tudo a cada mutação transforma cache em enfeite.
 */

const KEY_SEPARATOR = "|";

/**
 * Monta a chave a partir de valores primitivos.
 *
 * Recusar objeto é o ponto da função, não uma preciosidade: passar
 * `{ page, perPage }` funcionaria — e produziria uma chave diferente a cada
 * render, sem nunca dar erro.
 */
export function cacheKey(...parts) {
  return parts
    .map((part) => {
      if (part === null || part === undefined) {
        return "";
      }

      const type = typeof part;

      if (type === "string" || type === "number" || type === "boolean") {
        return String(part);
      }

      throw new TypeError(
        "Chave de cache aceita apenas primitivos. Objeto recriado a cada render " +
          "vira chave nova e o cache nunca acerta (§5.4).",
      );
    })
    .join(KEY_SEPARATOR);
}

export function createCache({ now = () => Date.now() } = {}) {
  /** @type {Map<string, { data: unknown, storedAt: number, ttlMs: number }>} */
  const entries = new Map();

  /** @type {Map<string, Promise<unknown>>} */
  const inFlight = new Map();

  const isFresh = (entry) => entry !== undefined && now() - entry.storedAt < entry.ttlMs;

  return {
    /**
     * Lê do cache ou carrega — e **nunca dispara dois carregamentos iguais**.
     *
     * Vários componentes irmãos pedindo o mesmo dado na mesma tela geram
     * requisições repetidas e estados divergentes (§5.5). Guardar a promessa
     * em voo e devolvê-la faz os dois esperarem a mesma resposta.
     *
     * @param {string} key vinda de `cacheKey()`
     * @param {() => Promise<unknown>} loader
     * @param {{ ttlMs: number }} policy validade explícita, sem padrão
     */
    async fetchOnce(key, loader, { ttlMs }) {
      if (ttlMs === undefined) {
        // Leitura sem política declarada é achado ALTO (§17.1). Falhar aqui é
        // mais barato do que descobrir na auditoria.
        throw new TypeError(`A leitura "${key}" precisa declarar ttlMs (§5.4).`);
      }

      const entry = entries.get(key);

      if (isFresh(entry)) {
        return entry.data;
      }

      const pending = inFlight.get(key);

      if (pending !== undefined) {
        return pending;
      }

      const promise = loader()
        .then((data) => {
          entries.set(key, { data, storedAt: now(), ttlMs });
          return data;
        })
        .finally(() => {
          // Sai de "em voo" mesmo em caso de falha: senão a chave ficaria
          // travada devolvendo para sempre a mesma promessa rejeitada, e a
          // ação de "tentar novamente" não tentaria nada.
          inFlight.delete(key);
        });

      inFlight.set(key, promise);

      return promise;
    },

    /** O que está guardado e ainda vale, sem disparar carregamento. */
    peek(key) {
      const entry = entries.get(key);

      return isFresh(entry) ? entry.data : undefined;
    },

    /**
     * Derruba tudo que começa com o prefixo.
     *
     * Depois de salvar uma carta, `invalidate("cards")` basta — o cache de
     * catálogos continua de pé, porque alterar uma carta não muda a lista de
     * edições. Invalidação larga demais é achado ALTO (§17.1).
     */
    invalidate(prefix) {
      for (const key of entries.keys()) {
        if (key === prefix || key.startsWith(`${prefix}${KEY_SEPARATOR}`)) {
          entries.delete(key);
        }
      }
    },

    /**
     * Esvazia tudo.
     *
     * Chamado no logout: dado do usuário anterior que sobrevive à troca de
     * sessão é vazamento entre usuários no mesmo navegador (§8.4 e §8.7).
     */
    clear() {
      entries.clear();
      inFlight.clear();
    },

    get size() {
      return entries.size;
    },
  };
}

/**
 * O cache da aplicação.
 *
 * Um só, para que o dado tenha **uma** fonte por tela (§5.5). Instâncias
 * separadas por funcionalidade recriariam o problema que este arquivo resolve.
 */
export const cache = createCache();
