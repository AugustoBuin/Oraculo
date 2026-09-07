/**
 * O ponto de entrada da aplicação.
 *
 * Responsabilidade única: validar a configuração, aplicar o tema e decidir
 * entre a tela de entrada e o portal. Toda composição de tela mora em
 * `pages/` (PADROES-ENGENHARIA.md §2.2) — este arquivo não deve crescer junto
 * com o produto.
 */

import { userMessage } from "@/shared/api/errors.js";
import { ConfigError, loadConfig } from "@/shared/config/env.js";
import { el } from "@/shared/dom/elements.js";
import { failure, loading } from "@/shared/components/feedback.js";
import { initTheme } from "@/shared/theme/theme.js";
import { loadSession } from "@/features/auth/api/auth-api.js";
import { loginPage } from "@/pages/login/login-page.js";

const APP_ROOT_ID = "app";

/**
 * Mensagem de falha de boot.
 *
 * Genérica de propósito: falha de configuração é erro de quem desenvolve, e o
 * usuário não tem o que tentar de novo. O detalhe vai para o console, onde
 * serve para reproduzir; a tela recebe português claro e sem termo técnico
 * (§7.1).
 */
const BOOT_FAILURE_MESSAGE = "Não foi possível iniciar o Oráculo. Recarregue a página.";

/**
 * Desenha um aviso de página inteira sem depender de nada que possa ter
 * falhado. Sem token, sem componente, sem import: se o boot quebrou, o
 * caminho de erro precisa funcionar mesmo assim.
 */
function renderBootFailure(root) {
  root.replaceChildren();

  const notice = document.createElement("p");
  notice.setAttribute("role", "alert");
  notice.textContent = BOOT_FAILURE_MESSAGE;

  root.append(notice);
}

async function boot() {
  const root = document.getElementById(APP_ROOT_ID);

  if (root === null) {
    console.error("[boot] o elemento de montagem não existe", { id: APP_ROOT_ID });
    return;
  }

  try {
    loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error("[boot] configuração inválida", { key: error.key, error });
    } else {
      console.error("[boot] falha inesperada ao iniciar", { error });
    }

    renderBootFailure(root);
    return;
  }

  // Antes de desenhar qualquer coisa: escrever o tema depois do primeiro
  // quadro é o que produz a piscada que a divisão com o CSS existe para
  // evitar (shared/theme/theme.js).
  initTheme();

  /**
   * A tela no ar, e a limpeza dela.
   *
   * Trocar de tela **sempre** passa por aqui, para que nenhuma consiga
   * substituir a anterior sem encerrá-la (§12.4, RNF-07). É o mesmo contrato
   * que o roteador de F-011 vai assumir.
   */
  let dispose = null;

  const show = (render) => {
    dispose?.();
    dispose = render(root) ?? null;
  };

  const showLogin = () => show((target) => loginPage(target, { onAuthenticated: showPortal }));

  // F-011 substitui isto pelo shell, que compõe cabeçalho, navegação por nível
  // e roteador. Até lá, confirma que a sessão foi criada.
  const showPortal = (user) =>
    show((target) => {
      target.replaceChildren(
        el("main", {
          classes: ["container", "stack"],
          attrs: { id: "conteudo" },
          children: [
            el("h1", { text: "Oráculo" }),
            el("p", { text: `Sessão iniciada como ${user.name} (${user.role}).` }),
          ],
        }),
      );

      return null;
    });

  show(() => {
    root.replaceChildren(loading("Carregando o Oráculo…"));
    return null;
  });

  try {
    const user = await loadSession();

    // `null` é o caminho normal de quem ainda não entrou, não um erro
    // (`docs/api-contract.md` §3.2).
    if (user === null) {
      showLogin();
      return;
    }

    showPortal(user);
  } catch (error) {
    console.error("[boot] falha ao ler a sessão", { error });

    show((target) => {
      target.replaceChildren(failure({ message: userMessage(error) }));
      return null;
    });
  }
}

boot();
