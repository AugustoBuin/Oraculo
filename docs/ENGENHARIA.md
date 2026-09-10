# Guia de Engenharia — Oráculo

> **O que é este arquivo.** O contexto que não se descobre lendo o código: como rodar,
> quais são as fronteiras, onde ficam as coisas, e quais armadilhas deste repositório
> parecem opcionais e não são. Serve igualmente para uma pessoa nova no projeto e para
> um agente automatizado.
>
> **Ele é normativo, não descritivo.** Quando o código divergir daqui, um dos dois está
> errado — e a divergência precisa ser resolvida, não ignorada.
>
> **A régua completa** está em `backend/PADROES.md` (backend) e
> `frontend/PADROES-ENGENHARIA.md` (frontend). Este arquivo é o resumo operacional e
> registra apenas onde **este projeto** diverge deles, sempre com o ADR correspondente.

---

## 1. O projeto em um parágrafo

Portal administrativo para gestão de cartas de card games, construído como o núcleo de
catálogo de uma plataforma **multi-TCG**. Backend em **PHP sem framework e sem nenhuma
dependência de terceiros**, banco **MySQL**, frontend em **HTML5 + CSS3 + JavaScript
vanilla** com módulos ES nativos. Autenticação por sessão de servidor, autorização por
níveis hierárquicos. Sobe inteiro com `docker compose up`.

Contexto de origem: desafio técnico da LigaMagic. As restrições de "sem framework" e
"sem biblioteca" não são estilo — são requisito de avaliação e valem para **todo** o
código entregue.

---

## 2. Comandos

| Comando | O que faz |
|---|---|
| `docker compose up` | Sobe MySQL + PHP/Apache, aplica migrations e seed. É o único passo necessário. |
| `docker compose exec app php backend/bin/migrate.php` | Aplica as migrations pendentes. Idempotente; roda sozinho no boot. |
| `docker compose exec app php backend/bin/seed.php` | Popula massa inicial. Idempotente. |
| `docker compose exec app php backend/bin/test.php` | Micro-runner de testes autoral (ADR-004). |
| `docker compose exec app php backend/bin/check-boundaries.php` | Verifica as fronteiras de camada do PHP **e** do JS (ADR-002). |
| `docker compose exec app php backend/bin/validate.php` | Cadeia completa: conflitos → `php -l` → fronteiras → testes. É o que roda no hook de pré-push. |

> O diretório de trabalho do contêiner é `/var/www`, com `backend/` e `frontend/` lado a
> lado — por isso o caminho começa em `backend/`. Rodar `php bin/validate.php` de dentro do
> contêiner responde `Could not open input file`.

Variáveis obrigatórias (`.env`, **fora** do document root): `DB_HOST`, `DB_NAME`,
`DB_USER`, `DB_PASS`, `APP_ENV`, `APP_URL`, `SESSION_TTL_SECONDS`, `UPLOAD_MAX_BYTES`.
**Não existe valor default.** Se faltar uma, a aplicação falha no boot com o nome da
variável ausente (`PADROES.md` §9.1).

---

## 3. Arquitetura e fronteiras

Quatro camadas, dependência sempre para dentro (`PADROES.md` §2.1):

```
Infra ──▶ UseCases ──▶ Domain ◀── Shared
  │                                 ▲
  └─────────────────────────────────┘
```

| Camada | Contém | Nunca pode importar |
|---|---|---|
| `src/Domain/` | Entidades, interfaces de gateway, erros de domínio, eventos, serviços puros | PDO, HTTP, sessão, superglobais |
| `src/UseCases/` | Um caso de uso por arquivo, com `Input`/`Output` DTO explícitos | Qualquer coisa de `Infra` |
| `src/Infra/` | Router, rotas, middlewares, repositórios PDO, sessão, storage, handlers de evento | — (é a borda) |
| `src/Shared/` | Enums, dispatcher de eventos, logger, config | Regra de negócio |
| `src/Modules/` | Composition root por feature: instancia tudo e devolve as rotas **já protegidas** | — |

No frontend, a mesma ideia em três camadas (`PADROES-ENGENHARIA.md` §2.1):
`shared/` (não conhece ninguém) ← `features/` (isoladas entre si) ← `pages/` (compõem).

**As duas proibições que fazem a arquitetura existir:**
- `Domain` sem uma linha de PDO, HTTP ou `$_SESSION`.
- Uma `feature` do frontend **nunca** importa de outra. Se as duas precisam da mesma
  coisa, ela sobe para `shared/`.

`bin/check-boundaries.php` verifica as duas e falha o `validate`. Fronteira sem
verificador é sugestão.

---

## 4. As dez regras que mais aparecem em revisão

1. **Toda rota é registrada dentro de um `guard(...)`** com o nível mínimo de permissão
   (`PADROES.md` §5.1). Rota pública é exceção deliberada e precisa de comentário
   justificando. Só `POST /api/auth/login` é pública neste projeto.
2. **O status HTTP vem da classe de erro lançada**, nunca de um `http_response_code()`
   no meio da rota (§4.2). O único tradutor erro→status é `Infra/Http/ErrorHandler`.
3. **O corpo da requisição é desestruturado campo a campo.** Nunca repasse
   `$_POST` ou `$request->body()` inteiro (§5.3). A identidade vem **sempre** da sessão,
   nunca do corpo.
4. **Todo SQL é parametrizado.** Sem concatenação, nem para número. Nome dinâmico de
   coluna (ordenação, filtro) só por **allowlist** (§7.2).
5. **Nenhum `SELECT *` e nenhuma leitura sem `LIMIT`.** Toda listagem é paginada (§7.3).
6. **Dado externo nunca vira HTML.** No frontend, `textContent` e `document.createElement`;
   `innerHTML` só com literal do próprio código (`PADROES-ENGENHARIA.md` §8.3).
7. **Toda função de montagem do frontend devolve uma função de limpeza**, e quem monta
   guarda. Listener, timer e requisição pendente sem cancelamento são vazamento (§12.4).
8. **Nenhum valor visual fora de `tokens.css`.** Todo token de cor existe nos dois temas
   ou não existe (§10).
9. **Handler de evento nunca lança.** Corpo inteiro em try/catch, só log (`PADROES.md` §2.4).
10. **Um caso de uso nunca chama outro caso de uso.** Reação transversal vira evento.

---

## 5. Armadilhas deste repositório

> Coisas que parecem opcionais e não são.

- **Não existe Composer aqui.** O autoload PSR-4 é próprio, em `src/autoload.php`. Um
  `composer require` quebra o requisito central de entrega (ADR-001). Se precisar de
  algo, escreva.
- **O document root é `backend/public/`.** Nada fora dele pode ser alcançável pela web.
  `src/`, `.env`, `migrations/` e `storage/` viram URL pública se isso for afrouxado.
- **Imagens enviadas ficam fora do document root** (`backend/storage/uploads/`) e são
  servidas por rota. Nome gerado pelo servidor, tipo validado pelo **conteúdo**, nunca
  pela extensão.
- **Frontend e API compartilham a mesma origem.** É isso que elimina CORS e preflight
  (ADR-003). Não separe em dois contêineres "para organizar" sem ler o ADR.
- **`401` é sessão ausente/expirada; `403` é sessão válida sem nível suficiente.** Isto
  corrige a tabela do `PADROES.md` §4.2 — ver ADR-007.
- **Nunca edite uma migration já aplicada.** Corrija com uma nova (§7.5).
- **O seed não cria senha administrativa fixa fora do ambiente local.** Em `APP_ENV=local`
  ele cria os três usuários de demonstração documentados no README. Em qualquer outro
  ambiente, cria um único administrador — **e só se ainda não houver nenhum usuário** — com
  senha vinda de `random_bytes`, exibida uma única vez na saída do boot e nunca gravada.
  Forçar a troca no primeiro acesso exigiria coluna nova e um fluxo de redefinição, que
  está fora de escopo (PRD §3.2).
- **O seed nunca reescreve a senha de um usuário que já existe.** O `ON DUPLICATE KEY
  UPDATE` toca apenas o nome. Um seed que redefine senha e permissão de administrador a
  cada deploy é uma porta dos fundos que se auto-restaura (`PADROES.md` §16.3). Há
  verificação disso no roteiro de integração.
- **Carta não tem chave natural**, então o seed de cartas roda uma vez só: se a tabela já
  tem linha, ele não mexe. Isso preserva o que for cadastrado entre reinícios do contêiner.
- **Nenhuma `@media (min-width…)` em `components.css`.** Componente decide pela largura
  **dele**: pelas primitivas de `utilities.css` (`.cluster`, `.sidebar`, `.switcher`) ou por
  `@container`. Media query de viewport foi a causa do OF-004 — a regra respondia à janela, e
  o componente vivia numa coluna. O porquê e o checklist estão em `docs/design.md` §9.
- **`overflow-wrap: anywhere` não é global, e voltar a pô-lo no `body` reabre o OF-004.** Ele
  zera a contribuição de min-content de todo texto que o herda, e o mínimo de qualquer coluna
  vira um caractere. Vale só no texto que veio de fora; a lista está no topo de
  `components.css`, e o resto usa `.wrap-anywhere`.
- **Layout se prova medindo, não lendo.** `frontend/tests/suites/layout-geometry.test.js`
  monta as telas em larguras que cruzam os pontos de quebra e mede três invariantes. Tela
  nova entra lá, afirmando que o estado medido é o com dado — não o de carregamento.
- **O JSON de edições do desafio é reproduzido literalmente**, inclusive as edições que
  não existem no mundo real (`The Hobbit`, `Marvel Super Heroes`, `Chaos Rising`,
  `Blazing Dominion`). Não "corrija" a massa de dados — ela é o contrato.

---

## 6. Convenções

| Informação | Idioma |
|---|---|
| Identificadores, classes, arquivos, colunas de banco | Inglês |
| Texto exibido ao usuário e mensagens de erro do cliente | Português |
| Comentários técnicos e nomes de teste | Português |

Escrita: `camelCase` (variáveis, funções), `PascalCase` (classes, entidades, casos de uso),
`UPPER_SNAKE_CASE` (constantes), `PascalCase.php` (arquivos PHP), `kebab-case` (arquivos
JS/CSS, classes CSS), `data-kebab-case` (atributos de dado), `dominio:acao` (eventos
customizados). `declare(strict_types=1);` no topo de **todo** arquivo PHP.

Comentário explica **por quê**, nunca **o quê**.

---

## 7. Git

- Branches: `main` (entregável, sempre verde) ← `development` (integração) ← `feature-*`.
  **Hífen, nunca barra** — a regra existe por incidente real (`PADROES.md` §13.2).
- Criação: `git switch -c feature-nome --no-track origin/development`.
- Merge em `development` com `--no-ff` para o histórico mostrar o processo.
- Conventional Commits em português, no imperativo: `feat(card): adiciona cascata de raridade`.
- Um commit = uma ideia. Se o título precisa de "e", são dois commits.
- O `pre-push` roda `backend/bin/validate.php` no contêiner e barra o envio se a cadeia
  ficar vermelha. Com o ambiente no chão ele falha com instrução — não há PHP no host.

---

## 8. Onde procurar as decisões

- `docs/PRD.md` — o que o sistema faz, para quem, com que regras.
- `docs/api-contract.md` — todos os endpoints, envelopes e códigos de erro.
- `docs/database-schema.md` — tabelas, índices e massa inicial.
- `docs/backlog-backend.md` — as tarefas com critério de aceite.
- `docs/decisions/` — **por que não foi feito do jeito óbvio.** Leia antes de propor
  mudança estrutural.
- `docs/audits/open-findings.md` — achados abertos. Leia antes de começar qualquer
  trabalho; se a sua mudança toca um local listado, corrija ou, no mínimo, não piore.
- `docs/audits/` — os relatórios completos de qualidade e segurança, datados e
  **versionados** junto do ledger. Relatório salvo é imutável; o que muda de status é o
  ledger.
