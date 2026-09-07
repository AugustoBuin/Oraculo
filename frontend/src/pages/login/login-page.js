/**
 * A página de entrada.
 *
 * A página **compõe**: monta os componentes na ordem certa e devolve a função
 * de limpeza. Não guarda regra de negócio, não faz estilização própria e não
 * fala com o servidor — isso é do formulário e da camada de dados (§2.2).
 */

import { loginForm } from "@/features/auth/components/login-form.js";
import { el } from "@/shared/dom/elements.js";
import { scope } from "@/shared/dom/events.js";

/**
 * @param {HTMLElement} root
 * @param {{ onAuthenticated: (user: object) => void, notice?: string }} config
 * @returns {() => void} a limpeza da tela
 */
export function loginPage(root, { onAuthenticated, notice }) {
  const life = scope();

  const form = loginForm({
    scope: life,
    onSuccess: onAuthenticated,
    notice,
  });

  root.replaceChildren(
    el("main", {
      classes: ["login-layout"],
      attrs: { id: "conteudo" },
      children: [el("div", { classes: ["login-card"], children: [form.node] })],
    }),
  );

  form.focus();

  return () => life.dispose();
}
