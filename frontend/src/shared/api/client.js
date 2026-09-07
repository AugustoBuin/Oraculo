/**
 * O cliente HTTP único.
 *
 * Nenhuma chamada de rede crua existe dentro de componente ou de página
 * (PADROES-ENGENHARIA.md §5.1). Este ponto único é o que torna possível
 * acrescentar telemetria, repetição ou tratamento de sessão depois **sem
 * varrer o projeto** — e é onde o token CSRF, o teto de espera e a tradução de
 * erro moram uma vez só.
 */

import { API_BASE } from "@/shared/api/endpoints.js";
import {
  ApiError,
  MALFORMED_MESSAGE,
  NetworkError,
  TimeoutError,
  messageForStatus,
} from "@/shared/api/errors.js";
import { getCsrfToken } from "@/shared/api/csrf.js";
import { REQUEST_TIMEOUT_MS } from "@/shared/config/constants.js";

/** Os métodos que alteram estado e por isso exigem o token anti-CSRF. */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Para onde a falha vai ser avisada ao usuário.
 *
 * Injetado pelo shell (F-011) em vez de importado, porque o contrário faria a
 * camada compartilhada conhecer um componente de interface — e a dependência
 * aponta para dentro (§2.1). Enquanto ninguém registra nada, o cliente só
 * lança, que é o comportamento correto para quem chama tratar.
 */
let reportError = null;

export function setErrorReporter(reporter) {
  reportError = typeof reporter === "function" ? reporter : null;
}

/**
 * Monta a URL a partir do caminho nomeado e dos parâmetros.
 *
 * Parâmetro vazio é **omitido**, não enviado em branco: `?search=` faria o
 * servidor filtrar por string vazia em vez de não filtrar. `URLSearchParams`
 * cuida do escape, inclusive de acento — nome de carta em português passa por
 * aqui (§8.6: API nativa antes de pacote).
 */
export function buildUrl(path, params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    query.set(key, String(value));
  }

  const suffix = query.toString();

  return `${API_BASE}${path}${suffix === "" ? "" : `?${suffix}`}`;
}

function buildHeaders(method, body, extra) {
  const headers = { Accept: "application/json", ...extra };

  // `FormData` precisa que o navegador escreva o Content-Type sozinho: ele
  // carrega o delimitador (boundary), que nós não temos como saber. Escrever
  // à mão aqui quebraria todo upload de imagem (F-032).
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  /*
   * O token vai em toda escrita — quando existe.
   *
   * O login é o único isento, e a isenção acontece sozinha: ele é a rota que
   * EMITE o token, então antes dele não há nada em memória para mandar. Não
   * precisa de exceção escrita, que é sempre a exceção que alguém esquece de
   * revisar depois (`docs/api-contract.md` §3.1).
   */
  const token = getCsrfToken();

  if (WRITE_METHODS.has(method) && token !== null) {
    headers["X-CSRF-Token"] = token;
  }

  return headers;
}

/**
 * Lê o corpo com proteção.
 *
 * Toda leitura de resposta pode falhar, e desserialização de corpo malformado
 * precisa de mensagem de reserva (§7.3). `204` e corpo vazio devolvem `null` —
 * `JSON.parse("")` lançaria, e o logout, que responde 204, quebraria.
 */
async function readBody(response) {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (text.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined; // sinaliza "veio corpo, mas não é JSON"
  }
}

/**
 * Faz a requisição.
 *
 * @param {string} path caminho vindo de `API_ENDPOINTS`, nunca escrito à mão
 * @param {{
 *   method?: string,
 *   body?: unknown,
 *   params?: Record<string, unknown>,
 *   signal?: AbortSignal,
 *   headers?: Record<string, string>,
 *   timeoutMs?: number,
 *   silent?: boolean,
 * }} [options]
 */
export async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    params,
    signal,
    headers,
    timeoutMs = REQUEST_TIMEOUT_MS,
    silent = false,
  } = options;

  const url = buildUrl(path, params);
  const controller = new AbortController();

  let timedOut = false;

  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Encadeia o cancelamento de quem chamou. O listener é removido no `finally`
  // — um sinal de vida longa (o da tela) acumularia um listener por requisição
  // sem isso, que é o vazamento do §12.4 na sua forma mais discreta.
  const forwardAbort = () => controller.abort();

  if (signal !== undefined) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", forwardAbort, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: buildHeaders(method, body, headers),
      body: serialize(body),
      signal: controller.signal,
      // Mesma origem: o cookie de sessão viaja sozinho e não há CORS no meio
      // (ADR-003). "include" seria pedir o que não é necessário.
      credentials: "same-origin",
    });

    const payload = await readBody(response);

    if (!response.ok) {
      throw toApiError(response, payload);
    }

    if (payload === undefined) {
      throw new ApiError(response.status, MALFORMED_MESSAGE);
    }

    return payload;
  } catch (error) {
    throw handle(error, { timedOut, timeoutMs, signal, silent });
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

function serialize(body) {
  if (body === undefined) {
    return undefined;
  }

  return body instanceof FormData ? body : JSON.stringify(body);
}

function toApiError(response, payload) {
  // A mensagem do servidor tem precedência: ela é específica e segura por
  // contrato ("A edição selecionada não pertence ao jogo escolhido" diz muito
  // mais do que "Verifique os campos destacados"). O mapa por status é a
  // reserva para quando ela não vem.
  const message =
    typeof payload?.message === "string" && payload.message.trim() !== ""
      ? payload.message
      : messageForStatus(response.status);

  return new ApiError(response.status, message, {
    errors: payload?.errors ?? null,
    body: payload ?? null,
  });
}

function handle(error, { timedOut, timeoutMs, signal, silent }) {
  /*
   * Cancelamento DELIBERADO não é erro e não pode virar mensagem.
   *
   * É o caminho normal da cascata: trocar de jogo aborta a busca anterior
   * (RF-25), e a tela morrer aborta o que estava em voo. Mostrar "falha de
   * rede" aí seria assustar o usuário com o funcionamento correto. O erro é
   * repassado como está, e quem chamou reconhece o próprio cancelamento.
   */
  if (signal?.aborted && !timedOut) {
    return error;
  }

  const translated = timedOut
    ? new TimeoutError(timeoutMs)
    : error instanceof ApiError
      ? error
      : new NetworkError(error);

  if (!silent && reportError !== null) {
    reportError(translated);
  }

  return translated;
}

/** Açúcar para os verbos, para nenhuma chamada precisar escrever o método. */
export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};
