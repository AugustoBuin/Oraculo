/**
 * Dublê de `fetch`.
 *
 * Interceptar a **fronteira da rede** faz o código real rodar inteiro:
 * montagem de URL, cabeçalhos, serialização e tradução de erro. Substituir o
 * nosso cliente por um dublê testaria o dublê (PADROES-ENGENHARIA.md §13.3).
 *
 * Requisição não prevista **falha** o teste em vez de passar em silêncio — é a
 * diferença entre um teste que protege e um que dá conforto.
 */

export function fetchDouble() {
  const routes = new Map();
  const calls = [];
  const unexpected = [];
  const original = window.fetch;

  window.fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    const parsed = new URL(url, window.location.origin);
    const key = `${method} ${parsed.pathname}`;

    calls.push({
      url,
      path: parsed.pathname,
      search: parsed.search,
      method,
      headers: init.headers ?? {},
      body: init.body,
      credentials: init.credentials,
      signal: init.signal,
    });

    const spec = routes.get(key);

    if (spec === undefined) {
      unexpected.push(key);
      throw new Error(`Requisição não prevista pelo teste: ${key}`);
    }

    // Resposta que nunca chega, para exercitar o teto de espera e o
    // cancelamento. Respeita o sinal, como o fetch de verdade.
    if (spec.hang === true) {
      return new Promise((_, reject) => {
        init.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("A requisição foi abortada.", "AbortError")),
          { once: true },
        );
      });
    }

    if (spec.networkFailure === true) {
      throw new TypeError("Failed to fetch");
    }

    // `Response` é do navegador: status e leitura de corpo são os de verdade.
    return new Response(spec.body ?? null, {
      status: spec.status ?? 200,
      headers: spec.headers ?? { "Content-Type": "application/json" },
    });
  };

  return {
    /** Registra o que responder para um método e caminho. */
    on(method, path, spec) {
      routes.set(`${method} ${path}`, spec);
      return this;
    },

    /** Registra uma resposta JSON de sucesso. */
    onJson(method, path, data, status = 200) {
      return this.on(method, path, { status, body: JSON.stringify(data) });
    },

    calls,
    unexpected,

    get lastCall() {
      return calls[calls.length - 1];
    },

    /** Devolve o `fetch` original. Todo teste que instala precisa restaurar. */
    restore() {
      window.fetch = original;
    },
  };
}
