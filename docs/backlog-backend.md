# Backlog do Backend — Oráculo

**Janela:** 04/09 a 06/09 · **Estimativa total:** 39 pontos
**Referências obrigatórias:** `docs/ENGENHARIA.md` · `docs/api-contract.md` ·
`docs/database-schema.md` · `docs/decisions/` · `backend/PADROES.md`

---

## Como usar este backlog

Cada tarefa é **autocontida**: quem implementa não precisa perguntar nada para começar.
Contém o objetivo, o que entregar, os critérios de aceite e os testes obrigatórios.

**Regras que valem para todas as tarefas, sem repetição:**

1. **TDD estrito** nas camadas indicadas (ADR-004). O RED é **verificado** antes de escrever
   implementação: o teste falha, e falha pelo motivo certo.
2. `declare(strict_types=1);` no topo de todo arquivo PHP. Tipos em toda assinatura e
   propriedade.
3. Identificadores em inglês; mensagens de usuário, erros e comentários em português.
4. Nenhuma dependência de terceiros (ADR-001).
5. Nenhum valor mágico: nível de permissão pelo enum, status pela classe de erro, valor
   reutilizado vira constante nomeada.
6. Nenhum `SELECT *`, nenhuma leitura sem limite, nenhuma consulta dentro de laço.
7. Todo SQL parametrizado; nome dinâmico de coluna só por allowlist.
8. Toda rota registrada dentro de `guard(...)` no composition root.
9. `php bin/validate.php` verde antes de considerar a tarefa concluída.

**Escala de pontos** (`PADROES.md` §13.4): 1 = meio dia · 2 = 1 dia · 3 = 1–2 dias ·
5 = 3 dias · 8 = 1 semana. Nenhuma tarefa aqui passa de 5.

---

# Épico 0 — Fundação · 13 pontos · 04/09

> Nenhuma feature neste épico. É intencional: o custo de fazer retrofit da fundação no dia 3
> seria maior que o de construí-la agora (ADR-002).

---

### B-001 · Ambiente Docker e configuração validada · 3 pontos
**Depende de:** —

**Objetivo:** `docker compose up` sobe tudo, sem passo manual.

**Entregar:**
- `docker-compose.yml` com dois serviços: `app` (`php:8.3-apache`) e `db` (`mysql:8`).
  Volume nomeado para os dados do MySQL; `healthcheck` no `db` e `depends_on: condition:
  service_healthy` no `app` — sem isso o `app` sobe antes do banco aceitar conexão.
- `Dockerfile` do `app`: habilita `pdo_mysql` e `mod_rewrite`, define o document root como
  `backend/public`, e serve o frontend na mesma origem (ADR-003).
- `.env.example` com **todas** as variáveis, sem valores.
- `src/Shared/Config/Env.php`: `required(string $key): string` que lança
  `RuntimeException` nomeando a variável ausente. **Nenhum fallback literal** — `getenv('X')
  ?: 'default'` é achado CRÍTICO (`PADROES.md` §9.1).
- Entrypoint que roda `bin/migrate.php` e `bin/seed.php` antes de subir o Apache.

**Aceite:**
- [ ] `docker compose up` em máquina limpa deixa a aplicação respondendo, com schema e seed aplicados.
- [ ] Remover uma variável do `.env` faz a aplicação falhar no boot, com o nome da variável na mensagem.
- [ ] `curl` em `/src/`, `/.env` e `/migrations/` devolve 404 — nada fora de `public/` é alcançável.
- [ ] `display_errors=Off`, `log_errors=On`, `error_reporting=E_ALL` no contêiner.

**Testes:** `EnvTest` — variável presente, ausente e string vazia.

---

### B-002 · Autoloader PSR-4 e esqueleto de camadas · 1 ponto
**Depende de:** B-001

**Objetivo:** o mapeamento de namespace funciona sem Composer (ADR-001).

**Entregar:** `src/autoload.php` com `spl_autoload_register`, mapeando `App\` → `src/`; a
árvore de diretórios de `PADROES.md` §2.5; `.gitkeep` onde necessário.

**Aceite:**
- [ ] `App\Domain\Card\Entity\Card` resolve para `src/Domain/Card/Entity/Card.php`.
- [ ] Classe fora do prefixo `App\` é ignorada sem erro.
- [ ] Nenhum `vendor/`, `composer.json` ou `composer.lock` no repositório.

---

### B-003 · Micro-runner de testes · 2 pontos
**Depende de:** B-002

**Objetivo:** portão de testes autoral (ADR-004).

**Entregar:** `bin/test.php` — descobre `tests/**/*Test.php`, instancia, executa métodos
`test*`, e oferece `assertSame`, `assertEquals`, `assertTrue`, `assertFalse`, `assertNull`,
`assertCount` e `assertThrows(string $class, callable $fn)`. Saída com nome do teste, motivo
da falha e contagem final. **Exit code diferente de zero quando algo falha.**

**Aceite:**
- [ ] Teste que falha aparece com nome, valor esperado e valor recebido.
- [ ] Exceção não capturada dentro de um teste é reportada como falha, não derruba o runner.
- [ ] Um teste não interfere no outro.

**Testes:** o próprio runner é verificado com um par de testes propositalmente vermelho e verde.

---

### B-004 · Erros de domínio e tradutor único · 2 pontos
**Depende de:** B-002

**Objetivo:** o status HTTP vem da classe lançada, nunca da rota (`PADROES.md` §4.2).

**Entregar:**
- `src/Domain/Errors/`: `DomainError` (base, 400) e as subclasses `ValidationError` (400),
  `UnauthorizedError` (**401**), `ForbiddenError` (403), `NotFoundError` (404),
  `ConflictError` (409), `PayloadTooLargeError` (413), `UnsupportedMediaTypeError` (415),
  `TooManyRequestsError` (429). Os status seguem `api-contract.md` §2 e **ADR-007**.
- `ValidationError` carrega um mapa opcional `errors: array<string,string>` por campo.
- `src/Infra/Http/ErrorHandler.php`: o **único** tradutor erro → status. Erro que não
  descende de `DomainError` vira 500 com `"Erro interno. Tente novamente."`, e o texto
  original vai **só** para o log.

**Aceite:**
- [ ] Nenhum `http_response_code()` fora do `ErrorHandler`.
- [ ] `SQLSTATE`, nome de tabela, nome de coluna ou caminho de arquivo jamais chegam ao corpo da resposta.
- [ ] Toda mensagem de `DomainError` está em português e é segura para exibir.

**Testes:** `ErrorHandlerTest` — cada classe mapeia ao status certo; exceção genérica vira
500 com mensagem genérica; mapa de campos aparece no corpo do `ValidationError`.

---

### B-005 · Router, Request, Response e pipeline de middleware · 3 pontos
**Depende de:** B-004

**Objetivo:** a Chain of Responsibility do ADR-005.

**Entregar:**
- `src/Infra/Http/`: `Router` (casamento por método + caminho com parâmetro `{id}`),
  `Request` (`fromGlobals()`, acesso a parâmetro de rota, query e corpo **campo a campo**),
  `Response`, e o enum `HttpMethod`.
- `Middleware`: interface `handle(Request $r, callable $next): Response`, e os elos
  `TraceId`, `SecurityHeaders` e `JsonBody` (corpo malformado → `ValidationError`).
- `public/index.php`: front controller que monta a cadeia, registra os módulos e envolve
  tudo num `try/catch` que delega ao `ErrorHandler`.
- Cabeçalhos de segurança conforme `api-contract.md` §7, CSP incluída.

**Aceite:**
- [ ] Rota inexistente devolve 404 com o envelope padrão, não erro do Apache.
- [ ] Método não permitido em rota existente devolve 405.
- [ ] `traceId` presente em toda linha de log da requisição.
- [ ] Cabeçalhos de segurança presentes em **todas** as respostas, inclusive nas de erro.
- [ ] `Request` não expõe nenhum método que devolva o corpo inteiro.

**Testes:** `RouterTest` (casamento, parâmetro, 404, 405), `MiddlewarePipelineTest` (ordem de
execução, curto-circuito quando um elo não chama `$next`).

---

### B-006 · Conexão PDO, migrations e seed · 2 pontos
**Depende de:** B-001, B-004

**Objetivo:** schema e massa inicial reprodutíveis e idempotentes.

**Entregar:**
- `src/Infra/Database/Connection.php` com as quatro opções obrigatórias do `PADROES.md`
  §7.2: `ERRMODE_EXCEPTION`, `EMULATE_PREPARES => false`, `FETCH_ASSOC`,
  `STRINGIFY_FETCHES => false`. Charset `utf8mb4` **na conexão**.
- As 9 migrations de `database-schema.md` §5.
- `bin/migrate.php`: aplica o pendente em ordem, cada arquivo em transação, registrando em
  `schema_migrations`. Idempotente.
- `bin/seed.php`: idempotente por chave natural. Usuários conforme `APP_ENV`
  (`PADROES.md` §16.3); jogos, edições, raridades e cartas conforme
  `database-schema.md` §4.

**Aceite:**
- [ ] `migrate` rodado duas vezes seguidas não produz erro nem alteração.
- [ ] `seed` rodado duas vezes não duplica nenhuma linha.
- [ ] As 15 edições batem **literalmente** com o JSON do enunciado, incluindo as fictícias.
- [ ] Com `APP_ENV` diferente de `local`, o seed não cria usuário com senha fixa.
- [ ] Acentuação de nome de carta grava e lê corretamente.

---

# Épico 1 — Autenticação e autorização · 11 pontos · 05/09

---

### B-010 · Enum de permissão e guard de rota · 2 pontos
**Depende de:** B-005

**Objetivo:** o item de maior valor do `PADROES.md` (§5.1).

**Entregar:**
- `src/Shared/Enum/PermissionLevel.php`: `VIEWER = 1`, `EDITOR = 2`, `ADMIN = 3`, com
  `allows(PermissionLevel $required): bool` implementando a hierarquia (ADR-006).
- Middlewares `Authenticate` (sem sessão → `UnauthorizedError`) e `Authorize` (nível
  insuficiente → `ForbiddenError`).
- Função/decorador `guard(Route $route, PermissionLevel $minimum): Route`, usada **no
  registro** da rota dentro do composition root.

**Aceite:**
- [ ] Nenhuma comparação numérica de nível fora do enum. `grep -rnE "level *[><=]+ *[0-9]" src/` volta vazio.
- [ ] Rota sem guard não existe, exceto `POST /api/auth/login`, com comentário justificando.
- [ ] `ADMIN` alcança rota de `VIEWER`; `VIEWER` não alcança rota de `EDITOR`.

**Testes:** `PermissionLevelTest` — a matriz completa 3×3 de `allows`.
`AuthorizeMiddlewareTest` — nível suficiente, insuficiente, e **o efeito que não pode
acontecer** quando o acesso é negado.

---

### B-011 · Sessão de servidor em MySQL · 3 pontos
**Depende de:** B-006, B-010

**Objetivo:** sessão revogável, acessível de qualquer lugar (ADR-003).

**Entregar:**
- `src/Infra/Session/MySqlSessionHandler.php` implementando `SessionHandlerInterface`
  (nativa) sobre a tabela `sessions`.
- Middleware `Session`: resolve a sessão a partir do cookie. **Não decide nada** — apenas
  disponibiliza.
- Cookie com `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- `SessionGateway` com `deleteById()`, `deleteAllForUser()` e `collectExpired(int $limit)`.
- A coleta de vencidas roda com `LIMIT`, junto da limpeza de `login_attempts`.

**Aceite:**
- [ ] `session_regenerate_id(true)` é chamado no login (fixação de sessão).
- [ ] Logout remove a linha de `sessions`, não apenas o cookie.
- [ ] `deleteAllForUser` encerra sessões de outros dispositivos.
- [ ] Sessão vencida é tratada como ausente.
- [ ] A coleta nunca varre a tabela inteira.

**Testes:** `MySqlSessionHandlerTest` com dublê de gateway — escrita, leitura, leitura de
sessão vencida, destruição, coleta respeitando o limite.

---

### B-012 · Login, logout e limite de tentativas · 3 pontos
**Depende de:** B-011

**Entregar:**
- `AuthenticateUserUseCase` — verifica credencial com `password_verify`, cria a sessão, emite
  o token CSRF.
- `LoginAttemptGateway` — janela deslizante de 5 tentativas / 15 minutos por hash de
  (e-mail + IP). Sucesso limpa o identificador.
- Rotas `POST /api/auth/login` (pública), `GET /api/auth/session`,
  `DELETE /api/auth/session`.
- `AuthModule` como composition root.

**Aceite:**
- [ ] Usuário inexistente, senha errada e usuário inativo devolvem **a mesma** mensagem e o mesmo status (401).
- [ ] O hash é verificado mesmo quando o usuário não existe — o tempo de resposta não denuncia.
- [ ] Sexta tentativa dentro da janela devolve 429.
- [ ] `GET /api/auth/session` sem sessão devolve 401 — caminho normal, não erro inesperado.
- [ ] Nem senha, nem hash, nem token aparecem em log ou em resposta.
- [ ] `login_attempts` guarda hash, nunca o e-mail em claro.

**Testes:** `AuthenticateUserUseCaseTest` — credencial válida; senha errada; usuário
inexistente; usuário inativo; limite excedido; **e a garantia de que nenhuma sessão é criada
em qualquer caminho de falha**.

---

### B-013 · Proteção CSRF · 2 pontos
**Depende de:** B-012

**Entregar:** token de 32 bytes de `random_bytes` por sessão, gravado em
`sessions.csrf_token`; middleware `Csrf` que exige `X-CSRF-Token` em `POST`, `PUT`, `PATCH`
e `DELETE`; comparação com `hash_equals`.

**Aceite:**
- [ ] Escrita sem o cabeçalho, ou com token divergente, devolve **403** (nunca 401 — ADR-007).
- [ ] Leitura não exige token.
- [ ] `POST /api/auth/login` é isento — é o que cria a sessão.
- [ ] Comparação com `hash_equals`, nunca `===`.
- [ ] O token vem de `random_bytes`, nunca de `rand`/`mt_rand`.

**Testes:** `CsrfMiddlewareTest` — token válido, ausente, divergente; método de leitura isento.

---

### B-014 · Troca de senha invalida todas as sessões · 1 ponto
**Depende de:** B-011

**Objetivo:** cumprir `PADROES.md` §5.4 literalmente (RF-05).

**Entregar:** `ChangePasswordUseCase` que, ao gravar o novo hash, chama
`deleteAllForUser($userId)`.

**Aceite:**
- [ ] Após a troca, nenhuma sessão anterior do usuário continua válida.
- [ ] A sessão corrente também é encerrada, e o usuário refaz o login.

**Testes:** `ChangePasswordUseCaseTest` — verifica que o gateway de sessão foi chamado, e que
**não** é chamado quando a troca falha na validação.

---

# Épico 2 — Catálogos · 6 pontos · 06/09

---

### B-020 · Leitura de jogos, edições e raridades · 3 pontos
**Depende de:** B-006, B-010

**Objetivo:** o motor da cascata (RF-20 a RF-27).

**Entregar:** entidades e gateways de `Game`, `Edition` e `Rarity`; repositórios PDO; casos
de uso de listagem; rotas `GET /api/games`, `GET /api/games/{gameId}/editions` e
`GET /api/games/{gameId}/rarities`, todas em `VIEWER`; `CatalogModule`.

**Aceite:**
- [ ] A resposta tem a forma `{ "id": "dom", "name": "Dominaria" }` — o contrato do enunciado.
- [ ] `id` é o slug/código, nunca o id numérico interno.
- [ ] Apenas itens ativos e não excluídos são listados.
- [ ] Ordenação por `sort_order` — raridade sai na ordem natural do jogo, não alfabética.
- [ ] Jogo inexistente ou inativo devolve 404.
- [ ] Colunas listadas explicitamente; nenhum `SELECT *`.

**Testes:** `ListEditionsUseCaseTest` — jogo válido; jogo inexistente; jogo sem edições
(lista vazia, não erro); item inativo filtrado.

---

### B-021 · Escrita nos catálogos (`ADMIN`) · 3 pontos
**Depende de:** B-020

**Entregar:** casos de uso de criar, atualizar e desativar para as três entidades; as 9 rotas
de escrita de `api-contract.md` §4, todas em `ADMIN`.

**Aceite:**
- [ ] `slug` de jogo e `code` de edição/raridade são **imutáveis** na atualização.
- [ ] `code` duplicado dentro do mesmo jogo devolve 409; o mesmo `code` em jogos diferentes é aceito.
- [ ] Exclusão de item em uso por alguma carta devolve 409 com mensagem clara (RF-43).
- [ ] Desativação preserva o item nas cartas que já o usam.
- [ ] `EDITOR` recebe 403 em todas as nove rotas.

**Testes:** um por caso de uso, cobrindo caminho feliz, cada validação e a regra de
autorização. Mais `testRecusaExclusaoDeItemEmUsoComConflictError`.

---

# Épico 3 — Cartas · 9 pontos · 06/09

---

### B-030 · Cadeia de validação da carta · 2 pontos
**Depende de:** B-020

**Objetivo:** a Chain of Responsibility de validação (ADR-005).

**Entregar:** os elos, nesta ordem — `NameEnRequired`, `NamePtLength`, `GameExists`,
`EditionBelongsToGame`, `RarityBelongsToGame`, `ImageIsValid`, `DuplicateWarning`. Cada elo
é uma classe própria, lança `ValidationError` com a chave do campo, e o encadeamento é
montado em um lugar só.

**Aceite:**
- [ ] Edição de outro jogo é recusada, com a mensagem apontando `editionId` (RN-01).
- [ ] Raridade de outro jogo é recusada, apontando `rarityId` (RN-02).
- [ ] `namePt` ausente ou nulo é **válido** (RN-03).
- [ ] A ordem é respeitada: com jogo inexistente, a edição nem chega a ser consultada.
- [ ] Cada elo é testável isoladamente, sem os outros.

**Testes:** um por elo, além de `ValidationChainTest` verificando a ordem e a interrupção no
primeiro erro.

---

### B-031 · Strategy de imagem e upload · 3 pontos
**Depende de:** B-005

**Objetivo:** ADR-008.

**Entregar:** porta `ImageSource`; `UploadedFileImageSource` e `RemoteUrlImageSource`;
`StoreCardImageUseCase`; rotas `POST /api/uploads/card-image` e `GET /api/media/{reference}`,
ambas em `EDITOR`/`VIEWER` conforme o contrato.

**Aceite:**
- [ ] Tipo validado por `finfo` (conteúdo), nunca por extensão.
- [ ] Allowlist `image/jpeg`, `image/png`, `image/webp`, `image/gif`. **SVG recusado com 415.**
- [ ] Arquivo `.jpg` cujo conteúdo é PHP é recusado.
- [ ] Acima do limite → 413, verificado **antes** de gravar.
- [ ] Nome gerado por `bin2hex(random_bytes(16))`; o nome enviado nunca é usado.
- [ ] Destino fora do document root; `curl` direto no arquivo devolve 404.
- [ ] `reference` validada contra a expressão regular antes de qualquer acesso a disco.
- [ ] URL remota só com esquema `http`/`https`; `javascript:`, `data:` e `file:` recusados.

**Testes:** `RemoteUrlImageSourceTest` — esquemas válidos e cada esquema perigoso.
`UploadedFileImageSourceTest` — tipo válido, tipo mentido, SVG, tamanho excedido, nome
hostil.

---

### B-032 · CRUD de cartas · 4 pontos
**Depende de:** B-030, B-031

**Entregar:** entidade `Card` e `CardGateway`; `CardRepositoryPdo`; os casos de uso
`ListCards`, `GetCard`, `CreateCard`, `UpdateCard`, `DeleteCard` e `RestoreCard`; as 6 rotas
de `api-contract.md` §5; `CardModule`.

**Aceite:**
- [ ] Listagem paginada, com o envelope `{data, pagination}` do contrato.
- [ ] `perPage` acima de 100 é **truncado**, não rejeitado.
- [ ] `sort` vem de allowlist; valor fora dela devolve 400.
- [ ] Busca casa com `nameEn` **ou** `namePt`.
- [ ] Filtros de jogo, edição e raridade combinam entre si.
- [ ] Jogo, edição e raridade vêm por `JOIN` na mesma consulta — **sem N+1**.
- [ ] Exclusão é lógica; a carta some de toda listagem e de toda contagem.
- [ ] Restaurar carta não excluída devolve 409.
- [ ] Nome duplicado na mesma edição devolve 409 com a carta existente no corpo; reenvio com
      `confirmDuplicate: true` é aceito (RN-04).
- [ ] O corpo é desestruturado campo a campo; `id`, `createdBy` e `createdAt` nunca vêm do cliente.
- [ ] `createdBy` e `updatedBy` vêm da **sessão** (RN-08).
- [ ] A resposta expõe `imageUrl` pronta; nunca o par `(image_type, image_reference)`.

**Testes:** um por caso de uso, cobrindo caminho feliz, cada validação, cada regra de
autorização, e o efeito que não pode acontecer quando o acesso é negado. Mais
`testNaoRetornaCartaExcluida` e `testRecusaRestauracaoDeCartaAtiva`.

---

# Épico 4 — Auditoria · 3 pontos · 06/09

> **Primeiro corte se o dia 06 atrasar** (PRD §10). Se cair, cai inteiro — a auditoria não
> migra para dentro dos casos de uso, porque aí o padrão teria sido substituído pelo
> acoplamento que ele existe para evitar (ADR-005).

---

### B-040 · Dispatcher, eventos e trilha de auditoria · 3 pontos
**Depende de:** B-032

**Entregar:**
- `src/Shared/Event/EventDispatcher.php` (~40 linhas) e a interface `DomainEvent`.
- Eventos `CardCreated`, `CardUpdated`, `CardDeleted`, `CardRestored`.
- `src/Infra/EventHandlers/WriteCardAuditHandler.php` gravando em `card_audit`, com o
  `traceId` da requisição.
- Registro dos handlers em um único lugar, ligado pelo composition root.
- `GET /api/cards/{id}/history` (`EDITOR`).

**Aceite:**
- [ ] **O handler nunca lança.** Corpo inteiro em try/catch; falha vira log
      (`PADROES.md` §2.4).
- [ ] Falha ao gravar auditoria **não** produz erro para quem salvou a carta.
- [ ] `changes` guarda apenas o que mudou, com valores apresentáveis — nunca ids internos,
      nunca a linha inteira.
- [ ] O caso de uso despacha o evento; não conhece o handler.
- [ ] Nenhum caso de uso chama outro caso de uso.

**Testes:** `EventDispatcherTest` — despacho a múltiplos handlers; **handler que lança não
propaga a exceção**; handler não registrado é ignorado.
`WriteCardAuditHandlerTest` — o diff contém só os campos alterados.

---

## Sequenciamento e paralelismo

```
B-001 ─┬─ B-002 ─ B-003
       │            └── (portão pronto: daqui em diante todo commit passa por bin/validate.php)
       ├─ B-004 ─ B-005 ─┬─ B-010 ─┬─ B-011 ─ B-012 ─┬─ B-013
       │                 │         │                 └─ B-014
       │                 │         └─ B-020 ─ B-021
       │                 └─ B-031
       └─ B-006 ─────────────────────┘
                                     B-020 ─ B-030 ─┬─ B-032 ─ B-040
                                            B-031 ──┘
```

**O caminho crítico é `B-001 → B-004 → B-005 → B-010 → B-011 → B-012`.** Tudo mais depende
de a autenticação estar de pé.

`B-020` (leitura de catálogos) é a dependência do frontend para a cascata — **priorizar** sua
conclusão, porque é o que destrava o trabalho do dia 07 em paralelo.

---

## Conferência final do backend

Antes de declarar o backend pronto, rodar a auditoria contra estas oito perguntas
(`PADROES.md` §17.1 e §17.2):

- [ ] Toda rota de `api-contract.md` §9 está registrada com o guard do nível declarado?
- [ ] Alguma rota destrutiva é alcançável no nível mais baixo?
- [ ] Existe algum `http_response_code()` fora do `ErrorHandler`?
- [ ] Existe algum `SELECT *`, leitura sem limite ou consulta dentro de laço?
- [ ] Existe algum `getenv('X') ?: 'valor'` ou segredo commitado?
- [ ] Existe algum corpo de requisição repassado inteiro?
- [ ] Existe algum `echo`, `var_dump` ou `print_r` fora de `bin/`?
- [ ] Algum handler de evento pode lançar?
