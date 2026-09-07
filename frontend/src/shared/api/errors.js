/**
 * Os erros da camada de dados e o mapa único de mensagens.
 *
 * Os dois moram juntos porque a garantia que interessa depende dos dois ao
 * mesmo tempo: **só texto que passou por aqui chega à tela**. Um `TypeError`
 * de programação não vira "Cannot read properties of undefined" na cara do
 * usuário; vira a reserva genérica, e o detalhe vai para o console
 * (PADROES-ENGENHARIA.md §7.1 e §7.2).
 *
 * Nunca chegam à tela: nome de tabela ou coluna, texto de driver, `SQLSTATE`,
 * caminho de arquivo, stack trace, `undefined`, `null` ou `[object Object]`.
 */

/**
 * Status sintético para falha que nunca chegou a ter resposta HTTP.
 *
 * Rede caída e tempo esgotado não têm status. Zero os agrupa sem inventar um
 * código real, e mantém `error.status` sempre presente para quem faz `switch`.
 */
export const NO_HTTP_STATUS = 0;

export const FALLBACK_MESSAGE = "Não foi possível concluir a operação. Tente novamente.";

export const NETWORK_MESSAGE =
  "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.";

export const TIMEOUT_MESSAGE = "O servidor demorou demais para responder. Tente novamente.";

export const MALFORMED_MESSAGE = "O servidor devolveu uma resposta inesperada. Tente novamente.";

/**
 * Mensagem por status, usada quando o servidor não manda `message`.
 *
 * O contrato diz que ele sempre manda (`docs/api-contract.md` §1.3), mas falha
 * de infraestrutura escapa do contrato — e é justamente quando uma tela sem
 * texto seria pior.
 *
 * O 401 e o 403 dizem coisas diferentes de propósito: o primeiro leva ao
 * login, o segundo não (ADR-007).
 */
export const STATUS_MESSAGES = {
  400: "Verifique os campos destacados.",
  401: "Sua sessão expirou. Entre novamente.",
  403: "Você não tem permissão para esta operação.",
  404: "Não encontramos o que você procura.",
  409: "Esta operação conflita com o estado atual do catálogo.",
  413: "O arquivo é maior que o limite permitido.",
  415: "Este tipo de arquivo não é aceito.",
  429: "Muitas tentativas. Tente novamente em alguns minutos.",
  500: "Algo deu errado do nosso lado. Tente novamente em instantes.",
};

export function messageForStatus(status) {
  return STATUS_MESSAGES[status] ?? FALLBACK_MESSAGE;
}

/**
 * Falha de aplicação, já traduzida para texto exibível.
 *
 * `status` permite à interface decidir o fluxo — 401 leva ao login, 403 não —
 * e `errors` carrega o mapa por campo para o formulário ancorar a mensagem no
 * input certo (`docs/api-contract.md` §1.3).
 */
export class ApiError extends Error {
  constructor(status, message, { errors = null, body = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.body = body;
  }

  /** Sessão ausente ou expirada: tem fluxo próprio, não é erro inesperado. */
  get isUnauthorized() {
    return this.status === 401;
  }

  /** Sessão válida, nível insuficiente. **Não** desloga (ADR-007). */
  get isForbidden() {
    return this.status === 403;
  }

  get isConflict() {
    return this.status === 409;
  }
}

/** A requisição não chegou ao servidor. */
export class NetworkError extends ApiError {
  constructor(cause) {
    super(NO_HTTP_STATUS, NETWORK_MESSAGE);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/** O servidor não respondeu dentro do teto. */
export class TimeoutError extends ApiError {
  constructor(timeoutMs) {
    super(NO_HTTP_STATUS, TIMEOUT_MESSAGE);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * O texto seguro para mostrar, dado um erro qualquer.
 *
 * A checagem de tipo é o ponto da função, não uma formalidade: só `ApiError`
 * carrega mensagem que nós construímos e sabemos ser segura. Qualquer outra
 * coisa — `TypeError`, erro de biblioteca do navegador, o que for — sai como a
 * reserva genérica, com o detalhe registrado para quem desenvolve.
 */
export function userMessage(error) {
  if (error instanceof ApiError && typeof error.message === "string" && error.message !== "") {
    return error.message;
  }

  console.error("[api] erro sem mensagem segura; exibindo a reserva", { error });

  return FALLBACK_MESSAGE;
}
