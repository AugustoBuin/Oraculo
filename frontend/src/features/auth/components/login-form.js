/**
 * O formulário de entrada.
 *
 * **Os cinco estados, e por que dois não se aplicam** (§7.4): carregando é o
 * envio; erro é a credencial recusada; sucesso é sair da tela. "Vazio" e "sem
 * permissão" não existem num formulário de login — não há lista para estar
 * vazia, e ninguém precisa de permissão para tentar entrar. Registrado aqui
 * para que a ausência seja uma decisão lida, não um esquecimento.
 */

import { button } from "@/shared/components/button.js";
import { field } from "@/shared/components/field.js";
import { inlineMessage } from "@/shared/components/feedback.js";
import { el } from "@/shared/dom/elements.js";
import { userMessage } from "@/shared/api/errors.js";
import { login } from "@/features/auth/api/auth-api.js";

const MIN_PASSWORD_LENGTH = 8;

/**
 * @param {{ scope: object, onSuccess: (user: object) => void }} config
 */
export function loginForm({ scope, onSuccess }) {
  const email = field({
    id: "email",
    label: "E-mail",
    type: "email",
    autocomplete: "username",
    required: true,
  });

  const password = field({
    id: "senha",
    label: "Senha",
    type: "password",
    autocomplete: "current-password",
    required: true,
  });

  const submit = button({ label: "Entrar", variant: "primary", type: "submit" });

  // O aviso vive fora do fluxo do formulário para poder aparecer e sumir sem
  // deslocar os campos — deslocamento a cada tentativa é o que faz o usuário
  // perder o lugar.
  const alertSlot = el("div", { classes: ["form-alert"] });

  const form = el("form", {
    attrs: { novalidate: true },
    classes: ["login-form", "stack"],
    children: [
      el("h1", { text: "Entrar no Oráculo" }),
      el("p", {
        text: "Use as credenciais fornecidas pela administração do catálogo.",
        classes: ["text-muted"],
      }),
      alertSlot,
      email.wrapper,
      password.wrapper,
      submit.node,
    ],
  });

  let submitting = false;

  const showAlert = (message) => {
    alertSlot.replaceChildren(inlineMessage({ message }));
  };

  const clearAlert = () => {
    alertSlot.replaceChildren();
  };

  /**
   * Validação local: feedback rápido, nunca barreira.
   *
   * A validação que vale é a do servidor (§8.5). Esta existe só para não
   * gastar uma ida ao servidor com um campo em branco.
   */
  function validate() {
    email.clearError();
    password.clearError();

    let valid = true;

    if (email.value.trim() === "") {
      email.setError("Informe o e-mail.");
      valid = false;
    }

    if (password.value === "") {
      password.setError("Informe a senha.");
      valid = false;
    } else if (password.value.length < MIN_PASSWORD_LENGTH) {
      password.setError(`A senha tem ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      valid = false;
    }

    if (!valid) {
      // O foco vai para o primeiro campo com problema: sem isso, quem navega
      // por teclado não tem como saber onde o erro apareceu (§9.2).
      (email.hasError ? email.input : password.input).focus();
    }

    return valid;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    // A trava é de estado, não visual: `disabled` sozinho ainda deixa passar o
    // Enter repetido em alguns navegadores.
    if (submitting) {
      return;
    }

    clearAlert();

    if (!validate()) {
      return;
    }

    submitting = true;
    submit.setLoading(true, "Entrando…");

    try {
      const user = await login({
        email: email.value.trim(),
        password: password.value,
      });

      onSuccess(user);
    } catch (error) {
      /*
       * A MESMA MENSAGEM PARA CREDENCIAL ERRADA E USUÁRIO INATIVO (RF-02).
       *
       * Ela vem pronta do servidor, e a tela não tenta melhorá-la: distinguir
       * "usuário não existe" de "senha errada" entregaria uma lista de
       * usuários válidos a quem tentasse. O 429 tem texto próprio, também do
       * servidor, porque aí o usuário precisa saber que é para esperar.
       */
      showAlert(userMessage(error));

      // A senha é limpa, o e-mail permanece: refazer o e-mail a cada tentativa
      // é o atrito que leva a pessoa a escolher uma senha pior.
      password.input.value = "";
      password.input.focus();
    } finally {
      submitting = false;
      submit.setLoading(false);
    }
  }

  scope.on(form, "submit", handleSubmit);

  return {
    node: form,

    /** Foco inicial: quem abre a tela já pode digitar. */
    focus() {
      email.input.focus();
    },
  };
}
