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

  /**
   * A virada, que é o que separa a resposta do servidor da aplicação.
   *
   * **Ela mora aqui, entre o formulário e quem recebe o usuário.** O
   * formulário sabe falar com o servidor e não precisa saber que existe uma
   * cena; quem recebe o usuário monta o portal e não precisa saber de onde ele
   * veio. A passagem é da página, que é dona das duas pontas.
   */
  async function turnOver(user) {
    card.dataset.state = "turning";

    /*
     * Esperar a ANIMAÇÃO, e não um evento.
     *
     * `getAnimations()` devolve o que o CSS de fato pôs para rodar: sem a
     * folha, ou com o movimento desligado por fora do navegador, a lista vem
     * vazia e a entrada acontece na hora. Com `animationend`, o mesmo cenário
     * deixaria a pessoa presa na tela de entrada esperando um evento que não
     * vem. E a duração continua sendo só do CSS — nenhum milissegundo se
     * repete deste lado (§11.2).
     *
     * Virada interrompida não é erro: a animação é cancelada quando a tela sai
     * de cena, e aí a promessa é recusada.
     */
    await Promise.all(card.getAnimations().map((animation) => animation.finished)).catch(
      () => {},
    );

    if (life.isDisposed) {
      // A tela saiu no meio da virada — a sessão venceu em outra aba, por
      // exemplo. Entrar agora ressuscitaria uma tela que já foi substituída.
      return;
    }

    /*
     * A aplicação entra invisível e aparece sozinha.
     *
     * O marcador vai na RAIZ, e não na tela: a única caixa que existe dos dois
     * lados da troca é a que hospeda as duas. A classe da transição fica —
     * ela não muda nada sozinha, e não há um segundo momento em que esta tela
     * exista para tirá-la.
     *
     * **A ordem destas quatro linhas é o que faz o esmaecimento existir**, e a
     * suíte foi quem mostrou. Ler a geometria obriga o navegador a calcular o
     * quadro invisível: sem isso, marcar e desmarcar dentro do mesmo quadro se
     * anula — não sobram dois valores para transicionar entre, e a tela
     * apareceria de uma vez.
     */
    root.classList.add("enter-fade", "enter-fade-start");

    onAuthenticated(user);

    root.getBoundingClientRect();
    root.classList.remove("enter-fade-start");

    /*
     * O foco não se perde na travessia.
     *
     * Quem apertou Enter tinha o foco no botão, e o botão sai junto com a
     * tela: sem isto o próximo Tab recomeça do topo do documento, o mesmo
     * sintoma de quem chega numa página sem saber onde está (§9.2). O destino
     * é o `<main>` da tela que entrou, que já nasce focável para o "Pular para
     * o conteúdo".
     */
    root.querySelector("#conteudo")?.focus();
  }

  const form = loginForm({
    scope: life,
    onSuccess: turnOver,
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
  /*
   * A carta em pé é o próprio cartão do formulário: o verso está à vista, e o
   * formulário está sobre ele. A marca com o sigilo vem no topo; o `<h1>` do
   * formulário já diz "Entrar no Oráculo", então o desenho é decorativo.
   *
   * Numa constante, e não solta na árvore, porque é ela que vira no fim.
   */
  const card = el("div", {
    classes: ["login-card"],
    children: [brandMark({ sigil: true }), form.node],
  });

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
            card,
            deitada(true),
          ],
        }),
      ],
    }),
  );

  form.focus();

  return () => life.dispose();
}
