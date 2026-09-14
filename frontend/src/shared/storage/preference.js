/**
 * Preferências de interface no armazenamento do navegador.
 *
 * **O acesso é protegido nos dois sentidos.** Em janela anônima, com dados do
 * site bloqueados ou em alguns contextos de captura, o próprio acesso a
 * `localStorage` **lança** — não devolve nulo. Ler sem proteção derruba a tela
 * por causa de uma preferência de cor ou de visualização
 * (PADROES-ENGENHARIA.md §8.5).
 *
 * **Só preferência entra aqui.** Nada de token, dado pessoal ou dado de carta:
 * o armazenamento é lido por qualquer XSS, e o que não está lá não vaza
 * (§8.4, §8.7).
 */

/**
 * Lê um valor, validado contra a lista do que é aceito.
 *
 * O armazenamento é dado de fora e não é confiável nem por formato: sem a
 * allowlist, o que estiver lá viraria um `data-theme="<lixo>"` no `<html>` ou
 * uma visão de listagem que não existe.
 */
export function readPreference(key, allowed, fallback) {
  try {
    const stored = window.localStorage.getItem(key);

    return allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Grava um valor, se ele for aceito.
 *
 * Falhar em persistir não é falha de fluxo: a sessão corrente continua com a
 * escolha certa, e a próxima volta ao padrão.
 */
export function writePreference(key, value, allowed) {
  if (!allowed.includes(value)) {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);

    return true;
  } catch {
    return false;
  }
}
