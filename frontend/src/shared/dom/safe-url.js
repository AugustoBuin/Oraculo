/**
 * Validação de URL antes de qualquer coisa virar `href` ou `src`.
 *
 * `javascript:`, `data:`, `vbscript:` e `file:` são vetores de execução: um
 * `href="javascript:..."` roda no clique, e um `src="data:text/html,..."`
 * carrega documento inteiro com o mesmo poder da página. O portal recebe URL de
 * imagem digitada pelo usuário (RF-31/RF-33) e devolvida pelo servidor, então
 * este é um caminho quente, não uma hipótese (PADROES-ENGENHARIA.md §8.3).
 */

/**
 * Os dois únicos esquemas aceitos, em qualquer atributo de URL.
 *
 * É a mesma allowlist que o backend aplica na validação de imagem remota
 * (`docs/api-contract.md` §5) — a checagem do cliente é conveniência e
 * feedback rápido, e a do servidor é a que vale (§8.1).
 */
const ALLOWED_PROTOCOLS = ["http:", "https:"];

/**
 * A URL é segura para ir para o DOM?
 *
 * Resolve contra a origem da página, então caminho relativo (`/api/media/...`)
 * passa naturalmente. A normalização do próprio construtor `URL` é o que
 * fecha as fugas clássicas: espaço e caractere de controle antes do esquema
 * são removidos, e `JaVaScRiPt:` vira `javascript:` — as duas tentativas de
 * enganar uma comparação de string escrita à mão.
 */
export function isSafeUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  try {
    const { protocol } = new URL(value, window.location.origin);

    return ALLOWED_PROTOCOLS.includes(protocol);
  } catch {
    // URL malformada não é caso excepcional: é entrada do usuário. Recusar em
    // silêncio é o comportamento certo — quem chama decide o que mostrar.
    return false;
  }
}
