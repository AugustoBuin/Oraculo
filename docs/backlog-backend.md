# Backlog do Backend — Oráculo

**Janela planejada:** 04/09 a 06/09 · **Realizado:** 05/09, e o B-022 em 10/09 · **Estimativa total:** 39 pontos
**Referências obrigatórias:** `docs/ENGENHARIA.md` · `docs/api-contract.md` ·
`docs/database-schema.md` · `docs/decisions/` · `backend/PADROES.md`

---

## Estado em 14/09/2026

**Todas as tarefas foram entregues.** As datas dos épicos são as reais, tiradas do histórico do
Git: o plano previa três dias, e o backend inteiro entrou em 05/09. As caixas de aceite foram
marcadas na revisão de 14/09, com esta base:

- a suíte do backend verde (263 testes) e o `bin/validate.php` verde;
- a auditoria completa de 09/09 e a auditoria do que mudou, de 14/09, sem achado crítico;
- a verificação em tela de 09/09.

Onde a execução mudou o que o critério pedia, a linha leva **Mudou:** e o que foi entregue no
lugar. Tarefas registradas depois de implementadas estão marcadas como **retroativas**.

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

# Épico 0 — Fundação · 13 pontos · 05/09

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
- [x] `docker compose up` em máquina limpa deixa a aplicação respondendo, com schema e seed aplicados.
- [x] Remover uma variável do `.env` faz a aplicação falhar no boot, com o nome da variável na mensagem.
- [x] `curl` em `/src/`, `/.env` e `/migrations/` devolve 404 — nada fora de `public/` é alcançável.
      **Mudou:** com o fallback da SPA, caminho desconhecido devolve o `index.html`, e `/src` é o
      `Alias` do código do frontend, que é público por natureza. O que o critério protege continua
      valendo: `.env`, `migrations/` e `backend/src` ficam fora do `DocumentRoot`
      (`docker/app/apache.conf`).
- [x] `display_errors=Off`, `log_errors=On`, `error_reporting=E_ALL` no contêiner.

**Testes:** `EnvTest` — variável presente, ausente e string vazia.

---

### B-002 · Autoloader PSR-4 e esqueleto de camadas · 1 ponto
**Depende de:** B-001

**Objetivo:** o mapeamento de namespace funciona sem Composer (ADR-001).

**Entregar:** `src/autoload.php` com `spl_autoload_register`, mapeando `App\` → `src/`; a
árvore de diretórios de `PADROES.md` §2.5; `.gitkeep` onde necessário.

**Aceite:**
- [x] `App\Domain\Card\Entity\Card` resolve para `src/Domain/Card/Entity/Card.php`.
- [x] Classe fora do prefixo `App\` é ignorada sem erro.
- [x] Nenhum `vendor/`, `composer.json` ou `composer.lock` no repositório.

---

### B-003 · Micro-runner de testes · 2 pontos
**Depende de:** B-002

**Objetivo:** portão de testes autoral (ADR-004).

**Entregar:** `bin/test.php` — descobre `tests/**/*Test.php`, instancia, executa métodos
`test*`, e oferece `assertSame`, `assertEquals`, `assertTrue`, `assertFalse`, `assertNull`,
`assertCount` e `assertThrows(string $class, callable $fn)`. Saída com nome do teste, motivo
da falha e contagem final. **Exit code diferente de zero quando algo falha.**

**Aceite:**
- [x] Teste que falha aparece com nome, valor esperado e valor recebido.
- [x] Exceção não capturada dentro de um teste é reportada como falha, não derruba o runner.
- [x] Um teste não interfere no outro.

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
- [x] Nenhum `http_response_code()` fora do `ErrorHandler`.
- [x] `SQLSTATE`, nome de tabela, nome de coluna ou caminho de arquivo jamais chegam ao corpo da resposta.
- [x] Toda mensagem de `DomainError` está em português e é segura para exibir.

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
- [x] Rota inexistente devolve 404 com o envelope padrão, não erro do Apache.
- [x] Método não permitido em rota existente devolve 405.
- [x] `traceId` presente em toda linha de log da requisição.
- [x] Cabeçalhos de segurança presentes em **todas** as respostas, inclusive nas de erro.
- [x] `Request` não expõe nenhum método que devolva o corpo inteiro.

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
- As migrations de `database-schema.md` §5 — nove no plano; a 0010 veio com a sessão explícita
  (B-011), e a 0011 e a 0012 com a cor da raridade (B-022).
- `bin/migrate.php`: aplica o pendente em ordem, cada arquivo em transação, registrando em
  `schema_migrations`. Idempotente.
- `bin/seed.php`: idempotente por chave natural. Usuários conforme `APP_ENV`
  (`PADROES.md` §16.3); jogos, edições, raridades e cartas conforme
  `database-schema.md` §4.

**Aceite:**
- [x] `migrate` rodado duas vezes seguidas não produz erro nem alteração.
- [x] `seed` rodado duas vezes não duplica nenhuma linha.
- [x] As 15 edições batem **literalmente** com o JSON do enunciado, inclusive as quatro mais recentes.
- [x] Com `APP_ENV` diferente de `local`, o seed não cria usuário com senha fixa.
- [x] Acentuação de nome de carta grava e lê corretamente.

---

### B-007 · Verificador de fronteiras e cadeia de validação · retroativa
**Entregue em:** 05/09 · **Registrada:** 14/09, depois de implementada.

**Objetivo:** fronteira sem verificador é sugestão (ADR-002).

**Entregue:** `bin/check-boundaries.php`, que verifica as camadas do PHP e o isolamento entre
features do JS; `bin/validate.php`, a cadeia completa — marcador de conflito, `php -l`,
fronteiras e testes —, que o `pre-push` roda no contêiner. Junto das tarefas seguintes vieram
`bin/check-sql-placeholders.php` (B-032) e `bin/routes.php` (B-021), que imprime o mapa de rotas
a partir dos composition roots e falha se aparecer uma segunda rota pública.

**Aceite:**
- [x] O `pre-push` roda a cadeia no contêiner e barra o envio quando ela fica vermelha.
- [x] O mapa de rotas do `api-contract.md` §9 é a saída do `bin/routes.php`: 22 rotas, 1 pública.

**Testes:** `LayerBoundaryTest`.

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
  registro** da rota dentro do composition root. **Mudou:** o nome ficou
  `Guard::protect($rota, $nivel)`.

**Aceite:**
- [x] Nenhuma comparação numérica de nível fora do enum. `grep -rnE "level *[><=]+ *[0-9]" src/` volta vazio.
- [x] Rota sem guard não existe, exceto `POST /api/auth/login`, com comentário justificando.
- [x] `ADMIN` alcança rota de `VIEWER`; `VIEWER` não alcança rota de `EDITOR`.

**Testes:** `PermissionLevelTest` — a matriz completa 3×3 de `allows`.
`AuthorizeMiddlewareTest` — nível suficiente, insuficiente, e **o efeito que não pode
acontecer** quando o acesso é negado.

---

### B-011 · Sessão de servidor em MySQL · 3 pontos
**Depende de:** B-006, B-010

**Objetivo:** sessão revogável, acessível de qualquer lugar (ADR-003).

**Entregar:**
- `src/Infra/Session/MySqlSessionHandler.php` implementando `SessionHandlerInterface`
  (nativa) sobre a tabela `sessions`. **Mudou:** a sessão virou explícita — entidade
  `Session`, `SessionGateway` e `SessionMiddleware` —, porque o handler nativo trata o conteúdo
  como um blob opaco (ADR-003). A migration 0010 tirou a coluna `payload`.
- Middleware `Session`: resolve a sessão a partir do cookie. **Não decide nada** — apenas
  disponibiliza.
- Cookie com `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- `SessionGateway` com `deleteById()`, `deleteAllForUser()` e `collectExpired(int $limit)`.
- A coleta de vencidas roda com `LIMIT`, junto da limpeza de `login_attempts`.

**Aceite:**
- [x] Cada login gera um id de sessão novo, de `random_bytes` (fixação de sessão). **Mudou:** o
      critério pedia `session_regenerate_id(true)`, que a sessão explícita dispensa.
- [x] Logout remove a linha de `sessions`, não apenas o cookie.
- [x] `deleteAllForUser` encerra sessões de outros dispositivos.
- [x] Sessão vencida é tratada como ausente.
- [x] A coleta nunca varre a tabela inteira.

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
- [x] Usuário inexistente, senha errada e usuário inativo devolvem **a mesma** mensagem e o mesmo status (401).
- [x] O hash é verificado mesmo quando o usuário não existe — o tempo de resposta não denuncia.
- [x] Sexta tentativa dentro da janela devolve 429.
- [x] `GET /api/auth/session` sem sessão devolve 401 — caminho normal, não erro inesperado.
- [x] Nem senha, nem hash, nem token aparecem em log ou em resposta.
- [x] `login_attempts` guarda hash, nunca o e-mail em claro.

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
- [x] Escrita sem o cabeçalho, ou com token divergente, devolve **403** (nunca 401 — ADR-007).
- [x] Leitura não exige token.
- [x] `POST /api/auth/login` é isento — é o que cria a sessão.
- [x] Comparação com `hash_equals`, nunca `===`.
- [x] O token vem de `random_bytes`, nunca de `rand`/`mt_rand`.

**Testes:** `CsrfMiddlewareTest` — token válido, ausente, divergente; método de leitura isento.

---

### B-014 · Troca de senha invalida todas as sessões · 1 ponto
**Depende de:** B-011

**Objetivo:** cumprir `PADROES.md` §5.4 literalmente (RF-05).

**Entregar:** `ChangePasswordUseCase` que, ao gravar o novo hash, chama
`deleteAllForUser($userId)`.

**Aceite:**
- [x] Após a troca, nenhuma sessão anterior do usuário continua válida.
- [x] A sessão corrente também é encerrada, e o usuário refaz o login.

**Testes:** `ChangePasswordUseCaseTest` — verifica que o gateway de sessão foi chamado, e que
**não** é chamado quando a troca falha na validação.

---

# Épico 2 — Catálogos · 6 pontos · 05/09 (o B-022 em 10/09)

---

### B-020 · Leitura de jogos, edições e raridades · 3 pontos
**Depende de:** B-006, B-010

**Objetivo:** o motor da cascata (RF-20 a RF-27).

**Entregar:** entidades e gateways de `Game`, `Edition` e `Rarity`; repositórios PDO; casos
de uso de listagem; rotas `GET /api/games`, `GET /api/games/{gameId}/editions` e
`GET /api/games/{gameId}/rarities`, todas em `VIEWER`; `CatalogModule`.

**Aceite:**
- [x] A resposta tem a forma `{ "id": "dom", "name": "Dominaria" }` — o contrato do enunciado.
- [x] `id` é o slug/código, nunca o id numérico interno.
- [x] Apenas itens ativos e não excluídos são listados.
- [x] Ordenação por `sort_order` — raridade sai na ordem natural do jogo, não alfabética.
- [x] Jogo inexistente ou inativo devolve 404.
- [x] Colunas listadas explicitamente; nenhum `SELECT *`.

**Testes:** `ListEditionsUseCaseTest` — jogo válido; jogo inexistente; jogo sem edições
(lista vazia, não erro); item inativo filtrado.

**Extensão (07/09):** `?incluirInativos=1`, só para `ADMIN`, lista também os itens desativados,
com `active`, `ref` e `sortOrder`. Sem ela, a tela de catálogos não tinha de onde reativar um
item. Quem decide se o parâmetro vale é o caso de uso, pelo nível da sessão.

---

### B-021 · Escrita nos catálogos (`ADMIN`) · 3 pontos
**Depende de:** B-020

**Entregar:** casos de uso de criar, atualizar e desativar para as três entidades; as 9 rotas
de escrita de `api-contract.md` §4, todas em `ADMIN`.

**Mudou:** são **seis** rotas, de edição e de raridade. Gestão de jogos não existe nesta API:
criar um jogo sem raridades deixaria o sistema num estado pior do que não ter o botão
(`api-contract.md` §4).

**Aceite:**
- [x] `slug` de jogo e `code` de edição/raridade são **imutáveis** na atualização. **Mudou:** só
      o `code`, já que jogo não se altera pela API.
- [x] `code` duplicado dentro do mesmo jogo devolve 409; o mesmo `code` em jogos diferentes é aceito.
- [x] Desativar item em uso não falha: devolve `wasInUse`, e a interface avisa que as cartas
      continuam como estão (RF-43). **Mudou:** o critério pedia 409; desativar é reversível, e
      avisar depois de agir é honesto quando dá para voltar atrás (`api-contract.md` §4).
- [x] Desativação preserva o item nas cartas que já o usam.
- [x] `EDITOR` recebe 403 nas seis rotas.

**Testes:** um por caso de uso, cobrindo caminho feliz, cada validação e a regra de
autorização. Mais a desativação de item em uso, em `DeactivateCatalogItemUseCaseTest`.

---

### B-022 · Cor da raridade · 3 pontos
**Depende de:** B-021 · **Plano:** `docs/rarity-colors-plan.md`

**Entregar:** a raridade com cor (RF-44): `RarityColor` como allowlist dos dez materiais,
migrations 0011 e 0012, criar e alterar raridade com cor, e a cor na carta e na listagem da
administração. A escrita de edição se separa da de raridade, que é a divergência que a cor
criou.

**Aceite:**
- [x] Cor fora da paleta, ou que não seja texto, devolve 400 em `color`, junto dos outros campos.
- [x] Criar sem cor dá grafite; alterar sem cor dá 400 — o PUT é substituição.
- [x] A listagem pública de raridade continua `{id, name}`; a da administração ganha `color` e `sortOrder`.
- [x] A cor vem no mesmo `JOIN` da leitura de carta, sem consulta nova.
- [x] O seed pinta só na inserção; um banco que já existia recebe as cores pela 0012.
- [x] O caminho genérico de escrita sai, e com ele os campos mortos do M-3.

**Testes:** `RarityColorTest`, `RarityTest`, `CatalogItemRulesTest`, criar e alterar edição e
raridade, desativar, e os apresentadores de catálogo e de carta — este último não existia.

---

# Épico 3 — Cartas · 9 pontos · 05/09

---

### B-030 · Cadeia de validação da carta · 2 pontos
**Depende de:** B-020

**Objetivo:** a Chain of Responsibility de validação (ADR-005).

**Entregar:** os elos, nesta ordem — `NameEnRequired`, `NamePtLength`, `GameExists`,
`EditionBelongsToGame`, `RarityBelongsToGame`, `ImageIsValid`, `DuplicateWarning`. Cada elo
é uma classe própria, lança `ValidationError` com a chave do campo, e o encadeamento é
montado em um lugar só.

**Aceite:**
- [x] Edição de outro jogo é recusada, com a mensagem apontando `editionId` (RN-01).
- [x] Raridade de outro jogo é recusada, apontando `rarityId` (RN-02).
- [x] `namePt` ausente ou nulo é **válido** (RN-03).
- [x] A ordem é respeitada: com jogo inexistente, a edição nem chega a ser consultada.
- [x] Cada elo é testável isoladamente, sem os outros.

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
- [x] Tipo validado por `finfo` (conteúdo), nunca por extensão.
- [x] Allowlist `image/jpeg`, `image/png`, `image/webp`, `image/gif`. **SVG recusado com 415.**
- [x] Arquivo `.jpg` cujo conteúdo é PHP é recusado.
- [x] Acima do limite → 413, verificado **antes** de gravar.
- [x] Nome gerado por `bin2hex(random_bytes(16))`; o nome enviado nunca é usado.
- [x] Destino fora do document root; `curl` direto no arquivo devolve 404.
- [x] `reference` validada contra a expressão regular antes de qualquer acesso a disco.
- [x] URL remota só com esquema `http`/`https`; `javascript:`, `data:` e `file:` recusados.

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
- [x] Listagem paginada, com o envelope `{data, pagination}` do contrato.
- [x] `perPage` acima de 100 é **truncado**, não rejeitado.
- [x] `sort` vem de allowlist; valor fora dela devolve 400.
- [x] Busca casa com `nameEn` **ou** `namePt`.
- [x] Filtros de jogo, edição e raridade combinam entre si.
- [x] Jogo, edição e raridade vêm por `JOIN` na mesma consulta — **sem N+1**.
- [x] Exclusão é lógica; a carta some de toda listagem e de toda contagem.
- [x] Restaurar carta não excluída devolve 409.
- [x] Nome duplicado na mesma edição devolve 409 com a carta existente no corpo; reenvio com
      `confirmDuplicate: true` é aceito (RN-04).
- [x] O corpo é desestruturado campo a campo; `id`, `createdBy` e `createdAt` nunca vêm do cliente.
- [x] `createdBy` e `updatedBy` vêm da **sessão** (RN-08).
- [x] A resposta expõe `imageUrl` pronta; nunca o par `(image_type, image_reference)`.

**Testes:** um por caso de uso, cobrindo caminho feliz, cada validação, cada regra de
autorização, e o efeito que não pode acontecer quando o acesso é negado. Mais
`testNaoRetornaCartaExcluida` e `testRecusaRestauracaoDeCartaAtiva`.

---

# Épico 4 — Auditoria · 3 pontos · 05/09

> **Primeiro corte se o dia 06 atrasar** (PRD §10). **Não precisou: entrou em 05/09.** Se cair, cai inteiro — a auditoria não
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
- [x] **O handler nunca lança.** Corpo inteiro em try/catch; falha vira log
      (`PADROES.md` §2.4).
- [x] Falha ao gravar auditoria **não** produz erro para quem salvou a carta.
- [x] `changes` guarda apenas o que mudou, com valores apresentáveis — nunca ids internos,
      nunca a linha inteira.
- [x] O caso de uso despacha o evento; não conhece o handler.
- [x] Nenhum caso de uso chama outro caso de uso.

**Testes:** `EventDispatcherTest` — despacho a múltiplos handlers; **handler que lança não
propaga a exceção**; handler não registrado é ignorado.
`WriteCardAuditHandlerTest` — o diff contém só os campos alterados.

---

# Correções depois da entrega planejada · retroativas

---

### B-050 · Parâmetro que não é texto não derruba a requisição (OF-001) · retroativa
**Entregue em:** 09/09 · **Origem:** auditoria completa de 09/09.

**O defeito:** parâmetro de consulta ou cookie em forma de array (`?page[]=1`) virava
`ErrorException` e resposta 500 em qualquer rota `/api/*`, sem autenticação.

**Entregue:** o `Request` descarta o que não é escalar ao ler query e cookie.

**Aceite:**
- [x] As requisições com array respondem como a bem formada — repetido contra o contêiner na
      auditoria de 14/09.

**Testes:** três em `RequestTest`.

---

### B-051 · O seed não desfaz o que o ADMIN editou (OF-006) · retroativa
**Entregue em:** 14/09 · **Origem:** auditoria do que mudou, de 14/09.

**O defeito:** o seed, que roda a cada boot, reescrevia nome e ordem de edições e raridades, e a
edição do ADMIN voltava ao valor da massa no próximo `docker compose up`.

**Entregue:** `ON DUPLICATE KEY UPDATE id = id` nas duas instruções.

**Aceite:**
- [x] Uma edição e uma raridade alteradas no banco sobrevivem ao seed — reproduzido antes e
      depois da correção.

**Testes:** `SeedPreservesAdminEditsTest`.

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

**Respondidas em 09/09 e 14/09** pelas auditorias de qualidade e de segurança, sem nenhuma
resposta que reprove.

- [x] Toda rota de `api-contract.md` §9 está registrada com o guard do nível declarado?
- [x] Alguma rota destrutiva é alcançável no nível mais baixo?
- [x] Existe algum `http_response_code()` fora do `ErrorHandler`?
- [x] Existe algum `SELECT *`, leitura sem limite ou consulta dentro de laço?
- [x] Existe algum `getenv('X') ?: 'valor'` ou segredo commitado?
- [x] Existe algum corpo de requisição repassado inteiro?
- [x] Existe algum `echo`, `var_dump` ou `print_r` fora de `bin/`?
- [x] Algum handler de evento pode lançar?
