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
 * @param {{ onSignedOut: () => void }} config
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
    { path: ROUTES.cards, requires: "VIEWER", page: placeholder("Catálogo de cartas") },
    { path: ROUTES.catalogs, requires: "ADMIN", page: placeholder("Administração de catálogos") },
    { path: ROUTES.account, requires: "VIEWER", page: placeholder("Minha conta") },
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

  function renderChrome() {
    const chromeLife = scope();
    life.add(() => chromeLife.dispose());

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

  return () => life.dispose();
}
