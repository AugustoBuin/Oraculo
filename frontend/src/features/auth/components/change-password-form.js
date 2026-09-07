/**
 * Troca da própria senha.
 *
 * **A operação encerra todas as sessões do usuário** (RF-05), inclusive a de
 * quem pediu. Isso não é efeito colateral: quem troca a senha quase sempre o
 * faz porque desconfia de acesso indevido, e trocar sem revogar deixaria o
 * invasor logado — dando à pessoa a sensação de estar protegida justamente
 * quando não está.
 *
 * Por isso a tela avisa o que vai acontecer **antes**, e não depois.
 */

import { button } from "@/shared/components/button.js";
import { field } from "@/shared/components/field.js";
import { inlineMessage } from "@/shared/components/feedback.js";
import { el } from "@/shared/dom/elements.js";
import { ApiError, userMessage } from "@/shared/api/errors.js";
import { changePassword } from "@/features/auth/api/auth-api.js";

const MIN_PASSWORD_LENGTH = 8;

/** Os campos que o servidor nomeia em `errors` (`api-contract.md` §3.2). */
const SERVER_FIELDS = ["currentPassword", "newPassword"];

export function changePasswordForm({ scope, onChanged }) {
  const current = field({
    id: "senha-atual",
    label: "Senha atual",
    type: "password",
    autocomplete: "current-password",
    required: true,
  });

  const next = field({
    id: "senha-nova",
    label: "Nova senha",
    type: "password",
    autocomplete: "new-password",
    required: true,
    hint: `Ao menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  });

  const confirmation = field({
    id: "senha-confirmacao",
    label: "Repita a nova senha",
    type: "password",
    autocomplete: "new-password",
    required: true,
  });

  const submit = button({ label: "Trocar a senha", variant: "primary", type: "submit" });
  const alertSlot = el("div", { classes: ["form-alert"] });

  const fieldsByServerName = { currentPassword: current, newPassword: next };

  const form = el("form", {
    attrs: { novalidate: true },
    classes: ["stack"],
    children: [
      el("h1", { text: "Trocar a senha" }),
      // O aviso vem antes da ação, não como surpresa depois dela.
      el("p", {
        text:
          "Ao trocar a senha, todas as sessões abertas são encerradas — inclusive esta. " +
          "Você vai precisar entrar novamente.",
        classes: ["text-muted"],
      }),
      alertSlot,
      current.wrapper,
      next.wrapper,
      confirmation.wrapper,
      submit.node,
    ],
  });

  let submitting = false;

  const clearErrors = () => {
    alertSlot.replaceChildren();
    current.clearError();
    next.clearError();
    confirmation.clearError();
  };

  function validate() {
    let valid = true;

    if (current.value === "") {
      current.setError("Informe a senha atual.");
      valid = false;
    }

    if (next.value.length < MIN_PASSWORD_LENGTH) {
      next.setError(`A nova senha precisa de ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      valid = false;
    } else if (next.value === current.value) {
      // O servidor também recusa (trocar por ela mesma revogaria as sessões
      // sem trocar nada); avisar aqui evita a ida e a revogação inútil.
      next.setError("A nova senha precisa ser diferente da atual.");
      valid = false;
    }

    // A confirmação é só do cliente: o servidor nunca a recebe, porque ela não
    // é um dado — é uma proteção contra erro de digitação.
    if (confirmation.value !== next.value) {
      confirmation.setError("As duas senhas não conferem.");
      valid = false;
    }

    return valid;
  }

  /** Ancora a mensagem do servidor no campo que ele nomeou. */
  function applyServerErrors(error) {
    if (!(error instanceof ApiError) || error.errors === null) {
      return false;
    }

    let anchored = false;

    for (const name of SERVER_FIELDS) {
      const message = error.errors[name];

      if (typeof message === "string" && message !== "") {
        fieldsByServerName[name].setError(message);
        anchored = true;
      }
    }

    return anchored;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    clearErrors();

    if (!validate()) {
      return;
    }

    submitting = true;
    submit.setLoading(true, "Trocando…");

    try {
      await changePassword({
        currentPassword: current.value,
        newPassword: next.value,
      });

      onChanged();
    } catch (error) {
      // Erro de campo vai para o campo; o resto vira aviso do formulário. Sem
      // essa separação, "senha atual incorreta" apareceria longe do input que
      // a pessoa precisa corrigir.
      if (!applyServerErrors(error)) {
        alertSlot.replaceChildren(inlineMessage({ message: userMessage(error) }));
      }

      current.input.value = "";
      current.input.focus();
    } finally {
      submitting = false;
      submit.setLoading(false);
    }
  }

  scope.on(form, "submit", handleSubmit);

  return {
    node: form,
    focus: () => current.input.focus(),
  };
}
