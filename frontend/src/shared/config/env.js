/**
 * O ponto único de configuração, validado no boot.
 *
 * **Por que este arquivo não lê variável de ambiente.** O `PADROES-ENGENHARIA.md`
 * §4.4 manda toda configuração que muda entre ambientes vir de variável de
 * ambiente, validada em um módulo só. Aqui não sobrou nenhuma: frontend e API
 * compartilham a mesma origem (docs/decisions/ADR-003), então o endereço da API
 * é o caminho relativo `/api` em qualquer ambiente, e não há segredo do lado do
 * cliente por definição (§8.2). Gerar um `config.js` no build ou servir um
 * `/config.json` para transportar zero variável seria cerimônia.
 *
 * **O que sobrou, e por que ainda vale um validador.** O que este módulo protege
 * é a *forma* da configuração. Um `DEFAULT_PAGE_SIZE` apagado numa refatoração
 * não quebra nada no carregamento: vira `undefined`, atravessa a montagem da
 * query string e chega ao servidor como `perPage=undefined`, que responde 400 no
 * meio de uma tela pronta. Falhar no boot nomeando a chave troca esse defeito
 * silencioso por uma mensagem que diz o que fazer — que é exatamente o que o
 * §4.4 quer.
 */

import { API_BASE, API_ENDPOINTS } from "@/shared/api/endpoints.js";
import {
  CARD_SORT_OPTIONS,
  DEFAULT_CARD_SORT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PERMISSION_LEVELS,
  REQUEST_TIMEOUT_MS,
} from "@/shared/config/constants.js";

/**
 * Falha de configuração.
 *
 * Separada de qualquer outro erro porque tem um tratamento próprio: não há o
 * que o usuário possa tentar de novo, e a aplicação não sobe.
 */
export class ConfigError extends Error {
  constructor(key, reason) {
    super(`Configuração inválida em "${key}": ${reason}.`);
    this.name = "ConfigError";
    this.key = key;
  }
}

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

/**
 * As regras, na ordem em que são conferidas.
 *
 * A ordem importa onde uma regra depende da outra: não faz sentido conferir o
 * tamanho de página padrão contra um teto que ainda não se sabe válido.
 *
 * @type {ReadonlyArray<{ key: string, check: () => string | null }>}
 */
const RULES = [
  {
    key: "API_BASE",
    check: () => {
      if (typeof API_BASE !== "string" || API_BASE === "") {
        return "esperado um caminho não vazio";
      }
      // Um endereço absoluto aqui reintroduziria CORS, preflight e
      // SameSite=None — os três problemas que a mesma origem elimina.
      return API_BASE.startsWith("/") ? null : "esperado um caminho relativo, iniciado por /";
    },
  },
  {
    key: "API_ENDPOINTS",
    check: () => {
      const required = [
        ["auth", "login"],
        ["auth", "session"],
        ["cards", "list"],
        ["catalogs", "games"],
        ["uploads", "cardImage"],
      ];

      for (const [group, name] of required) {
        if (API_ENDPOINTS?.[group]?.[name] === undefined) {
          return `faltando a rota ${group}.${name}`;
        }
      }

      return null;
    },
  },
  {
    key: "MAX_PAGE_SIZE",
    check: () => (isPositiveInteger(MAX_PAGE_SIZE) ? null : "esperado um inteiro positivo"),
  },
  {
    key: "DEFAULT_PAGE_SIZE",
    check: () => {
      if (!isPositiveInteger(DEFAULT_PAGE_SIZE)) {
        return "esperado um inteiro positivo";
      }
      return DEFAULT_PAGE_SIZE <= MAX_PAGE_SIZE ? null : `não pode passar de ${MAX_PAGE_SIZE}`;
    },
  },
  {
    key: "REQUEST_TIMEOUT_MS",
    check: () => (isPositiveInteger(REQUEST_TIMEOUT_MS) ? null : "esperado um inteiro positivo"),
  },
  {
    key: "PERMISSION_LEVELS",
    check: () => {
      const { VIEWER, EDITOR, ADMIN } = PERMISSION_LEVELS ?? {};

      if (![VIEWER, EDITOR, ADMIN].every(isPositiveInteger)) {
        return "esperados VIEWER, EDITOR e ADMIN inteiros positivos";
      }
      // Os níveis são hierárquicos e comparados por valor (ADR-006). Fora de
      // ordem, ADMIN deixaria de alcançar o que EDITOR alcança — em silêncio.
      return VIEWER < EDITOR && EDITOR < ADMIN ? null : "esperado VIEWER < EDITOR < ADMIN";
    },
  },
  {
    key: "DEFAULT_CARD_SORT",
    check: () =>
      CARD_SORT_OPTIONS.includes(DEFAULT_CARD_SORT)
        ? null
        : `esperado um valor da allowlist: ${CARD_SORT_OPTIONS.join(", ")}`,
  },
];

/**
 * Confere a configuração inteira e devolve o objeto congelado.
 *
 * Lança na primeira regra violada, nomeando a chave — quem lê o erro sabe o que
 * abrir. Congelado porque configuração alterada em tempo de execução é uma
 * segunda fonte de verdade esperando divergir (§6.2).
 *
 * @throws {ConfigError}
 */
export function loadConfig() {
  for (const { key, check } of RULES) {
    const reason = check();

    if (reason !== null) {
      throw new ConfigError(key, reason);
    }
  }

  return Object.freeze({
    apiBase: API_BASE,
    endpoints: API_ENDPOINTS,
    defaultPageSize: DEFAULT_PAGE_SIZE,
    maxPageSize: MAX_PAGE_SIZE,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    permissionLevels: PERMISSION_LEVELS,
    cardSortOptions: CARD_SORT_OPTIONS,
    defaultCardSort: DEFAULT_CARD_SORT,
  });
}
