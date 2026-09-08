/**
 * Leitura dos catálogos: jogos, edições e raridades.
 *
 * É o motor da cascata (RF-20 a RF-27) e a fonte dos filtros da listagem.
 *
 * **Cache longo, de propósito** (§5.4): catálogo é quase estático — muda por
 * operação de ADMIN, e raramente. Rebuscar a lista de edições a cada troca de
 * jogo faria a cascata parecer lenta sem motivo, e é justamente a troca rápida
 * que o RF-25 exercita.
 */

import { api } from "@/shared/api/client.js";
import { API_ENDPOINTS } from "@/shared/api/endpoints.js";
import { ApiError, MALFORMED_MESSAGE } from "@/shared/api/errors.js";
import { CACHE_TTL_MS } from "@/shared/config/constants.js";
import { cache, cacheKey } from "@/shared/store/cache.js";

/**
 * Normaliza a lista `{ id, name }` do contrato.
 *
 * O `id` é o slug ou código — nunca o id numérico interno (`api-contract.md`
 * §4). Um item fora do formato é descartado em vez de derrubar a cascata
 * inteira: o formulário continua utilizável com as edições que vieram certas.
 */
function parseCatalogList(payload) {
  if (!Array.isArray(payload?.data)) {
    throw new ApiError(200, MALFORMED_MESSAGE, { body: payload });
  }

  const items = [];

  for (const raw of payload.data) {
    if (typeof raw?.id === "string" && raw.id !== "" && typeof raw?.name === "string") {
      items.push({ id: raw.id, name: raw.name });
      continue;
    }

    console.error("[catalogs] item fora do contrato, descartado", { raw });
  }

  return items;
}

export async function listGames({ signal } = {}) {
  const payload = await cache.fetchOnce(
    cacheKey("catalogs", "games"),
    () => api.get(API_ENDPOINTS.catalogs.games, { signal }),
    { ttlMs: CACHE_TTL_MS.catalogs },
  );

  return parseCatalogList(payload);
}

export async function listEditions(gameId, { signal } = {}) {
  const payload = await cache.fetchOnce(
    cacheKey("catalogs", "editions", gameId),
    () => api.get(API_ENDPOINTS.catalogs.editions(gameId), { signal }),
    { ttlMs: CACHE_TTL_MS.catalogs },
  );

  return parseCatalogList(payload);
}

export async function listRarities(gameId, { signal } = {}) {
  const payload = await cache.fetchOnce(
    cacheKey("catalogs", "rarities", gameId),
    () => api.get(API_ENDPOINTS.catalogs.rarities(gameId), { signal }),
    { ttlMs: CACHE_TTL_MS.catalogs },
  );

  return parseCatalogList(payload);
}

/**
 * Derruba o cache dos catálogos.
 *
 * Chamado pela administração (F-040): sem isso, o formulário continuaria
 * oferecendo uma edição que acabou de ser desativada.
 */
export function invalidateCatalogs() {
  cache.invalidate("catalogs");
}

/**
 * A listagem da administração, com os itens desativados.
 *
 * Rota nova, e a diferença importa: **sem ela, desativar é porta de mão
 * única** — o item some da listagem comum e não há de onde chamar o `PUT` que
 * o reativa (`api-contract.md` §4).
 *
 * Não passa pelo cache: a tela de administração precisa do estado corrente,
 * e um catálogo com validade de uma hora mostraria o resultado da própria
 * edição só depois do prazo (§5.4).
 */
async function listForAdmin(path) {
  const payload = await api.get(path, { params: { incluirInativos: 1 }, silent: true });

  if (!Array.isArray(payload?.data)) {
    throw new ApiError(200, MALFORMED_MESSAGE, { body: payload });
  }

  const items = [];

  for (const raw of payload.data) {
    if (typeof raw?.id === "string" && raw.id !== "" && typeof raw?.name === "string") {
      /*
       * `id` é o CÓDIGO, e `ref` é o id numérico que as rotas de escrita
       * esperam. São coisas diferentes de propósito: o código é o
       * identificador público e imutável; a referência é como o registro é
       * endereçado. Confundir os dois faz a tela listar itens e não conseguir
       * apontar para nenhum — foi o primeiro defeito que a tela mostrou.
       */
      items.push({
        id: raw.id,
        ref: typeof raw.ref === "number" ? raw.ref : null,
        name: raw.name,
        // `active` só vem para ADMIN. Ausente, o item é tratado como ativo —
        // que é o que a listagem comum devolve.
        active: raw.active !== false,
      });
      continue;
    }

    console.error("[catalogs] item fora do contrato, descartado", { raw });
  }

  return items;
}

export const listEditionsForAdmin = (gameId) =>
  listForAdmin(API_ENDPOINTS.catalogs.editions(gameId));

export const listRaritiesForAdmin = (gameId) =>
  listForAdmin(API_ENDPOINTS.catalogs.rarities(gameId));

/**
 * Cria um item de catálogo.
 *
 * `code` vira parte da URL pública e é único **dentro do jogo**: o mesmo
 * código em jogos diferentes é aceito, e repetido no mesmo jogo devolve `409`.
 */
async function createItem(path, { code, name, sortOrder }) {
  await api.post(path, { code: code.trim(), name: name.trim(), sortOrder }, { silent: true });

  invalidateCatalogs();
}

export const createEdition = (gameId, data) =>
  createItem(API_ENDPOINTS.catalogs.editions(gameId), data);

export const createRarity = (gameId, data) =>
  createItem(API_ENDPOINTS.catalogs.rarities(gameId), data);

/**
 * Atualiza um item.
 *
 * **O `PUT` é substituição, não remendo:** `name` é obrigatório mesmo quando
 * só se quer reativar. Mandar `{ active: true }` sozinho devolve `400`
 * apontando `name` — conferido contra a API.
 *
 * `code` não vai no corpo porque é **imutável**: ele é o identificador
 * público, aparece na URL e em qualquer filtro que alguém tenha salvo.
 */
async function updateItem(path, { name, sortOrder, active }) {
  await api.put(path, { name: name.trim(), sortOrder, active }, { silent: true });

  invalidateCatalogs();
}

export const updateEdition = (id, data) =>
  updateItem(API_ENDPOINTS.catalogs.editionById(id), data);

export const updateRarity = (id, data) =>
  updateItem(API_ENDPOINTS.catalogs.rarityById(id), data);

/**
 * Desativa um item.
 *
 * **O verbo é `DELETE` mas a operação é desativação, e ela nunca falha**
 * (RF-43). Devolve `wasInUse`, que a tela usa para dizer que as cartas que já
 * usam o item continuam como estão. Apagar de verdade levaria junto todas
 * elas, e um portal administrativo não pode ter um botão cuja consequência
 * real o usuário não consegue prever.
 */
async function deactivateItem(path) {
  const payload = await api.delete(path, { silent: true });

  invalidateCatalogs();

  return { wasInUse: payload?.data?.wasInUse === true };
}

export const deactivateEdition = (id) =>
  deactivateItem(API_ENDPOINTS.catalogs.editionById(id));

export const deactivateRarity = (id) =>
  deactivateItem(API_ENDPOINTS.catalogs.rarityById(id));
