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
