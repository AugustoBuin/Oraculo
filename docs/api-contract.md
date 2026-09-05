# Contrato da API — Oráculo

**Base:** `/api` · **Formato:** JSON (`application/json; charset=utf-8`)
**Origem:** a mesma do frontend. Não há cross-origin, portanto não há preflight nem
`Access-Control-Allow-Credentials` (ADR-003).

> Este documento é o contrato entre backend e frontend. Ele é escrito **antes** da
> implementação para que as duas frentes avancem em paralelo. Qualquer divergência entre o
> código e este arquivo é bug de um dos dois lados — resolva, não ignore.

---

## 1. Envelopes

### 1.1 Recurso único

```json
{ "data": { "id": 1, "nameEn": "Black Lotus" } }
```

### 1.2 Lista — sempre paginada

Formato fixo em todo o sistema (`PADROES-ENGENHARIA.md` §5.3):

```json
{
  "data": [],
  "pagination": { "page": 1, "perPage": 20, "total": 0, "totalPages": 0 }
}
```

`DEFAULT_PAGE_SIZE = 20`, `MAX_PAGE_SIZE = 100`. `perPage` acima do máximo é **truncado ao
máximo**, não rejeitado — rejeitar aqui só transforma um detalhe de cliente em erro visível.

### 1.3 Erro

```json
{ "message": "A edição selecionada não pertence ao jogo escolhido." }
```

Erro de validação de formulário acrescenta o mapa por campo, para o frontend ancorar a
mensagem no input certo:

```json
{
  "message": "Verifique os campos destacados.",
  "errors": {
    "nameEn": "O nome em inglês é obrigatório.",
    "editionId": "A edição selecionada não pertence ao jogo escolhido."
  }
}
```

**Regras invioláveis do envelope de erro** (`PADROES.md` §4.1 e §4.2):
- `message` está **sempre** em português e **sempre** é seguro para exibir ao usuário.
- Nunca contém nome de tabela, nome de coluna, texto do driver, `SQLSTATE`, caminho de
  arquivo, stack trace ou id de registro alheio.
- O status **nunca** é definido na rota. Vem da classe de erro lançada, traduzido por
  `Infra/Http/ErrorHandler` — o único tradutor do sistema.

---

## 2. Códigos de status

| Status | Classe de erro | Quando |
|---|---|---|
| `200` | — | Leitura ou atualização bem-sucedida |
| `201` | — | Criação bem-sucedida (com `Location`) |
| `204` | — | Operação sem corpo de resposta (logout, exclusão) |
| `400` | `ValidationError` | Entrada inválida |
| `401` | `UnauthorizedError` | **Sem sessão ou sessão expirada** |
| `403` | `ForbiddenError` | Sessão válida, nível insuficiente, ou CSRF inválido |
| `404` | `NotFoundError` | Recurso inexistente (ou que o solicitante não pode ver) |
| `409` | `ConflictError` | Violação de unicidade ou de estado |
| `413` | `PayloadTooLargeError` | Upload acima do limite |
| `415` | `UnsupportedMediaTypeError` | Tipo de arquivo não permitido |
| `429` | `TooManyRequestsError` | Limite de tentativas excedido |
| `500` | qualquer outra `Throwable` | Falha não tratada. Mensagem genérica; texto real só no log |

> **Divergência declarada do `PADROES.md` §4.2.** O documento coloca `UnauthorizedError` e
> `ForbiddenError` ambos em `403`. Aqui `401` é sessão ausente/expirada e `403` é nível
> insuficiente. Motivo: o frontend precisa distinguir "vá para o login" de "você não tem
> permissão para isto", e o próprio `PADROES-ENGENHARIA.md` §8.4 pressupõe um fluxo de `401`.
> Registro completo em `docs/decisions/ADR-007`.

> **`404` também para recurso existente que o solicitante não pode ver.** Devolver `403` ali
> confirma a existência do registro — um oráculo (`PADROES.md` §5.2).

---

## 3. Autenticação, sessão e CSRF

### 3.1 Como funciona

1. `POST /api/auth/login` valida as credenciais, cria a sessão no servidor, chama
   `session_regenerate_id(true)` e devolve o usuário e o **token CSRF**.
2. O cookie de sessão vai com `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. O JavaScript
   nunca lê o cookie — nem precisa.
3. Toda requisição que **altera estado** (`POST`, `PUT`, `PATCH`, `DELETE`) envia o token no
   cabeçalho `X-CSRF-Token`. Ausente ou divergente → `403`.
4. O token CSRF **não** fica em `localStorage`: vive em memória no cliente e é
   rebuscado por `GET /api/auth/session` quando a aplicação recarrega
   (`PADROES-ENGENHARIA.md` §8.4).

### 3.2 Endpoints

#### `POST /api/auth/login` — pública

A **única** rota pública do sistema. Excepcionalidade justificada por escrito, conforme
`PADROES.md` §5.1.

```jsonc
// Requisição
{ "email": "editor@oraculo.local", "password": "..." }
```

```jsonc
// 200
{
  "data": {
    "user": { "id": 2, "name": "Editor de Catálogo", "email": "...", "role": "EDITOR", "level": 2 },
    "csrfToken": "…64 hex…"
  }
}
```

| Falha | Status | Mensagem |
|---|---|---|
| E-mail ou senha inválidos | `401` | `"E-mail ou senha inválidos."` |
| Usuário inativo | `401` | `"E-mail ou senha inválidos."` |
| Limite de tentativas | `429` | `"Muitas tentativas. Tente novamente em alguns minutos."` |

> **A mensagem é a mesma nos três primeiros casos, de propósito.** Distinguir "usuário não
> existe" de "senha errada" entrega uma lista de usuários válidos a quem tentar
> (`PADROES.md` §5.4). O tempo de resposta também não pode denunciar: verifique o hash
> mesmo quando o usuário não existir.

#### `GET /api/auth/session` — `VIEWER`

Devolve a sessão corrente. É o que o frontend chama no boot para decidir entre a tela de
login e a aplicação.

```jsonc
// 200
{ "data": { "user": { "id": 2, "name": "…", "role": "EDITOR", "level": 2 }, "csrfToken": "…" } }
// 401 → sem sessão. Não é erro inesperado: é o caminho normal de quem ainda não logou.
```

#### `DELETE /api/auth/session` — `VIEWER`

Encerra a sessão **no servidor** (`DELETE` na tabela `sessions`), não apenas no cookie.
Resposta `204`.

---

## 4. Catálogos

Os três endpoints de leitura abaixo são o motor da cascata (RF-20 a RF-27).

### `GET /api/games` — `VIEWER`

```jsonc
{ "data": [
  { "id": "magic",   "name": "Magic: The Gathering" },
  { "id": "pokemon", "name": "Pokémon" },
  { "id": "yugioh",  "name": "Yu-Gi-Oh!" }
] }
```

`id` é o **slug**, não o id numérico: o identificador público precisa ser estável e legível.

### `GET /api/games/{gameId}/editions` — `VIEWER`

```jsonc
// GET /api/games/magic/editions
{ "data": [
  { "id": "dom", "name": "Dominaria" },
  { "id": "war", "name": "War of the Spark" },
  { "id": "eld", "name": "Throne of Eldraine" },
  { "id": "hob", "name": "The Hobbit" },
  { "id": "msh", "name": "Marvel Super Heroes" }
] }
```

> **A forma `{id, name}` é intencional:** é exatamente o formato do JSON publicado no
> enunciado. O frontend consome o contrato que o desafio especificou.

`404` se o jogo não existe ou está inativo.

### `GET /api/games/{gameId}/rarities` — `VIEWER`

Mesma forma, na ordem natural do jogo (comum → mítica), não alfabética.

```jsonc
{ "data": [
  { "id": "common",   "name": "Comum" },
  { "id": "uncommon", "name": "Incomum" },
  { "id": "rare",     "name": "Rara" },
  { "id": "mythic",   "name": "Mítica" }
] }
```

### Escrita nos catálogos — `ADMIN`

| Método | Rota | Efeito |
|---|---|---|
| `POST` | `/api/games` | Cria jogo. Corpo: `{ "slug", "name", "sortOrder"? }` |
| `PUT` | `/api/games/{gameId}` | Atualiza `name`, `active`, `sortOrder`. **`slug` é imutável** — é o identificador público |
| `DELETE` | `/api/games/{gameId}` | Desativa. `409` se houver carta usando o jogo (RF-43) |
| `POST` | `/api/games/{gameId}/editions` | `{ "code", "name", "sortOrder"? }` |
| `PUT` | `/api/editions/{editionId}` | `name`, `active`, `sortOrder` |
| `DELETE` | `/api/editions/{editionId}` | Desativa. `409` se em uso |
| `POST` | `/api/games/{gameId}/rarities` | `{ "code", "name", "sortOrder"? }` |
| `PUT` | `/api/rarities/{rarityId}` | `name`, `active`, `sortOrder` |
| `DELETE` | `/api/rarities/{rarityId}` | Desativa. `409` se em uso |

> **Por que `409` e não exclusão em cascata.** Apagar um jogo levaria junto edições,
> raridades e cartas. Um portal administrativo não pode ter um botão cuja consequência real
> o usuário não consegue prever. Desativar preserva o que já existe e some das opções de
> cadastro novo.

---

## 5. Cartas

### `GET /api/cards` — `VIEWER`

| Parâmetro | Tipo | Padrão | Observação |
|---|---|---|---|
| `page` | inteiro ≥ 1 | `1` | |
| `perPage` | inteiro 1–100 | `20` | Acima de 100 é truncado |
| `search` | texto | — | Casa com `nameEn` **ou** `namePt` |
| `game` | slug | — | |
| `edition` | code | — | Só válido junto de `game` |
| `rarity` | code | — | Só válido junto de `game` |
| `sort` | `recent` \| `name` \| `game` | `recent` | **Allowlist**. Valor fora dela → `400` |

```jsonc
{
  "data": [
    {
      "id": 12,
      "nameEn": "Black Lotus",
      "namePt": null,
      "game":    { "id": "magic", "name": "Magic: The Gathering" },
      "edition": { "id": "dom",   "name": "Dominaria" },
      "rarity":  { "id": "mythic","name": "Mítica" },
      "imageUrl": "https://…",          // null quando não há imagem
      "createdAt": "2026-09-04T12:00:00-03:00",
      "updatedAt": null
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 27, "totalPages": 2 }
}
```

> **`sort` vem de allowlist, sempre.** É o único ponto do sistema onde algo do cliente
> chega perto de um nome de coluna. A allowlist é o que impede injeção por `ORDER BY`
> (`PADROES.md` §7.2).

> **Sem N+1.** Jogo, edição e raridade vêm por `JOIN` na mesma consulta — nunca uma
> consulta por carta dentro do laço (§7.3).

### `GET /api/cards/{id}` — `VIEWER`

Mesmo objeto, dentro de `{ "data": … }`. `404` se não existe ou está excluída.

### `POST /api/cards` — `EDITOR`

```jsonc
{
  "nameEn":  "Black Lotus",
  "namePt":  null,
  "game":    "magic",
  "edition": "dom",
  "rarity":  "mythic",
  "image":   { "type": "upload", "reference": "a1b2…webp" },
  "confirmDuplicate": false
}
```

`image` aceita três formas: `null` (sem imagem), `{ "type": "upload", "reference": … }`
(referência devolvida por `POST /api/uploads/card-image`) ou
`{ "type": "remote", "reference": "https://…" }`.

**A cadeia de validação, nesta ordem** (Chain of Responsibility — ADR-005):

| # | Elo | Falha |
|---|---|---|
| 1 | `nameEn` presente, 1–150 caracteres | `400` `nameEn` |
| 2 | `namePt` ausente ou 1–150 caracteres | `400` `namePt` |
| 3 | `game` existe e está ativo | `400` `game` |
| 4 | `edition` existe **e pertence a `game`** | `400` `editionId` |
| 5 | `rarity` existe **e pertence a `game`** | `400` `rarityId` |
| 6 | Imagem: `type` conhecido; `remote` só com esquema `http`/`https`; `upload` com referência existente | `400` `image` |
| 7 | Duplicidade de nome na edição | `409` — ver abaixo |

A ordem importa: não faz sentido validar a edição antes de saber que o jogo existe.

**Duplicidade (RN-04):** se já houver carta ativa com o mesmo `nameEn` na mesma edição e
`confirmDuplicate` for `false`, a resposta é `409`:

```jsonc
{
  "message": "Já existe uma carta com este nome nesta edição.",
  "duplicate": { "id": 8, "nameEn": "Forest", "edition": { "id": "dom", "name": "Dominaria" } }
}
```

O frontend mostra a carta existente e oferece "cadastrar mesmo assim", que reenvia com
`confirmDuplicate: true`. **Não é bloqueio** — é aviso, porque impressões múltiplas na mesma
edição são legítimas.

Sucesso: `201` com `Location: /api/cards/{id}` e o recurso no corpo.

### `PUT /api/cards/{id}` — `EDITOR`

Corpo idêntico ao `POST`. Mesma cadeia de validação. O corpo é desestruturado **campo a
campo**: `createdBy`, `createdAt` e `id` nunca são lidos do cliente (`PADROES.md` §5.3).

### `DELETE /api/cards/{id}` — `EDITOR`

Exclusão lógica. Resposta `204`. A carta some de toda listagem e contagem imediatamente.

### `POST /api/cards/{id}/restore` — `EDITOR`

Restaura uma carta excluída — é o "Desfazer" da Decisão de UX nº 2. Resposta `200` com o
recurso. `404` se o id não existe; `409` se a carta não está excluída.

### `GET /api/cards/{id}/history` — `EDITOR`

```jsonc
{ "data": [
  {
    "action": "updated",
    "user":   { "id": 2, "name": "Editor de Catálogo" },
    "changes": { "rarity": { "from": "Rara", "to": "Mítica" } },
    "createdAt": "2026-09-04T14:31:02-03:00"
  }
] }
```

`changes` traz **apenas o que mudou**, com valores já apresentáveis — nunca ids internos.

---

## 6. Upload de imagem

### `POST /api/uploads/card-image` — `EDITOR`

`multipart/form-data`, campo `file`. Separado do `POST /api/cards` de propósito: permite
pré-visualizar antes de salvar a carta, e mantém o endpoint de carta em JSON puro.

```jsonc
// 201
{ "data": { "type": "upload", "reference": "a1b2c3….webp", "url": "/api/media/a1b2c3….webp" } }
```

**Regras de segurança, todas obrigatórias:**

| Regra | Por quê |
|---|---|
| Tipo validado pelo **conteúdo** (`finfo`), nunca pela extensão | Extensão é dado do cliente e mente |
| Allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/gif` | Nada de SVG — SVG carrega script |
| Limite de tamanho (`UPLOAD_MAX_BYTES`), verificado antes de gravar | `413` |
| Nome gerado pelo **servidor** (`bin2hex(random_bytes(16))` + extensão do tipo real) | O nome enviado é dado hostil |
| Destino **fora do document root**: `backend/storage/uploads/` | Arquivo em pasta pública é execução remota esperando acontecer |

Falhas: `413` acima do limite · `415` tipo não permitido · `400` arquivo ausente ou corrompido.

### `GET /api/media/{reference}` — `VIEWER`

Serve o arquivo com o `Content-Type` do tipo **validado na gravação**, `Cache-Control`
e `ETag`. `reference` é validada contra `^[a-f0-9]{32}\.(jpg|png|webp|gif)$` antes de
qualquer acesso a disco — nenhum caractere de caminho passa.

> **Por que servir por rota em vez de deixar em pasta pública.** Custa uma passagem pelo PHP
> e devolve três coisas: o arquivo fica fora do document root (não há como executá-lo), o
> acesso respeita a sessão, e o `Content-Type` sai do que foi validado, não do que o
> sistema de arquivos adivinha.

---

## 7. Cabeçalhos de resposta

Aplicados a **todas** as respostas pelo middleware de segurança:

```
Content-Type: application/json; charset=utf-8
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: same-origin
Content-Security-Policy: default-src 'self'; img-src 'self' https: data:;
                         script-src 'self'; style-src 'self'; object-src 'none';
                         base-uri 'none'; frame-ancestors 'none'
```

`img-src` inclui `https:` porque as cartas podem ter imagem por URL externa (RF-31). Todo o
resto é `'self'`. **Sem `unsafe-inline` e sem `unsafe-eval`** — o que obriga todo script e
todo estilo a virem de arquivo, que é a prática correta de qualquer forma.

---

## 8. Pipeline de middleware

Toda requisição atravessa esta cadeia, nesta ordem (Chain of Responsibility — ADR-005):

```
1. TraceId          gera o identificador de correlação da requisição
2. SecurityHeaders  aplica os cabeçalhos do §7
3. JsonBody         desserializa o corpo com proteção; corpo malformado → 400
4. Session          resolve a sessão a partir do cookie (não decide nada)
5. Authenticate     exige sessão válida → 401              [pulado nas rotas públicas]
6. Authorize        exige o nível mínimo da rota → 403     [pulado nas rotas públicas]
7. Csrf             exige X-CSRF-Token em métodos de escrita → 403
8. RateLimit        aplicado apenas onde a rota declara → 429
9. Route            a rota, finalmente
```

Os passos 5 e 6 são o que o `guard(...)` do `PADROES.md` §5.1 instala **no registro da
rota**, dentro do composition root — nunca dentro do corpo da rota. Uma rota registrada sem
guard é achado `CRITICAL`.

---

## 9. Mapa de rotas e níveis exigidos

Esta tabela é a superfície de ataque do sistema. Ela é conferida na auditoria de segurança:
toda rota precisa aparecer aqui **e** estar registrada com o guard correspondente.

| Método | Rota | Nível | Escrita? |
|---|---|---|---|
| `POST` | `/api/auth/login` | **pública** | sim (sem CSRF: cria a sessão) |
| `GET` | `/api/auth/session` | `VIEWER` | não |
| `DELETE` | `/api/auth/session` | `VIEWER` | sim |
| `GET` | `/api/games` | `VIEWER` | não |
| `GET` | `/api/games/{gameId}/editions` | `VIEWER` | não |
| `GET` | `/api/games/{gameId}/rarities` | `VIEWER` | não |
| `POST` | `/api/games` | `ADMIN` | sim |
| `PUT` | `/api/games/{gameId}` | `ADMIN` | sim |
| `DELETE` | `/api/games/{gameId}` | `ADMIN` | sim |
| `POST` | `/api/games/{gameId}/editions` | `ADMIN` | sim |
| `PUT` | `/api/editions/{editionId}` | `ADMIN` | sim |
| `DELETE` | `/api/editions/{editionId}` | `ADMIN` | sim |
| `POST` | `/api/games/{gameId}/rarities` | `ADMIN` | sim |
| `PUT` | `/api/rarities/{rarityId}` | `ADMIN` | sim |
| `DELETE` | `/api/rarities/{rarityId}` | `ADMIN` | sim |
| `GET` | `/api/cards` | `VIEWER` | não |
| `GET` | `/api/cards/{id}` | `VIEWER` | não |
| `POST` | `/api/cards` | `EDITOR` | sim |
| `PUT` | `/api/cards/{id}` | `EDITOR` | sim |
| `DELETE` | `/api/cards/{id}` | `EDITOR` | sim |
| `POST` | `/api/cards/{id}/restore` | `EDITOR` | sim |
| `GET` | `/api/cards/{id}/history` | `EDITOR` | não |
| `POST` | `/api/uploads/card-image` | `EDITOR` | sim |
| `GET` | `/api/media/{reference}` | `VIEWER` | não |

**24 rotas. 1 pública, justificada.** Qualquer rota nova entra nesta tabela no mesmo commit
que a cria.
