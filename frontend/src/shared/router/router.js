/**
 * Roteador sobre a History API.
 *
 * Casa com o fallback que o Apache já serve: o que não é arquivo nem
 * diretório volta para `index.html`, então recarregar em `/cartas/12` funciona
 * (`docker/app/apache.conf`).
 *
 * **A responsabilidade que mais importa aqui não é navegar — é limpar.** Toda
 * página devolve a própria função de limpeza, e o roteador a chama antes de
 * desenhar a próxima. Sem isso, listener, timer e requisição da tela anterior
 * sobrevivem, e a aplicação degrada depois de meia hora de uso (§12.4, RNF-07).
 */

import { on } from "@/shared/dom/events.js";

const PARAMETER_PATTERN = /^:(?<name>[a-zA-Z][a-zA-Z0-9]*)$/;

/**
 * Compara o caminho pedido com o padrão da rota.
 *
 * Devolve os parâmetros nomeados, ou `null` quando não casa. Comparação
 * segmento a segmento em vez de expressão regular montada por concatenação:
 * padrão de rota vira regex é uma das formas clássicas de injetar um
 * quantificador sem querer.
 */
export function matchRoute(pattern, path) {
  const patternParts = pattern.split("/").filter((part) => part !== "");
  const pathParts = path.split("/").filter((part) => part !== "");

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params = {};

  for (const [index, patternPart] of patternParts.entries()) {
    const parameter = PARAMETER_PATTERN.exec(patternPart);

    if (parameter !== null) {
      // A URL é entrada externa e chega malformada (§8.5): `%E0%A4%A` faz
      // `decodeURIComponent` lançar. Sem esta guarda a exceção subiria de
      // dentro do `resolve()`, fora do try do `render()`, e viraria uma
      // rejeição não tratada em vez de um 404 de tela.
      try {
        params[parameter.groups.name] = decodeURIComponent(pathParts[index]);
      } catch {
        return null;
      }

      continue;
    }

    if (patternPart !== pathParts[index]) {
      return null;
    }
  }

  return params;
}

/**
 * @param {{
 *   routes: Array<{ path: string, page: Function }>,
 *   root: HTMLElement,
 *   notFound: Function,
 *   onNavigate?: (path: string) => void,
 * }} config
 */
export function createRouter({ routes, root, notFound, onNavigate }) {
  /** A limpeza da tela que está no ar. */
  let disposeCurrent = null;

  /**
   * Contador de navegação.
   *
   * Uma página assíncrona que demora pode terminar de montar DEPOIS de o
   * usuário já ter ido para outra. Sem esta guarda, ela desenharia por cima da
   * tela certa — é a mesma corrida que o RF-25 descreve na cascata, aqui no
   * nível da rota.
   */
  let navigationId = 0;

  /**
   * Desenha a rota que a URL corrente indica.
   *
   * **Lê `location` em vez de receber o caminho por parâmetro.** Receber o
   * caminho era a fonte de um defeito real: `navigate("/?page=2")` passava a
   * query string adiante, e o casamento de rota — que compara segmento a
   * segmento — não reconhecia `/?page=2` como `/`. Com uma fonte de verdade
   * só, a classe inteira do erro some: quem empurra o estado é o `navigate`, e
   * quem desenha sempre pergunta ao navegador onde está.
   */
  async function render() {
    const path = currentPath();
    const id = ++navigationId;

    // Limpa ANTES de montar a próxima: se a montagem falhar, a tela anterior
    // já saiu e não fica com listeners pendurados sobre um DOM substituído.
    disposeCurrent?.();
    disposeCurrent = null;

    // Avisa antes de montar, para que o que depende da rota — o "você está
    // aqui" da navegação — já esteja correto quando a tela aparecer.
    onNavigate?.(path);

    const match = resolve(path);

    try {
      const dispose = await match.page(root, match.params);

      if (id !== navigationId) {
        // O usuário navegou enquanto esta página montava. Ela perdeu: encerra
        // o que acabou de criar e não toca na tela.
        dispose?.();
        return;
      }

      disposeCurrent = typeof dispose === "function" ? dispose : null;
    } catch (error) {
      console.error("[router] falha ao montar a rota", { path, error });

      if (id === navigationId) {
        disposeCurrent = (await notFound(root, { path, error })) ?? null;
      }
    }
  }

  function resolve(path) {
    for (const route of routes) {
      const params = matchRoute(route.path, path);

      if (params !== null) {
        return { page: route.page, params };
      }
    }

    return { page: notFound, params: {} };
  }

  /** Navega sem recarregar a página. */
  function navigate(path, { replace = false } = {}) {
    const target = new URL(path, window.location.origin);

    if (target.pathname + target.search === currentPath() + window.location.search && !replace) {
      return;
    }

    window.history[replace ? "replaceState" : "pushState"]({}, "", path);

    return render();
  }

  const currentPath = () => window.location.pathname;

  /**
   * Intercepta clique em link interno.
   *
   * Um listener no documento, e não um por link (§12.3): a listagem de cartas
   * tem dezenas de links, e um listener por cartão é a diferença entre um
   * listener e mil.
   */
  function handleClick(event) {
    // Deixa passar o que o usuário pediu explicitamente: nova aba, download,
    // link externo, botão do meio.
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest?.("a[href]");

    if (link === null || link === undefined) return;
    if (link.target !== "" && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    if (link.origin !== window.location.origin) return;

    /*
     * Âncora da própria página é do navegador, não do roteador.
     *
     * `#conteudo` é o destino do "Pular para o conteúdo", o primeiro Tab de
     * qualquer tela. Sequestrar esse clique deixava o atalho morto — sem erro
     * no console, sem nada na tela: o Enter simplesmente não fazia coisa
     * alguma, e quem navega por teclado ficava sem o desvio do cabeçalho
     * (§9.2, RNF-06).
     */
    if (
      link.hash !== "" &&
      link.pathname === window.location.pathname &&
      link.search === window.location.search
    ) {
      return;
    }

    event.preventDefault();
    navigate(link.pathname + link.search);
  }

  return {
    navigate,
    currentPath,

    /**
     * Liga o roteador e desenha a rota corrente.
     *
     * Devolve a limpeza — o roteador segue a mesma regra que impõe às páginas.
     */
    start() {
      const offClick = on(document, "click", handleClick);
      const offPop = on(window, "popstate", () => render());

      render();

      return () => {
        offClick();
        offPop();
        disposeCurrent?.();
        disposeCurrent = null;
      };
    },
  };
}
