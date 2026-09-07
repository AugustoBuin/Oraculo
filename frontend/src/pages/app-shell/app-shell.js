/**
 * A moldura que toda tela do portal habita.
 *
 * Compõe cabeçalho, navegação, avisos e a área onde o roteador desenha. Não
 * guarda regra de negócio: quem decide o que aparece é `navigation.js`, e quem
 * busca dado é a camada de dados (§2.2).
 */

import { setErrorReporter } from "@/shared/api/client.js";
import { appHeader } from "@/shared/components/app-header.js";
import { button } from "@/shared/components/button.js";
import { empty, forbidden } from "@/shared/components/feedback.js";
import { createNotifications } from "@/shared/components/notifications.js";
import { themeToggle } from "@/shared/components/theme-toggle.js";
import { el } from "@/shared/dom/elements.js";
import { scope } from "@/shared/dom/events.js";
import { createRouter } from "@/shared/router/router.js";
import { hasLevel } from "@/shared/session/session.js";
import { logout } from "@/features/auth/api/auth-api.js";
import { accountPage } from "@/pages/account/account-page.js";
import { cardsPage } from "@/pages/cards/cards-page.js";
import { ROUTES, visibleNavigation } from "@/pages/app-shell/navigation.js";

/**
 * Tela ainda não construída.
 *
 * Explícita de propósito: uma rota que existe na navegação e leva a nada seria
 * pior do que uma que diz o que falta. Sai quando F-020 e F-040 chegarem.
 */
const placeholder = (title) => (outlet) => {
  outlet.replaceChildren(empty({ title, description: "Esta tela chega em uma etapa adiante." }));

  return null;
};

/**
 * @param {HTMLElement} root
 * @param {{ onSignedOut: (notice?: string) => void }} config
 * @returns {() => void}
 */
export function appShell(root, { onSignedOut }) {
  const life = scope();

  const notifications = createNotifications();

  /*
   * Liga o cliente HTTP ao aviso.
   *
   * Injetado, e não importado pelo cliente: a camada compartilhada não pode
   * conhecer um componente de interface (§2.1). A limpeza desliga — senão um
   * shell antigo continuaria recebendo erro de uma sessão que já acabou.
   */
  setErrorReporter(notifications.reportError);
  life.add(() => setErrorReporter(null));

  const outlet = el("main", {
    classes: ["container", "app-main"],
    attrs: { id: "conteudo", tabindex: "-1" },
  });

  const routes = [
    {
      path: ROUTES.cards,
      requires: "VIEWER",
      // `router` já está atribuído quando a página é montada — a rota só é
      // chamada depois de `start()`.
      page: (target) => cardsPage(target, { navigate: (path) => router.navigate(path) }),
    },
    { path: ROUTES.catalogs, requires: "ADMIN", page: placeholder("Administração de catálogos") },
    {
      path: ROUTES.account,
      requires: "VIEWER",
      page: (target) =>
        accountPage(target, {
          onPasswordChanged: () => {
            // O servidor já revogou todas as sessões (RF-05). A tela acompanha
            // em vez de esperar o próximo 401 — que viria, mas depois de a
            // pessoa clicar em algo e ver a operação falhar.
            onSignedOut("Senha trocada. Entre novamente com a nova senha.");
          },
        }),
    },
  ];

  /**
   * Envolve a página com a checagem de nível.
   *
   * Quem alcança a rota pela URL, sem o item no menu, vê "sem permissão" em
   * vez de uma tela quebrada. **Não é barreira** — o servidor recusa igual; é
   * a diferença entre uma recusa explicada e um erro sem contexto (ADR-007).
   */
  const guarded = routes.map(({ path, requires, page }) => ({
    path,
    page: (target, params) => {
      if (!hasLevel(requires)) {
        target.replaceChildren(forbidden());
        return null;
      }

      return page(target, params);
    },
  }));

  // O cabeçalho é redesenhado a cada rota para o `aria-current` acompanhar —
  // "você está aqui" que fica preso na primeira tela é pior do que não existir.
  let header = null;

  const router = createRouter({
    routes: guarded,
    root: outlet,
    onNavigate: () => {
      if (header !== null) {
        const updated = renderChrome();
        header.replaceWith(updated);
        header = updated;
      }
    },
    notFound: (target) => {
      target.replaceChildren(
        empty({
          title: "Página não encontrada",
          description: "O endereço não corresponde a nenhuma tela do portal.",
        }),
      );

      return null;
    },
  });

  /**
   * A vida do cabeçalho corrente.
   *
   * `renderChrome()` roda a cada navegação, e o cabeçalho anterior precisa
   * morrer antes de o novo nascer. Acumular um escopo por rota faria os
   * listeners de `matchMedia` do botão de tema se empilharem — o vazamento do
   * §12.4 na sua forma mais discreta, porque nada quebra: a aplicação só fica
   * mais lenta a cada tela visitada.
   */
  let chromeLife = null;

  function renderChrome() {
    chromeLife?.dispose();
    chromeLife = scope();

    const theme = themeToggle({ scope: chromeLife });

    const exit = button({
      label: "Sair",
      variant: "ghost",
      scope: chromeLife,
      onClick: async () => {
        try {
          await logout();
        } catch {
          // A sessão local já foi limpa no `finally` do logout. Insistir numa
          // mensagem de erro aqui só atrapalharia quem quer sair.
        }

        onSignedOut();
      },
    });

    return appHeader({
      brand: "Oráculo",
      items: visibleNavigation(hasLevel),
      currentPath: router.currentPath(),
      actions: [theme.node, exit.node],
    });
  }

  header = renderChrome();

  root.replaceChildren(
    // Primeiro elemento focável da página: salva quem navega por teclado de
    // percorrer o menu inteiro a cada tela (§9.2).
    el("a", { text: "Pular para o conteúdo", attrs: { href: "#conteudo" }, classes: ["skip-link"] }),
    header,
    outlet,
    notifications.node,
  );

  life.add(router.start());
  life.add(() => notifications.dispose());
  life.add(() => chromeLife?.dispose());

  return () => life.dispose();
}
