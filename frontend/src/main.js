/**
 * O ponto de entrada da aplicação.
 *
 * Responsabilidade única: validar a configuração e entregar o controle. Toda
 * composição de tela mora em `pages/` (PADROES-ENGENHARIA.md §2.2) — este
 * arquivo não deve crescer junto com o produto.
 */

import { ConfigError, loadConfig } from "@/shared/config/env.js";

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
  // Dado nenhum entra aqui, mas a regra vale sempre: texto é texto (§8.3).
  notice.textContent = BOOT_FAILURE_MESSAGE;

  root.append(notice);
}

function renderBootPlaceholder(root) {
  root.replaceChildren();

  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = "Carregando o Oráculo…";

  root.append(status);
}

function boot() {
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

  // A partir daqui entra o shell da aplicação (F-011), que decide entre a tela
  // de login e o portal pelo resultado de GET /api/auth/session.
  renderBootPlaceholder(root);
}

boot();
