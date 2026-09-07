/**
 * Botão de tema.
 *
 * Cicla entre as três preferências, e **"sistema" é uma delas** — não um
 * estado inicial que se perde no primeiro clique. Quem configurou o sistema
 * operacional para escurecer ao anoitecer espera que o portal acompanhe, e um
 * botão de dois estados tira essa opção para sempre.
 */

import { button } from "@/shared/components/button.js";
import { THEME_PREFERENCES } from "@/shared/config/constants.js";
import {
  onSystemThemeChange,
  readPreference,
  resolveTheme,
  setPreference,
} from "@/shared/theme/theme.js";

/** A ordem do ciclo, e o rótulo de cada parada. */
const CYCLE = [
  { preference: THEME_PREFERENCES.SYSTEM, label: "Tema: sistema", icon: "◐" },
  { preference: THEME_PREFERENCES.LIGHT, label: "Tema: claro", icon: "☀" },
  { preference: THEME_PREFERENCES.DARK, label: "Tema: escuro", icon: "☾" },
];

const nextIn = (preference) => {
  const index = CYCLE.findIndex((step) => step.preference === preference);

  return CYCLE[(index + 1) % CYCLE.length];
};

export function themeToggle({ scope }) {
  const control = button({
    label: "Tema",
    variant: "ghost",
    scope,
    onClick: () => {
      apply(nextIn(readPreference()).preference);
    },
  });

  function apply(preference) {
    const saved = setPreference(preference);
    render(saved);
  }

  function render(preference) {
    const step = CYCLE.find((item) => item.preference === preference) ?? CYCLE[0];
    const resolved = resolveTheme(preference);
    const upcoming = nextIn(preference);

    control.node.textContent = `${step.icon} ${step.label}`;

    // O rótulo diz o ESTADO; o aria-label diz a AÇÃO. Sem os dois, quem usa
    // leitor de tela ouve "Tema: sistema" e não sabe o que o clique faz.
    control.node.setAttribute("aria-label", `${step.label}. Alternar para ${upcoming.label}.`);
    control.node.setAttribute("title", `Alternar para ${upcoming.label}`);
    control.node.dataset.resolvedTheme = resolved;
  }

  render(readPreference());

  // Se o sistema trocar sozinho ao anoitecer e a preferência for "sistema", o
  // rótulo precisa acompanhar — senão fica dizendo o tema errado.
  scope.add(
    onSystemThemeChange(() => {
      if (readPreference() === THEME_PREFERENCES.SYSTEM) {
        render(THEME_PREFERENCES.SYSTEM);
      }
    }),
  );

  return { node: control.node };
}
