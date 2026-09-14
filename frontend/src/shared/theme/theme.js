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
import { readPreference as readStored, writePreference } from "@/shared/storage/preference.js";

const THEME_ATTRIBUTE = "data-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** As preferências aceitas. Qualquer outro valor é descartado. */
const VALID_PREFERENCES = Object.values(THEME_PREFERENCES);

/**
 * A preferência guardada, ou o padrão.
 *
 * A leitura protegida e a allowlist moram em `shared/storage/preference.js`,
 * que a visão da listagem também usa: o acesso a `localStorage` pode LANÇAR, e
 * duplicar esse try/catch por preferência é como um deles acaba sem ele.
 */
export function readPreference() {
  return readStored(STORAGE_KEYS.themePreference, VALID_PREFERENCES, THEME_PREFERENCES.SYSTEM);
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
  writePreference(STORAGE_KEYS.themePreference, safe, VALID_PREFERENCES);

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
