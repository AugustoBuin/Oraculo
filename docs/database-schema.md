# Schema do Banco — Oráculo

**Motor:** MySQL 8 · InnoDB · `utf8mb4` / `utf8mb4_unicode_ci`
**Migrations:** um arquivo `.sql` por mudança, numerado e **imutável** (`PADROES.md` §7.5).

> **Idioma das colunas.** Inglês. O `PADROES.md` §7.6 trata o caso de banco já existente em
> português; aqui o banco é novo, e o §8.1 manda identificador em inglês. O mapeamento
> entidade ↔ linha vive de qualquer forma **apenas no repositório**, com colunas listadas
> explicitamente — então trocar para português depois é mudar um arquivo por entidade.

> **`utf8mb4` obrigatório.** Nomes de carta contêm acentuação e caracteres que o `utf8` do
> MySQL (que tem 3 bytes e não é UTF-8) trunca. Vale no banco, nas tabelas **e na conexão**.

---

## 1. Visão geral

```
users ──┬──< sessions
        ├──< login_attempts (por identificador, não por FK)
        └──< card_audit >── cards

games ──┬──< editions ──┐
        └──< rarities ──┤
                        └──< cards
```

| Tabela | Papel |
|---|---|
| `schema_migrations` | Controle de migrations aplicadas |
| `users` | Contas do portal, com nível de permissão |
| `sessions` | Sessões de servidor — permite revogação real (ADR-003) |
| `login_attempts` | Janela deslizante para o limite de tentativas |
| `games` | Os card games. **É o discriminador de tenant** (PRD §1.1) |
| `editions` | Edições, pertencentes a um jogo |
| `rarities` | Raridades, pertencentes a um jogo |
| `cards` | O agregado principal |
| `card_audit` | Trilha de auditoria, alimentada por evento de domínio |

---

## 2. Convenções aplicadas a todas as tabelas

- Chave primária `id INT UNSIGNED AUTO_INCREMENT`, exceto `sessions` (id de sessão) e
  `schema_migrations` (versão).
- `created_at DATETIME NOT NULL`, `updated_at DATETIME NULL`.
- `deleted_at DATETIME NULL` onde há histórico a preservar (`PADROES.md` §7.4) —
  **toda leitura filtra `deleted_at IS NULL`**.
- Chaves estrangeiras declaradas no banco, não só na aplicação (§7.4).
- Índice em **toda** coluna usada em `WHERE`, `JOIN` ou `ORDER BY` de rota quente (§7.3).
- `ON DELETE RESTRICT` como padrão: nada de exclusão em cascata silenciosa. Onde a
  cascata é correta e desejada, está declarado e comentado.

---

## 3. Tabelas

### 3.1 `schema_migrations`

```sql
CREATE TABLE schema_migrations (
    version     VARCHAR(64)  NOT NULL,
    applied_at  DATETIME     NOT NULL,
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`bin/migrate.php` aplica em ordem o que ainda não está aqui, cada arquivo dentro de uma
transação. É idempotente e roda no boot do contêiner.

---

### 3.2 `users`

```sql
CREATE TABLE users (
    id             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    name           VARCHAR(120)     NOT NULL,
    email          VARCHAR(190)     NOT NULL,
    password_hash  VARCHAR(255)     NOT NULL,
    -- Espelha o enum PermissionLevel do código. O número NUNCA é comparado
    -- diretamente na aplicação: sempre via PermissionLevel (PADROES.md §5.1).
    role_level     TINYINT UNSIGNED NOT NULL,
    active         TINYINT(1)       NOT NULL DEFAULT 1,
    created_at     DATETIME         NOT NULL,
    updated_at     DATETIME         NULL,
    deleted_at     DATETIME         NULL,
    PRIMARY KEY (id),
    -- 190 e não 255: limite do índice utf8mb4 em InnoDB com prefixo de 767 bytes.
    UNIQUE KEY uk_users_email (email),
    KEY idx_users_active (active, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`password_hash` recebe `password_hash($senha, PASSWORD_BCRYPT, ['cost' => 12])`.
255 caracteres deixa espaço para uma futura troca de algoritmo sem migration.

**Níveis** (`App\Shared\Enum\PermissionLevel`):

| Valor | Nome | Pode |
|---|---|---|
| 1 | `VIEWER` | Listar e visualizar cartas |
| 2 | `EDITOR` | Tudo do `VIEWER` + criar, editar, excluir e restaurar cartas; ver histórico |
| 3 | `ADMIN` | Tudo do `EDITOR` + gerenciar jogos, edições e raridades |

---

### 3.3 `sessions`

```sql
CREATE TABLE sessions (
    id               VARCHAR(128)  NOT NULL,   -- id gerado pelo PHP
    user_id          INT UNSIGNED  NOT NULL,
    csrf_token       CHAR(64)      NOT NULL,   -- por sessão, emitido no login
    ip_address       VARCHAR(45)   NULL,       -- 45 = IPv6 completo
    user_agent       VARCHAR(255)  NULL,
    created_at       DATETIME      NOT NULL,
    last_activity_at DATETIME      NOT NULL,
    expires_at       DATETIME      NOT NULL,
    PRIMARY KEY (id),
    -- Permite encerrar TODAS as sessões de um usuário em um DELETE (RF-05).
    KEY idx_sessions_user (user_id),
    -- Permite a coleta de sessões vencidas com LIMIT.
    KEY idx_sessions_expires (expires_at),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> **Por que a sessão está no banco e não em arquivo.** É o que torna possível o
> `PADROES.md` §5.4 literalmente: *"logout invalida a sessão no servidor"* e *"troca de
> senha invalida todas as sessões do usuário"* — ambos viram um `DELETE`. Com sessão em
> arquivo, revogar a sessão de outro dispositivo é praticamente impossível. Detalhes e
> alternativas descartadas em `docs/decisions/ADR-003`.

> **Sem coluna `payload`.** O desenho original previa a serialização nativa do PHP; a
> sessão passou a ser explícita e a coluna foi removida pela migration `0010`. O histórico
> está no ADR-003.

> **A cascata aqui é deliberada:** excluir um usuário deve encerrar as sessões dele
> imediatamente. É o único `ON DELETE CASCADE` do schema.

---

### 3.4 `login_attempts`

```sql
CREATE TABLE login_attempts (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- Hash de (e-mail + IP). Guardar o e-mail em claro aqui transformaria a tabela
    -- em uma lista de usuários do sistema legível por qualquer leitura acidental.
    identifier   CHAR(64)     NOT NULL,
    attempted_at DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_attempts_window (identifier, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Janela deslizante: 5 tentativas por 15 minutos (RF-03). Registros mais antigos que a janela
são removidos junto com a coleta de sessões vencidas. Só a **falha** é registrada; o login
bem-sucedido limpa o identificador.

---

### 3.5 `games`

```sql
CREATE TABLE games (
    id         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    -- Identificador estável exposto na API ('magic', 'pokemon', 'yugioh').
    -- A API nunca expõe o id numérico de catálogo: o slug é o contrato público.
    slug       VARCHAR(32)      NOT NULL,
    name       VARCHAR(80)      NOT NULL,
    active     TINYINT(1)       NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME         NOT NULL,
    updated_at DATETIME         NULL,
    deleted_at DATETIME         NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_games_slug (slug),
    KEY idx_games_listing (active, deleted_at, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> **Esta tabela é a tese do produto.** Um `ENUM('magic','pokemon','yugioh')` na coluna de
> `cards` custaria menos hoje e travaria o produto amanhã: adicionar o LigaLorcana viraria
> uma migration com `ALTER TABLE` e um deploy. Aqui é um `INSERT`.

---

### 3.6 `editions`

```sql
CREATE TABLE editions (
    id         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    game_id    INT UNSIGNED     NOT NULL,
    -- O "id" do JSON do desafio: 'dom', 'war', 'base1', 'lob'...
    -- Exposto na API como `id`, para bater exatamente com o contrato do enunciado.
    code       VARCHAR(32)      NOT NULL,
    name       VARCHAR(120)     NOT NULL,
    active     TINYINT(1)       NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME         NOT NULL,
    updated_at DATETIME         NULL,
    deleted_at DATETIME         NULL,
    PRIMARY KEY (id),
    -- O código só precisa ser único DENTRO do jogo: dois TCGs podem ter a mesma sigla.
    UNIQUE KEY uk_editions_game_code (game_id, code),
    KEY idx_editions_listing (game_id, active, deleted_at, sort_order),
    CONSTRAINT fk_editions_game FOREIGN KEY (game_id) REFERENCES games (id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 3.7 `rarities`

```sql
CREATE TABLE rarities (
    id         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    game_id    INT UNSIGNED     NOT NULL,
    code       VARCHAR(32)      NOT NULL,   -- 'mythic', 'secret-rare'...
    name       VARCHAR(80)      NOT NULL,   -- exibido ao usuário, em português
    active     TINYINT(1)       NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME         NOT NULL,
    updated_at DATETIME         NULL,
    deleted_at DATETIME         NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_rarities_game_code (game_id, code),
    KEY idx_rarities_listing (game_id, active, deleted_at, sort_order),
    CONSTRAINT fk_rarities_game FOREIGN KEY (game_id) REFERENCES games (id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> **Esta tabela é a Decisão de UX nº 1 materializada.** Sem ela, raridade seria texto livre
> e uma carta de Magic poderia ser cadastrada como *Secret Rare*. Note que `sort_order`
> existe porque raridade tem ordem natural (comum → mítica) que não é alfabética.

---

### 3.8 `cards`

```sql
CREATE TABLE cards (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    game_id     INT UNSIGNED NOT NULL,
    edition_id  INT UNSIGNED NOT NULL,
    rarity_id   INT UNSIGNED NOT NULL,
    name_en     VARCHAR(150) NOT NULL,
    name_pt     VARCHAR(150) NULL,          -- "pode existir ou não" (enunciado)

    -- A Strategy de imagem grava o par (tipo, referência). 'upload' guarda o nome do
    -- arquivo gerado pelo servidor; 'remote' guarda a URL http(s) validada.
    image_type      ENUM('upload','remote') NULL,
    image_reference VARCHAR(2048)           NULL,

    created_by  INT UNSIGNED NOT NULL,
    updated_by  INT UNSIGNED NULL,
    created_at  DATETIME     NOT NULL,
    updated_at  DATETIME     NULL,
    deleted_at  DATETIME     NULL,

    PRIMARY KEY (id),
    KEY idx_cards_game     (game_id,    deleted_at),
    KEY idx_cards_edition  (edition_id, deleted_at),
    KEY idx_cards_rarity   (rarity_id,  deleted_at),
    KEY idx_cards_listing  (deleted_at, id),
    KEY idx_cards_name_en  (name_en),

    CONSTRAINT fk_cards_game       FOREIGN KEY (game_id)    REFERENCES games (id)     ON DELETE RESTRICT,
    CONSTRAINT fk_cards_edition    FOREIGN KEY (edition_id) REFERENCES editions (id)  ON DELETE RESTRICT,
    CONSTRAINT fk_cards_rarity     FOREIGN KEY (rarity_id)  REFERENCES rarities (id)  ON DELETE RESTRICT,
    CONSTRAINT fk_cards_created_by FOREIGN KEY (created_by) REFERENCES users (id)     ON DELETE RESTRICT,
    CONSTRAINT fk_cards_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Três decisões nesta tabela que merecem leitura:**

1. **`game_id` é redundante** — daria para derivá-lo por `JOIN` em `editions`. Mantido
   deliberadamente: o filtro por jogo é a consulta mais frequente da listagem, e derivar
   custaria um `JOIN` em toda leitura. A integridade entre `game_id` e o jogo da edição é
   garantida na cadeia de validação (RN-01), não no banco.

2. **Não existe `UNIQUE (edition_id, name_en)`** — e isso é modelagem correta, não
   esquecimento. Em card games reais a mesma carta tem múltiplas impressões na mesma edição
   (terrenos básicos em Magic). O sistema **avisa** sobre nome repetido e pede confirmação
   (RN-04); não bloqueia.

3. **Busca por nome usa `LIKE '%termo%'`**, que não aproveita `idx_cards_name_en`. É a
   escolha certa para o volume atual (dezenas a milhares de cartas): a varredura é
   irrelevante e o resultado é o que o usuário espera. **Gatilho para trocar:** ao passar de
   ~100 mil cartas, migrar para índice `FULLTEXT` com `MATCH ... AGAINST` em modo booleano.

---

### 3.9 `card_audit`

```sql
CREATE TABLE card_audit (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    card_id    INT UNSIGNED    NOT NULL,
    user_id    INT UNSIGNED    NOT NULL,
    action     ENUM('created','updated','deleted','restored') NOT NULL,
    -- Só os campos que mudaram, no formato {campo: {de: ..., para: ...}}.
    -- Nunca guarda a linha inteira: o diff é o que se lê seis meses depois.
    changes    JSON            NULL,
    trace_id   CHAR(32)        NULL,   -- correlaciona com o log da requisição
    created_at DATETIME        NOT NULL,
    PRIMARY KEY (id),
    KEY idx_audit_card (card_id, created_at),
    KEY idx_audit_user (user_id, created_at),
    CONSTRAINT fk_audit_card FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Alimentada exclusivamente pelo handler de `CardCreated`, `CardUpdated`, `CardDeleted` e
`CardRestored` (ADR-005). O handler **nunca lança** — falha de auditoria vira log, jamais
erro para o usuário que acabou de salvar (`PADROES.md` §2.4).

---

## 4. Massa de dados inicial (seed)

`bin/seed.php` é **idempotente** (`INSERT ... ON DUPLICATE KEY UPDATE` sobre as chaves
naturais) e roda a cada boot.

### 4.1 Usuários

Em `APP_ENV=local`, os três perfis de demonstração, com as credenciais publicadas no README.
Em qualquer outro ambiente, um único administrador com **senha aleatória** e troca forçada
no primeiro acesso — a regra existe porque um seed que reescreve senha de admin a cada deploy
é uma porta dos fundos que se auto-restaura (`PADROES.md` §16.3).

| Nome | E-mail | Nível |
|---|---|---|
| Administrador | `admin@oraculo.local` | `ADMIN` (3) |
| Editor de Catálogo | `editor@oraculo.local` | `EDITOR` (2) |
| Consulta | `consulta@oraculo.local` | `VIEWER` (1) |

### 4.2 Jogos

| slug | name | sort_order |
|---|---|---|
| `magic` | Magic: The Gathering | 1 |
| `pokemon` | Pokémon | 2 |
| `yugioh` | Yu-Gi-Oh! | 3 |

### 4.3 Edições — **reproduzidas literalmente do enunciado**

> ⚠️ Quatro destas edições não existem no mundo real (`The Hobbit`, `Marvel Super Heroes`,
> `Chaos Rising`, `Blazing Dominion`). **Não corrigir.** A massa é o contrato do desafio, e
> "corrigir" seria entregar algo diferente do que foi pedido.

| Jogo | code | name |
|---|---|---|
| magic | `dom` | Dominaria |
| magic | `war` | War of the Spark |
| magic | `eld` | Throne of Eldraine |
| magic | `hob` | The Hobbit |
| magic | `msh` | Marvel Super Heroes |
| pokemon | `base1` | Base Set |
| pokemon | `swsh1` | Sword & Shield |
| pokemon | `sv1` | Scarlet & Violet |
| pokemon | `30c` | 30th Celebration |
| pokemon | `cri` | Chaos Rising |
| yugioh | `lob` | Legend of Blue Eyes White Dragon |
| yugioh | `mrd` | Metal Raiders |
| yugioh | `sdy` | Starter Deck: Yugi |
| yugioh | `rotd` | Rise of the Duelist |
| yugioh | `blzd` | Blazing Dominion |

### 4.4 Raridades

Código em inglês (identificador), nome em português (exibido ao usuário), na ordem natural
do jogo — não alfabética.

| Jogo | code | name | ordem |
|---|---|---|---|
| magic | `common` | Comum | 1 |
| magic | `uncommon` | Incomum | 2 |
| magic | `rare` | Rara | 3 |
| magic | `mythic` | Mítica | 4 |
| pokemon | `common` | Comum | 1 |
| pokemon | `uncommon` | Incomum | 2 |
| pokemon | `rare` | Rara | 3 |
| pokemon | `rare-holo` | Rara Holo | 4 |
| pokemon | `ultra-rare` | Ultra Rara | 5 |
| pokemon | `secret-rare` | Secreta | 6 |
| yugioh | `common` | Comum | 1 |
| yugioh | `rare` | Rara | 2 |
| yugioh | `super-rare` | Super Rara | 3 |
| yugioh | `ultra-rare` | Ultra Rara | 4 |
| yugioh | `secret-rare` | Secreta | 5 |

### 4.5 Cartas

Entre 24 e 30 cartas distribuídas pelos três jogos e por várias edições e raridades, o
suficiente para exercitar paginação, busca e todos os filtros já na primeira abertura.

Regras da massa:
- Imagens por **URL** (`image_type = 'remote'`), nunca por arquivo — o seed não pode
  depender de permissão de volume no ambiente do avaliador.
- Pelo menos uma carta **sem `name_pt`**, para exercitar o campo opcional.
- Pelo menos uma carta **sem imagem**, para exercitar o espaço reservado (RF-34).
- Pelo menos duas cartas de **mesmo nome na mesma edição**, para demonstrar o aviso de
  duplicidade (RN-04).

---

## 5. Índice das migrations

| Arquivo | Conteúdo |
|---|---|
| `0001_create_schema_migrations.sql` | Controle de versão do schema |
| `0002_create_users.sql` | `users` |
| `0003_create_sessions.sql` | `sessions` |
| `0004_create_login_attempts.sql` | `login_attempts` |
| `0005_create_games.sql` | `games` |
| `0006_create_editions.sql` | `editions` |
| `0007_create_rarities.sql` | `rarities` |
| `0008_create_cards.sql` | `cards` |
| `0009_create_card_audit.sql` | `card_audit` |

**Migration aplicada nunca é editada.** Correção é sempre uma migration nova.
