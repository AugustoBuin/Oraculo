/**
 * A sessão do usuário, em memória.
 *
 * **O que este módulo é:** a única fonte de verdade sobre quem está logado e o
 * único lugar do frontend onde nível de permissão é comparado.
 *
 * **O que este módulo NÃO é:** autorização. A decisão é do servidor, a cada
 * requisição. Aqui a permissão serve só para mostrar ou esconder elemento —
 * esconder um botão é conveniência visual, e quem chamar a rota direto recebe
 * 403 do mesmo jeito (PADROES-ENGENHARIA.md §8.1).
 */

import { clearCsrfToken, setCsrfToken } from "@/shared/api/csrf.js";
import { PERMISSION_LEVELS } from "@/shared/config/constants.js";
import { cache } from "@/shared/store/cache.js";
import { createStore } from "@/shared/store/store.js";

/**
 * O usuário corrente, observável.
 *
 * Store e não variável solta porque o shell precisa redesenhar a navegação
 * quando a sessão muda — e sincronizar isso à mão criaria a segunda fonte de
 * verdade que o §6.2 proíbe.
 */
const store = createStore({ user: null });

export const subscribeToSession = store.subscribe;

export function getUser() {
  return store.getState().user;
}

export function isAuthenticated() {
  return getUser() !== null;
}

/**
 * Guarda a sessão devolvida pelo login ou pela leitura da sessão.
 *
 * O token CSRF vai junto porque os dois nascem da mesma resposta e morrem
 * juntos — separá-los abriria a janela em que existe usuário sem token, e toda
 * escrita nessa janela levaria 403.
 */
export function setSession({ user, csrfToken }) {
  setCsrfToken(csrfToken);
  store.setState({ user: user ?? null });

  return getUser();
}

/**
 * Encerra a sessão **inteira**.
 *
 * Logout parcial é vazamento entre usuários no mesmo navegador (§8.4): sem
 * limpar o cache, a listagem de cartas do usuário anterior continuaria na
 * memória e apareceria para quem entrasse em seguida, antes da primeira
 * requisição responder.
 *
 * O cache é limpo aqui, e não por quem chama, de propósito: uma garantia de
 * segurança que depende de alguém lembrar de chamar duas funções é uma
 * garantia que um dia falha.
 */
export function clearSession() {
  clearCsrfToken();
  cache.clear();
  store.setState({ user: null });
}

/**
 * O nível corrente alcança o exigido?
 *
 * **É a única comparação de nível do frontend.** Qualquer `user.role === "ADMIN"`
 * espalhado é achado CRÍTICO em auditoria (§17.1), porque o dia em que os
 * papéis mudarem ninguém encontra todas as cópias.
 *
 * A comparação é por valor porque os níveis são hierárquicos: ADMIN faz tudo
 * que EDITOR faz, que faz tudo que VIEWER faz (ADR-006). Uma matriz de
 * permissões para três papéis encaixáveis seria indireção sem ganho.
 *
 * @param {"VIEWER" | "EDITOR" | "ADMIN"} required
 */
export function hasLevel(required) {
  const requiredLevel = PERMISSION_LEVELS[required];

  if (requiredLevel === undefined) {
    // Papel escrito errado devolveria `undefined`, e `n >= undefined` é falso:
    // a tela esconderia tudo em silêncio, e ninguém descobriria pelo uso.
    throw new TypeError(`Nível de permissão desconhecido: "${required}".`);
  }

  const user = getUser();

  return user !== null && typeof user.level === "number" && user.level >= requiredLevel;
}
