/**
 * Preferência de tema: leitura, aplicação e persistência.
 *
 * A divisão de trabalho com o CSS é deliberada (`styles/tokens.css`):
 *
 *   - **O CSS resolve o padrão.** Sem atributo nenhum no `<html>`, a media
 *     query `prefers-color-scheme` já pinta o tema do sistema. Quem nunca
 *     escolheu — a maioria — não depende deste módulo para nada, e por isso
 *     não vê piscada de tema no carregamento.
 *   - **O JavaScript resolve a exceção.** Só quem escolheu explicitamente um
 *     tema diferente do sistema precisa do atributo `data-theme`, e só esse
 *     caso pode ver um quadro com o tema anterior antes da troca. É o preço de
 *     não usar script inline, que a Content-Security-Policy de F-051 recusa.
 */

import { STORAGE_KEYS, THEME_PREFERENCES } from "@/shared/config/constants.js";

const THEME_ATTRIBUTE = "data-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** As preferências aceitas. Qualquer outro valor é descartado. */
const VALID_PREFERENCES = Object.values(THEME_PREFERENCES);

/**
 * O armazenamento pode simplesmente não existir.
 *
 * Em janela anônima, com dados do site bloqueados ou em alguns contextos de
 * captura, o próprio acesso a `localStorage` **lança** — não devolve nulo. Ler
 * e gravar sem proteção aqui derruba o boot inteiro por causa de uma
 * preferência de cor (§8.5).
 */
function readStoredPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.themePreference);
  } catch {
    return null;
  }
}

function writeStoredPreference(preference) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.themePreference, preference);
  } catch {
    // Preferência não persistida não é falha de fluxo: a sessão corrente
    // continua com o tema certo, e a próxima volta ao padrão do sistema.
  }
}

/**
 * A preferência guardada, ou o padrão.
 *
 * O valor vem do armazenamento, que é dado de fora e não é confiável nem por
 * formato: qualquer coisa fora da allowlist vira `SYSTEM` em vez de virar um
 * `data-theme="<lixo>"` no `<html>` (§8.5).
 */
export function readPreference() {
  const stored = readStoredPreference();

  return VALID_PREFERENCES.includes(stored) ? stored : THEME_PREFERENCES.SYSTEM;
}

/**
 * O tema que está de fato em vigor, resolvendo `SYSTEM` contra o sistema
 * operacional. É o que o botão de troca precisa saber para dizer para onde
 * vai levar.
 */
export function resolveTheme(preference = readPreference()) {
  if (preference !== THEME_PREFERENCES.SYSTEM) {
    return preference;
  }

  return window.matchMedia(DARK_QUERY).matches
    ? THEME_PREFERENCES.DARK
    : THEME_PREFERENCES.LIGHT;
}

/**
 * Escreve a preferência no documento.
 *
 * `SYSTEM` **remove** o atributo em vez de escrever um valor: é a ausência que
 * devolve a decisão à media query. Escrever `data-theme="system"` deixaria as
 * duas regras do CSS sem efeito e travaria a página no tema claro.
 */
export function applyPreference(preference) {
  const root = document.documentElement;

  if (preference === THEME_PREFERENCES.SYSTEM) {
    root.removeAttribute(THEME_ATTRIBUTE);
    return;
  }

  root.setAttribute(THEME_ATTRIBUTE, preference);
}

/** Aplica e persiste a escolha do usuário. */
export function setPreference(preference) {
  const safe = VALID_PREFERENCES.includes(preference)
    ? preference
    : THEME_PREFERENCES.SYSTEM;

  applyPreference(safe);
  writeStoredPreference(safe);

  return safe;
}

/**
 * Avisa quando o sistema operacional troca de tema.
 *
 * Só interessa enquanto a preferência é `SYSTEM`: nos outros casos o CSS já
 * ignora o sistema. Serve para o botão de troca não ficar mostrando um rótulo
 * velho quando o sistema muda sozinho ao anoitecer.
 *
 * Devolve a função de limpeza — quem assina é obrigado a guardá-la (§12.4).
 */
export function onSystemThemeChange(listener) {
  const query = window.matchMedia(DARK_QUERY);
  const handler = (event) => {
    listener(event.matches ? THEME_PREFERENCES.DARK : THEME_PREFERENCES.LIGHT);
  };

  query.addEventListener("change", handler);

  return () => query.removeEventListener("change", handler);
}

/**
 * Chamado uma vez no boot. Devolve a preferência em vigor.
 */
export function initTheme() {
  const preference = readPreference();

  applyPreference(preference);

  return preference;
}
