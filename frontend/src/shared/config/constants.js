/**
 * Os valores que carregam significado de negócio, agrupados por contexto.
 *
 * Nenhum deles é escrito solto no meio de um componente. A regra do
 * `PADROES-ENGENHARIA.md` §4.3 é direta: comparar contra literal espalhado
 * (`user.role === "ADMIN"`, `perPage = 20`) é achado CRÍTICO, porque o dia em
 * que o valor muda ninguém encontra todas as cópias.
 */

/** Tamanho de página do contrato (`docs/api-contract.md` §5). */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * O servidor **trunca** acima disto em vez de recusar, mas mandar 500 e
 * receber 100 de volta faria a paginação da tela mentir sobre o que pediu.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Teto de espera de uma requisição antes do cancelamento.
 *
 * Existe para que uma rede ruim vire mensagem de erro acionável em vez de uma
 * tela girando para sempre (§5.1).
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Os três níveis, hierárquicos, com os mesmos inteiros de `users.role_level`.
 *
 * Espelham `App\Shared\Enum\PermissionLevel` (docs/decisions/ADR-006). São
 * usados **apenas** para mostrar ou esconder elemento: a decisão de autorização
 * é do servidor, a cada requisição (§8.1). Esconder um botão é conveniência
 * visual; quem chamar a rota direto recebe 403 do mesmo jeito.
 */
export const PERMISSION_LEVELS = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
};

/** Rótulos em português, como todo texto de interface (§3.1). */
export const PERMISSION_LABELS = {
  VIEWER: "Consulta",
  EDITOR: "Editor",
  ADMIN: "Administrador",
};

/**
 * A allowlist de ordenação do contrato.
 *
 * É o único ponto do sistema onde algo do cliente chega perto de um nome de
 * coluna. O servidor recusa valor fora dela com 400; o cliente não deve nem
 * oferecer o que seria recusado.
 */
export const CARD_SORT_OPTIONS = ["recent", "name", "game"];

export const DEFAULT_CARD_SORT = "recent";

/**
 * Por quanto tempo cada tipo de leitura serve.
 *
 * Toda leitura remota declara isto **explicitamente**: leitura sem política de
 * validade é achado ALTO em auditoria (§5.4 e §17.1). Os valores seguem a
 * tabela do §5.4 — catálogo é quase estático, listagem de domínio é curta e
 * revalidada ao voltar à tela, e a sessão vale até o logout ou um 401.
 */
export const CACHE_TTL_MS = {
  /** Jogos, edições e raridades: mudam por operação de ADMIN, e raramente. */
  catalogs: 60 * 60 * 1000,

  /** Listagem de cartas: curta, porque um editor ao lado pode ter alterado. */
  cards: 60 * 1000,

  /** Uma carta específica, aberta para ver ou editar. */
  card: 30 * 1000,

  /**
   * A sessão não vence por tempo: vence por evento — logout ou 401. Um prazo
   * aqui provocaria uma releitura inútil no meio do uso.
   */
  session: Infinity,
};

/**
 * As três preferências de tema.
 *
 * `SYSTEM` é o padrão e não é a mesma coisa que `LIGHT`: ele acompanha o
 * sistema operacional pela media query, sem JavaScript nenhum — é o que evita
 * a piscada de tema no carregamento para quem nunca escolheu (`tokens.css`).
 */
export const THEME_PREFERENCES = {
  SYSTEM: "system",
  LIGHT: "light",
  DARK: "dark",
};

/**
 * As chaves do armazenamento do navegador.
 *
 * Prefixadas para não colidir com nada de outra aplicação servida da mesma
 * origem. Nenhuma delas guarda dado pessoal, token ou dado de carta: só
 * preferência de interface (§8.7).
 */
export const STORAGE_KEYS = {
  themePreference: "oraculo:theme",
};
