/**
 * A consulta do catálogo, ida e volta entre a URL e o objeto.
 *
 * Funções puras, sem DOM e sem rede — é onde a regra mora e o que os testes
 * exercitam (§13.2).
 *
 * **A query string é dado de fora e não é confiável nem por formato** (§8.5).
 * Tudo que chega por ela passa por allowlist ou é descartado: um `sort` vindo
 * da URL é a única coisa do cliente que chega perto de um nome de coluna no
 * servidor, e um `page=-1` faria a listagem pedir uma página que não existe.
 */

import { normalizeQuery } from "@/features/cards/api/cards-api.js";

/**
 * Lê a consulta a partir de uma query string.
 *
 * Delega a normalização para `normalizeQuery`, que é a mesma usada pela camada
 * de dados: duas normalizações divergiriam, e a tela passaria a pedir uma coisa
 * e exibir outra.
 */
export function readCardQuery(search) {
  const params = new URLSearchParams(search);
  const page = Number.parseInt(params.get("page") ?? "", 10);

  return normalizeQuery({
    page: Number.isNaN(page) ? 1 : page,
    search: params.get("busca") ?? "",
    game: params.get("jogo") ?? null,
    edition: params.get("edicao") ?? null,
    rarity: params.get("raridade") ?? null,
    sort: params.get("ordem") ?? undefined,
  });
}

/**
 * Escreve a consulta como query string, com o `?` na frente ou vazia.
 *
 * **Devolve só o sufixo, não o caminho.** A feature não conhece as rotas da
 * aplicação: quem compõe o endereço é a página, que é a camada autorizada a
 * conhecer as duas coisas (§2.1). Um `ROUTES` importado aqui seria uma feature
 * dependendo de `pages/` — inversão da regra de dependência.
 *
 * **Valor padrão não vira parâmetro.** Uma URL com `?page=1&ordem=recent` para
 * a tela inicial é ruído: ela é copiada, colada e compartilhada, e o que está
 * lá deve ser o que a pessoa escolheu — não o que ela não mudou.
 */
export function writeCardQuery(query) {
  const normalized = normalizeQuery(query);
  const params = new URLSearchParams();

  if (normalized.page > 1) {
    params.set("page", String(normalized.page));
  }

  if (normalized.search !== "") {
    params.set("busca", normalized.search);
  }

  if (normalized.game !== null) {
    params.set("jogo", normalized.game);
  }

  if (normalized.edition !== null) {
    params.set("edicao", normalized.edition);
  }

  if (normalized.rarity !== null) {
    params.set("raridade", normalized.rarity);
  }

  if (normalized.sort !== "recent") {
    params.set("ordem", normalized.sort);
  }

  const suffix = params.toString();

  return suffix === "" ? "" : `?${suffix}`;
}
