/**
 * Minha conta.
 *
 * Mostra quem está logado e permite trocar a própria senha. A página compõe e
 * devolve a limpeza; quem fala com o servidor é a camada de dados (§2.2).
 */

import { changePasswordForm } from "@/features/auth/components/change-password-form.js";
import { PERMISSION_LABELS } from "@/shared/config/constants.js";
import { el } from "@/shared/dom/elements.js";
import { scope } from "@/shared/dom/events.js";
import { getUser } from "@/shared/session/session.js";

/**
 * @param {HTMLElement} root
 * @param {{ onPasswordChanged: () => void }} config
 */
export function accountPage(root, { onPasswordChanged }) {
  const life = scope();
  const user = getUser();

  const form = changePasswordForm({ scope: life, onChanged: onPasswordChanged });

  root.replaceChildren(
    el("div", {
      classes: ["stack-loose"],
      children: [
        // A página é dona do `h1`, como as outras telas. Sem ele o primeiro
        // cabeçalho da tela era o `h2` da seção de dados, e o `h1` acabava
        // vindo de dentro do formulário — hierarquia invertida, e um título
        // de página que anunciava só metade do que a tela faz (§9.2).
        el("h1", { text: "Minha conta" }),
        el("div", {
          classes: ["account-layout"],
          children: [
            el("section", {
              classes: ["card", "stack"],
              attrs: { "aria-label": "Dados da conta" },
              children: [
                el("h2", { text: "Conta" }),
                // Nome e e-mail vão por textContent: são dado do banco, e nome
                // de usuário é campo editável em algum lugar do sistema.
                el("p", { text: user?.name ?? "—", classes: ["text-ink"] }),
                el("p", { text: user?.email ?? "—", classes: ["text-muted"] }),
                el("p", {
                  // O rótulo vem do mapa, não de uma comparação de papel
                  // escrita aqui — papel comparado inline é achado de
                  // auditoria (§17.1).
                  text: `Perfil: ${PERMISSION_LABELS[user?.role] ?? "—"}`,
                  classes: ["text-muted"],
                }),
              ],
            }),
            el("section", { classes: ["card"], children: [form.node] }),
          ],
        }),
      ],
    }),
  );

  return () => life.dispose();
}
