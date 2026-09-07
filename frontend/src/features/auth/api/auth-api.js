/**
 * A comunicação da autenticação com o servidor.
 *
 * Toda resposta é **validada na borda, uma vez**, e o resto da aplicação
 * trabalha com o dado já normalizado. Sem isso, um `resposta?.data?.user?.level`
 * defensivo se espalharia por cada tela que precisa saber quem está logado
 * (PADROES-ENGENHARIA.md §5.2).
 */

import { api } from "@/shared/api/client.js";
import { API_ENDPOINTS } from "@/shared/api/endpoints.js";
import { ApiError, MALFORMED_MESSAGE } from "@/shared/api/errors.js";
import { clearSession, setSession } from "@/shared/session/session.js";

/**
 * "Eu trato o meu próprio erro."
 *
 * **Isto não é preferência de apresentação: é correção.** O contrato usa `401`
 * para três coisas diferentes (`docs/api-contract.md` §2): sessão ausente,
 * sessão expirada, e credencial recusada — tanto no login quanto na conferência
 * da senha atual na troca.
 *
 * O tratador central de sessão expirada não tem como distinguir os três, então
 * quem sabe a diferença precisa dizer. Sem esta marca, errar a senha na tela de
 * entrada expulsaria a pessoa com o aviso "sua sessão expirou" — um erro que
 * acusa o sistema de um problema que não existe e esconde o que de fato
 * aconteceu.
 */
const SELF_HANDLED = { silent: true };

/**
 * Confere o contrato da sessão e devolve o dado normalizado.
 *
 * O `level` é o que decide o que aparece na tela; se ele vier ausente ou como
 * texto, a navegação inteira some em silêncio. Falhar aqui, com a mensagem de
 * reserva, é melhor do que desenhar uma tela vazia sem explicação (§7.3).
 */
function parseSession(payload) {
  const user = payload?.data?.user;
  const csrfToken = payload?.data?.csrfToken;

  const valid =
    user !== null &&
    typeof user === "object" &&
    typeof user.id === "number" &&
    typeof user.name === "string" &&
    typeof user.role === "string" &&
    typeof user.level === "number" &&
    typeof csrfToken === "string" &&
    csrfToken !== "";

  if (!valid) {
    throw new ApiError(200, MALFORMED_MESSAGE, { body: payload });
  }

  return {
    user: { id: user.id, name: user.name, email: user.email ?? null, role: user.role, level: user.level },
    csrfToken,
  };
}

/**
 * Entra. Devolve o usuário já guardado na sessão.
 *
 * Não trata o erro: quem chama precisa distinguir 401 de 429 para escolher a
 * mensagem, e engolir a exceção aqui tiraria essa escolha da tela.
 */
export async function login({ email, password }) {
  const payload = await api.post(API_ENDPOINTS.auth.login, { email, password }, SELF_HANDLED);

  return setSession(parseSession(payload));
}

/**
 * Lê a sessão corrente. Devolve `null` quando não há nenhuma.
 *
 * **`401` aqui é o caminho normal, não erro** (`docs/api-contract.md` §3.2): é
 * como o boot descobre que precisa mostrar o login. Por isso a chamada é
 * silenciosa — notificar o usuário de que ele não está logado, no momento em
 * que a aplicação abre, seria ruído puro.
 */
export async function loadSession() {
  try {
    const payload = await api.get(API_ENDPOINTS.auth.session, SELF_HANDLED);

    return setSession(parseSession(payload));
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      clearSession();

      return null;
    }

    throw error;
  }
}

/**
 * Sai.
 *
 * A limpeza local roda no `finally`: se a rede cair no meio do logout, deixar
 * o usuário logado na tela seria o pior dos dois mundos — ele acha que saiu e
 * os dados continuam ali. O servidor tem o próprio prazo de sessão para o
 * lado dele.
 */
export async function logout() {
  try {
    // Também autossuficiente: um 401 aqui significa que a sessão já tinha
    // morrido, e avisar "sua sessão expirou" a quem acabou de clicar em "Sair"
    // seria informar o óbvio como se fosse problema.
    await api.delete(API_ENDPOINTS.auth.session, SELF_HANDLED);
  } finally {
    clearSession();
  }
}

/**
 * Troca a própria senha.
 *
 * O `userId` **não** vai no corpo: ele vem da sessão, no servidor. Aceitar um
 * id do cliente transformaria a rota em "troque a senha de quem eu quiser"
 * (RN-08).
 *
 * A operação encerra todas as sessões do usuário, inclusive a de quem pediu
 * (RF-05) — por isso a limpeza local é parte do fluxo de sucesso, não uma
 * consequência esquecida.
 */
export async function changePassword({ currentPassword, newPassword }) {
  await api.put(
    API_ENDPOINTS.auth.password,
    { currentPassword, newPassword },
    SELF_HANDLED,
  );

  clearSession();
}
