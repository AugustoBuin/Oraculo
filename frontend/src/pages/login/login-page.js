/**
 * A página de entrada.
 *
 * A página **compõe**: monta os componentes na ordem certa e devolve a função
 * de limpeza. Não guarda regra de negócio, não faz estilização própria e não
 * fala com o servidor — isso é do formulário e da camada de dados (§2.2).
 */

import { loginForm } from "@/features/auth/components/login-form.js";
import { brandMark } from "@/shared/components/brand-mark.js";
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

  /*
   * A carta deitada, que aparece dos dois lados do cartão.
   *
   * É UMA imagem só: a da direita é a mesma, espelhada no CSS. Duas fotos
   * diferentes custariam o dobro do peso e dariam duas luzes na mesma mesa.
   *
   * Decoração pura (`aria-hidden`): quem usa leitor de tela não perde nada
   * sem elas, e o `<div>` vazio existe porque a foto entra por token de
   * `background-image` — endereço de imagem é valor visual, e não atributo de
   * componente.
   */
  const deitada = (mirrored = false) =>
    el("div", {
      classes: ["login-side", ...(mirrored ? ["login-side-mirrored"] : [])],
      attrs: { "aria-hidden": "true" },
    });

  root.replaceChildren(
    el("main", {
      classes: ["login-layout"],
      attrs: { id: "conteudo" },
      children: [
        /*
         * O palco é o contêiner da consulta: quem decide se as cartas
         * deitadas cabem é a largura DELE, não a da janela (`design.md` §9).
         */
        el("div", {
          classes: ["login-stage"],
          children: [
            deitada(),
            el("div", {
              classes: ["login-card"],
              // A carta em pé é o próprio cartão do formulário: o verso está
              // à vista, e o formulário está sobre ele. A marca com o sigilo
              // vem no topo; o `<h1>` do formulário já diz "Entrar no
              // Oráculo", então o desenho é decorativo.
              children: [brandMark({ sigil: true }), form.node],
            }),
            deitada(true),
          ],
        }),
      ],
    }),
  );

  form.focus();

  return () => life.dispose();
}
