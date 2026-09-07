/**
 * O ponto de entrada da aplicação.
 *
 * Responsabilidade única: validar a configuração, aplicar o tema e decidir
 * entre a tela de entrada e o portal. Toda composição de tela mora em
 * `pages/` (PADROES-ENGENHARIA.md §2.2) — este arquivo não deve crescer junto
 * com o produto.
 */

import { setSessionExpiredHandler } from "@/shared/api/client.js";
import { userMessage } from "@/shared/api/errors.js";
import { clearSession } from "@/shared/session/session.js";
import { ConfigError, loadConfig } from "@/shared/config/env.js";
import { failure, loading } from "@/shared/components/feedback.js";
import { initTheme } from "@/shared/theme/theme.js";
import { loadSession } from "@/features/auth/api/auth-api.js";
import { loginPage } from "@/pages/login/login-page.js";
import { appShell } from "@/pages/app-shell/app-shell.js";

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

  const showLogin = (notice) =>
    show((target) => loginPage(target, { onAuthenticated: showPortal, notice }));

  const showPortal = () => show((target) => appShell(target, { onSignedOut: (notice) => showLogin(notice) }));

  /*
   * A sessão venceu durante o uso (RF-08).
   *
   * **A intenção é preservada sem guardar nada:** a URL não é tocada. Quem
   * estava em `/conta` vê o login com a URL ainda em `/conta`, e ao entrar o
   * roteador do shell desenha exatamente aquela tela. Guardar o caminho num
   * lugar à parte criaria uma segunda verdade sobre onde a pessoa está.
   *
   * A limpeza é total, não parcial: `clearSession()` derruba usuário, token e
   * cache. Logout parcial é vazamento entre usuários no mesmo navegador.
   */
  setSessionExpiredHandler(() => {
    clearSession();
    showLogin("Sua sessão expirou. Entre novamente para continuar de onde parou.");
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

    showPortal();
  } catch (error) {
    console.error("[boot] falha ao ler a sessão", { error });

    show((target) => {
      target.replaceChildren(failure({ message: userMessage(error) }));
      return null;
    });
  }
}

boot();
