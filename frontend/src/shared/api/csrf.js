/**
 * O token anti-CSRF, guardado **em memória**.
 *
 * Não vai para `localStorage` nem para `sessionStorage`: qualquer XSS lê os
 * dois instantaneamente, e um token de escrita ali é a diferença entre um
 * script injetado poder ler e poder **alterar** o catálogo
 * (PADROES-ENGENHARIA.md §8.4).
 *
 * O custo dessa escolha é que recarregar a página perde o token — e é por isso
 * que o boot chama `GET /api/auth/session`, que o devolve junto com o usuário
 * (`docs/api-contract.md` §3.1). O cookie de sessão é `HttpOnly` e o
 * JavaScript nunca o lê; ele viaja sozinho, por conta do navegador.
 */

let token = null;

/** Guarda o token devolvido pelo login ou pela leitura da sessão. */
export function setCsrfToken(value) {
  token = typeof value === "string" && value !== "" ? value : null;
}

export function getCsrfToken() {
  return token;
}

/**
 * Esquece o token.
 *
 * Chamado no logout e em toda falha de sessão. Logout parcial é vazamento
 * entre usuários no mesmo navegador (§8.4).
 */
export function clearCsrfToken() {
  token = null;
}
