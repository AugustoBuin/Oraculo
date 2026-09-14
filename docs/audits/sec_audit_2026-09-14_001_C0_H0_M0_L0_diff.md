# Oráculo — Relatório de Auditoria de Segurança (SAST)

**Data:** 14/09/2026 | **Branch:** `feature-documentacao` | **Commit:** `177d08d` | **Escopo:** `diff` contra `88f76ce`
**Auditor:** security-auditor
**Método:** análise estática + revisão arquitetural. Nenhum código executado ou alterado.

> **Nome, ledger e métrica.** Por instrução de quem invocou, esta execução **não** escreveu em
> `docs/audits/open-findings.md` nem em `docs/audits/audit-metrics.jsonl`. As linhas propostas
> estão na seção **"Para consolidar"**, no fim. O nome segue o padrão estrito do contrato, com o
> sufixo `_diff`. Uma tentativa anterior desta mesma auditoria foi interrompida e não deixou
> relatório; este é o primeiro.

> **Limites desta execução.** Nenhuma requisição foi feita contra o contêiner. Quem invocou
> liberou `curl -I` em `localhost:8080`, mas o contrato deste auditor proíbe requisição contra
> endpoint vivo, e a regra do contrato prevaleceu. O que depende de resposta HTTP está em
> "Requer verificação dinâmica". Dois scripts de leitura rodaram **fora do repositório**, no
> diretório temporário da sessão: um lê bytes de arquivo (estrutura dos binários de imagem e
> `sha256` do mapa de importação), e o outro varre texto (os quatro artefatos do item a mais).
> Nenhum dos dois toca a aplicação, o banco ou a rede.

> **Árvore de trabalho.** Há alterações do autor, ainda não commitadas, em `docs/` (entre elas
> `docs/api-contract.md` e `docs/ENGENHARIA.md`). Elas foram **lidas** como referência (o §9 do
> contrato foi conferido na versão da árvore de trabalho), mas não fazem parte do conjunto
> auditado, e nada nelas foi tocado.

---

## Conjunto auditado

`git diff --name-only 88f76ce...HEAD`: **72 commits**. Fora de `docs/`, **128 arquivos**:

| Grupo | Arquivos | O que entrou |
|---|---|---|
| `backend/` | 46 (32 de produção, 14 de teste) | Correção do OF-001 (`Request.php`); gestão de edições e raridades pelo ADMIN, com `RarityColor`, quatro rotas de escrita, casos de uso e `Input` próprios, presenters e repositórios; migrations `0011` e `0012`; correção do OF-006 no `seed.php` |
| `frontend/` | 80 (55 em `src/`, 4 em `public/`, 21 em `tests/`) | Correção do OF-002; refatoração de layout; tela `/paleta`; identidade visual: 13 SVG (12 em `src/assets/`, 1 em `public/`), 6 WebP, 1 PNG, 1 ICO e três `<link>` no `index.html` |
| Raiz | 2 | `.gitignore` (só comentários) e `README.md` |

**Raio de alcance incluído:** os três composition roots (`AuthModule.php`, `CardModule.php`,
`CatalogModule.php`), para o mapa completo de rotas; `Infra/Http/Middleware/Csrf.php` e
`public/index.php:104`, para a cobertura de CSRF das rotas novas; `Infra/Http/Router.php`, para o
padrão de `{id}`; `shared/dom/elements.js`, `shared/components/notifications.js` e
`features/catalogs/components/catalog-panel.js`, para o caminho do nome editável até o DOM;
`docker/app/apache.conf`, `docker/app/php.ini` e `docker-compose.yml`, para o estado dos achados
de plataforma de 09/09; `Shared/Observability/StderrLogger.php`, para o item a mais.

**Nada de plataforma mudou.** `git diff --name-only 88f76ce...HEAD -- docker docker-compose.yml
.env.example backend/public .gitattributes` volta vazio, e
`git diff --stat 88f76ce...HEAD -- backend/src/Infra/Http/Middleware backend/src/Infra/Http/Guard.php
backend/public/index.php backend/src/UseCases/Auth docker/app` também. **As dimensões A e B
continuam em `diff`**: o conjunto não toca nenhum dos gatilhos de retorno a `full`. A exceção de
alcance é `Request::fromGlobals()`, que roda antes do pipeline em **toda** requisição. A correção
do OF-001 foi avaliada pelo efeito sobre o sistema inteiro, e não só pelo arquivo.

**CSP e cabeçalhos: intocados.** `SecurityHeaders.php` está fora do diff. O `index.html` mudou,
mas só fora do bloco do mapa de importação. O `sha256` recalculado do bloco
`<script type="importmap">` (64 bytes, sem CR) é `uBe61TLOgUZyopiIimcIToVknvqJ+W5vLpBrThdXkaA=`,
idêntico ao declarado em `docker/app/apache.conf:43`. A política continua casando com o documento.

---

## Sumário executivo

**Nenhum achado novo em nenhuma severidade. O diff não bloqueia a entrega.**

As duas grandes entradas deste intervalo abriram superfície real, e as duas nasceram fechadas.

1. **A gestão de catálogo pelo ADMIN** trouxe quatro rotas de escrita. As quatro estão dentro de
   `Guard::protect(..., PermissionLevel::ADMIN)` (`CatalogModule.php:76-98`) e sob a mesma CSRF de
   toda escrita (`index.php:104`, `Csrf.php:42-57`). O corpo é lido campo a campo, e o `code` nem
   é lido no `PUT`. O campo novo, a cor, passa por **duas allowlists independentes**:
   - o enum `RarityColor` no servidor, na escrita (`CreateRarityUseCase.php:47-52`,
     `UpdateRarityUseCase.php:42-47`) e também na leitura (`RarityColor::fromStored`,
     `RarityColor.php:45-48`), de modo que nem um valor gravado direto no banco chega ao JSON;
   - `rarityColor()` no cliente (`rarity-colors.js:37-39`), antes de virar classe CSS
     (`rarity-badge.js:22`).

   O nome da raridade, que é texto livre do ADMIN, chega ao DOM só por `textContent`.
2. **A identidade visual** trouxe imagens servidas pela mesma origem:
   - os 13 SVG não têm uma única ocorrência de `<script`, atributo `on*`, `href`,
     `foreignObject`, `<!ENTITY`, `data:` ou `url(http`;
   - os seis WebP, o PNG e as duas imagens internas do ICO não carregam nenhum bloco de metadado.
     Só existem os blocos de imagem e alfa: nada de EXIF, XMP, ICC, texto PNG ou C2PA.

**O que um atacante externo, sem sessão, consegue hoje.** Tentar autenticar-se, sob o limite de
tentativas cuja chave inclui o IP (M-2 de 09/09, persistente), e alcançar o portal pela rede
local por causa do `docker-compose` de entrega (M-3 de 09/09, persistente). **Deixou de conseguir**
o que era o vetor não autenticado mais barato de 09/09: derrubar qualquer `/api/*` com `?x[]=1` e
gravar uma pilha por requisição. `Request::onlyStrings()` (`Request.php:260-271`) descarta o que
não é escalar, e a decisão volta a ser do guard (OF-001, `verified`). Nenhuma rota de dado é
alcançável sem sessão, e a tela nova `/paleta` não consulta a API.

**O que um usuário `VIEWER` consegue.** O mesmo de 09/09, e nada do que este diff acrescentou.
As quatro rotas novas exigem `ADMIN`. A cor aparece para o `VIEWER` na carta
(`CardPresenter.php:40-46`), como chave da paleta e sem id interno. A listagem pública de catálogo
continua `{id, name}`: `sortOrder`, `ref` e `color` só saem com `withState`, que só o caso de uso
concede ao `ADMIN` (`CatalogPresenter.php:54-61`, `:96-100`). A `/paleta` exige `VIEWER` no
cliente (`app-shell.js:93-99`), o que é só apresentação, e mostra tokens de CSS, sem dado de
carta ou de conta.

**Item a mais (os quatro artefatos que vão ser versionados).** Os quatro foram varridos:
`.claude/` (62 arquivos), `CLAUDE.md`, `backend/PADROES.md` e `frontend/PADROES-ENGENHARIA.md`.
**Nenhum segredo, credencial, token, chave, string de conexão, IP, hostname interno, e-mail,
caminho absoluto de máquina ou nome de usuário do sistema operacional foi encontrado.** Nenhum
dos quatro aparece em nenhuma ref do histórico (`git log --all` vazio). Ficam três observações
sem pontuação, a mais relevante sobre `settings.local.json`, e uma verificação que só o autor
pode fazer: a lista de termos proibidos do ADR-011 fica fora do repositório por decisão.

| Severidade | Qtd. | Faixa CVSS |
|---|---|---|
| Critical | 0 | 9,0–10,0 |
| High     | 0 | 7,0–8,9  |
| Medium   | 0 | 4,0–6,9  |
| Low      | 0 | 0,1–3,9  |

---

## Mapa da superfície de ataque

O escopo `diff` permitiria mapear só as rotas alteradas. O mapa abaixo cobre **as 22**, porque o
custo era pequeno e porque a separação das escritas de catálogo mudou as classes registradas. As
nove rotas de catálogo foram relidas no código desta execução. As treze de autenticação e de carta
foram conferidas pela linha de registro nos módulos, e os arquivos delas estão fora do diff.

| Método | Caminho | Protegida | Nível mínimo | Observação |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | **não** | — (pública) | `AuthModule.php:62-64`. Única pública, justificada no comentário: é a rota que cria a sessão. Única isenta de CSRF (`index.php:104`). Fora do diff. |
| `GET` | `/api/auth/session` | sim | `VIEWER` | `AuthModule.php:66`. Fora do diff. |
| `DELETE` | `/api/auth/session` | sim | `VIEWER` | `AuthModule.php:67`. Fora do diff. |
| `PUT` | `/api/auth/password` | sim | `VIEWER` | `AuthModule.php:71`. `userId` da sessão. Fora do diff. |
| `GET` | `/api/cards` | sim | `VIEWER` | `CardModule.php:99`. Fora do diff; a carta passou a levar `rarity.color`, chave do enum (`CardPresenter.php:40-46`). |
| `GET` | `/api/cards/{id}` | sim | `VIEWER` | `CardModule.php:100`. Idem. |
| `GET` | `/api/media/{reference}` | sim | `VIEWER` | `CardModule.php:101`. Fora do diff. |
| `POST` | `/api/cards` | sim | `EDITOR` | `CardModule.php:104`. Fora do diff. |
| `PUT` | `/api/cards/{id}` | sim | `EDITOR` | `CardModule.php:105`. Fora do diff. |
| `DELETE` | `/api/cards/{id}` | sim | `EDITOR` | `CardModule.php:106`. Fora do diff. |
| `POST` | `/api/cards/{id}/restore` | sim | `EDITOR` | `CardModule.php:107`. Fora do diff. |
| `GET` | `/api/cards/{id}/history` | sim | `EDITOR` | `CardModule.php:108`. Fora do diff. |
| `POST` | `/api/uploads/card-image` | sim | `EDITOR` | `CardModule.php:109`. Fora do diff. |
| `GET` | `/api/games` | sim | `VIEWER` | `CatalogModule.php:62-65`. |
| `GET` | `/api/games/{gameId}/editions` | sim | `VIEWER` | `CatalogModule.php:66-69`. `incluirInativos` continua decidido pelo caso de uso, pelo nível da sessão. |
| `GET` | `/api/games/{gameId}/rarities` | sim | `VIEWER` | `CatalogModule.php:70-73`. Idem. A forma com estado ganhou `sortOrder` e `color`, só para `ADMIN`. |
| `POST` | `/api/games/{gameId}/editions` | sim | `ADMIN` | `CatalogModule.php:76-79`. **Rota renomeada no diff** (`CreateCatalogItemRoute` → `CreateEditionRoute`). Lê `code`, `name`, `sortOrder` (`CreateEditionRoute.php:40-45`). |
| `PUT` | `/api/editions/{id}` | sim | `ADMIN` | `CatalogModule.php:80-83`. **Renomeada no diff** (`UpdateCatalogItemRoute` → `UpdateEditionRoute`). Lê `name`, `sortOrder`, `active`; `code` fora (`UpdateEditionRoute.php:43-50`). |
| `DELETE` | `/api/editions/{id}` | sim | `ADMIN` | `CatalogModule.php:84-90`. Desativação. |
| `POST` | `/api/games/{gameId}/rarities` | sim | `ADMIN` | `CatalogModule.php:91-94`. **Nova classe no diff.** Lê `code`, `name`, `sortOrder`, `color` (`CreateRarityRoute.php:40-46`). |
| `PUT` | `/api/rarities/{id}` | sim | `ADMIN` | `CatalogModule.php:95-98`. **Nova classe no diff.** Lê `name`, `sortOrder`, `active`, `color`; `code` fora (`UpdateRarityRoute.php:43-51`). |
| `DELETE` | `/api/rarities/{id}` | sim | `ADMIN` | `CatalogModule.php:99-105`. Desativação. |

**22 rotas: 21 protegidas e 1 pública, justificada.** `grep -c "Guard::protect"` dá 3 + 9 + 9 = 21.
**Divergência com `docs/api-contract.md` §9: nenhuma.** Método, caminho e nível batem nas 22 linhas.

**Adequação de nível (ADR-006).** Nenhuma escrita alcançável em `VIEWER`. Nenhuma escrita de
catálogo alcançável em `EDITOR`: as seis estão em `ADMIN`. Nenhuma exclusão ou desativação abaixo
de `EDITOR`. A separação das escritas de catálogo em quatro classes **não** afrouxou nenhum nível.

---

## Achados

### Critical

Nenhum.

### High

Nenhum.

### Medium

Nenhum.

### Low

Nenhum.

### Candidatos avaliados e não pontuados

Registrados para que a ausência de achado seja lida como decisão, e não como omissão.

- **Nome de catálogo maior que a coluna, ordem fora de `SMALLINT UNSIGNED` e criação concorrente
  com o mesmo código respondem `500`.** São os achados M-1, M-2 e B-2 da auditoria de qualidade de
  backend de 14/09 (`2026-09-14_feature-identidade-visual_backend_0c-1h-2m-2l_diff.md`), e seguem
  válidos no código atual (`CatalogItemRules.php:42-45`; `UpdateRarityRoute.php:46`,
  `UpdateEditionRoute.php:46`; `CreateRarityUseCase.php:58-62`). **Pela régua de segurança não
  pontuam:**
  - só o `ADMIN` alcança (`PR:H`);
  - a resposta é a frase genérica do `ErrorHandler`, sem `SQLSTATE` nem nome de coluna;
  - a pilha registrada carrega, no máximo, o prefixo de 15 caracteres do nome que o próprio
    `ADMIN` digitou (ver L-2 de 09/09, persistente), sem credencial.

  Confidencialidade, integridade e disponibilidade de terceiros ficam intactas. Não duplico.
- **Mais conteúdo servido por `/src` sem `X-Content-Type-Options` nem CSP.** O diff acrescenta 12
  SVG e 6 WebP em `frontend/src/assets/`, servidos pelo `<Directory /var/www/frontend/src>`
  (`apache.conf:78-93`), que não declara a linha de base de cabeçalhos. SVG aberto por navegação
  direta é documento, e ali sairia sem política. **Não pontua como achado novo:**
  - a configuração é a mesma do L-1 de 09/09;
  - todo o conteúdo é estático e do projeto, com zero conteúdo ativo verificado;
  - nenhum caminho de escrita alcança `frontend/src/`. O upload grava em `backend/storage/uploads/`
    e recusa SVG pelo conteúdo, conforme o ADR-008.

  Entra na tabela de persistentes como **superfície ampliada do L-1**.

---

## Item a mais — os quatro artefatos que vão ser versionados

**Pergunta:** `.claude/`, `CLAUDE.md`, `backend/PADROES.md` e `frontend/PADROES-ENGENHARIA.md`
carregam segredo, credencial, token, chave, hostname ou URL interna, ou dado pessoal?

**Resposta: não. Nenhum achado na dimensão de exposição de dado.** Nenhum valor é reproduzido
abaixo. Cito arquivo, linha e tipo.

### Como foi verificado

1. **Inventário.** 62 arquivos em `.claude/`: 3 agentes, 2 hooks, `README.md`,
   `settings.local.json` e 55 arquivos de skill. A eles se somam os três arquivos da raiz e dos
   padrões. `git check-ignore` confirma que os quatro caminhos estão hoje no `.gitignore`
   (`.gitignore:3-4`, `:8-9`).
2. **Histórico.** `git log --all --oneline -- .claude CLAUDE.md backend/PADROES.md
   frontend/PADROES-ENGENHARIA.md` volta **vazio**. Nenhum dos quatro esteve em commit de nenhuma
   ref, então não há segredo antigo a rotacionar por essa via. `git log --all -- .env` também
   volta vazio.
3. **Varredura por padrão, linha a linha, nos quatro.** Resultado por categoria:

   | Categoria | Ocorrências | Classificação |
   |---|---|---|
   | Chave privada (`BEGIN … PRIVATE KEY`) | 0 | — |
   | Token de provedor (AWS, GitHub, Slack, OpenAI, Google, GitLab, npm) e JWT | 0 | — |
   | Atribuição de credencial (`password`/`senha`/`secret`/`token`/`api_key` `=`/`:` valor) | 0 | — |
   | String de conexão (`mysql://`, `redis://`, …) e `mysql -p<senha>` | 0 | — |
   | Cabeçalho `Bearer`/`Basic` com valor | 0 | — |
   | Endereço IPv4 | 0 | — |
   | E-mail | 0 | — |
   | Caminho absoluto de máquina (`C:\Users\…`, `/Users/…`, `/home/…`) | 0 | — |
   | Nome de usuário do sistema operacional | 0 | — |
   | CPF, CNPJ ou telefone | 0 | — |
   | Hostname interno (`.local`, `.internal`, `.corp`, `.lan`, `.intranet`) | 12 acertos, **todos falso-positivos** | Nomes de arquivo de configuração (`settings.local.json`, e um `config.*.json` citado pela skill de terceiro) em `.claude/README.md:51`, `:121`, `:123`; `.claude/hooks/block-commands.js:6`; `.claude/skills/impeccable/reference/doctor.md:49`, `hooks.md:11`, `:17`, `:33`, `:103`, `:106`, `:110`, `init.md:116`, `new-work.md:53` |
   | URL | 23 | **Nenhuma interna.** Três tipos: **(a)** `localhost` com porta, como instrução de uso local (`.claude/agents/frontend-quality-auditor.md:234`; `.claude/skills/systematic-debugging/SKILL.md:134`, `CREATION-LOG.md:30`, `test-academic.md:41`, `test-pressure-2.md:13`; `.claude/skills/impeccable/reference/critique.md:76`, `live-setup.md:58`, `:62`, `:80`, `:92`, `:102`); **(b)** repositório público de código aberto, ou especificação pública, citado como referência (`backend/PADROES.md:756`; `.claude/skills/impeccable/NOTICE.md:9`; `reference/live-setup.md:83`, `:98`; `reference/live.md:201`; `reference/document.md:3`); **(c)** texto de licença pública e página pública da skill (`.claude/skills/impeccable/LICENSE:3`, `:185`; `reference/routing.md:5`) |

4. **Domínios sem esquema** (`algo.com.br`, `algo.io`…) em `CLAUDE.md`, nos dois padrões e nas
   partes autorais de `.claude/`: uma única ocorrência, o domínio da referência pública de
   `backend/PADROES.md:756`.
5. **Identificação indireta (ADR-011, regras 1 e 2).** Leitura dos trechos de incidente dos
   padrões: `backend/PADROES.md:1045-1068` (§13.2, as duas regras de branch),
   `:1302-1350` (§16, deploy e infraestrutura) e `:1741-1748` (a procedência, que declara a
   retirada de nomes e detalhes). Os trechos estão reduzidos à lição: não trazem sistema, data,
   duração, volume nem caminho de ataque. Em `frontend/PADROES-ENGENHARIA.md`, a busca por
   incidente, produção, empresa ou equipe só acha vocabulário genérico de processo. Os agentes
   citam "incidente real" sem detalhe (`backend-quality-auditor.md:246`,
   `frontend-quality-auditor.md:221`).
6. **Leitura integral** de `CLAUDE.md`, `.claude/settings.local.json`,
   `.claude/hooks/block-commands.js`, `.claude/hooks/blocked-commands.txt` e do único script de
   shell (`.claude/skills/systematic-debugging/find-polluter.sh`). Nenhum dado sensível. O script
   só roda `docker compose exec -T app php backend/bin/test.php` e `compgen -G`.

### Observações sem pontuação CVSS

Nenhuma viola propriedade de segurança da aplicação, e por isso não entram na contagem.

**IA-1 · `settings.local.json` versionado entrega, a quem abrir o repositório no Claude Code,
permissão ampla e um hook que executa script.**
`.claude/settings.local.json:3-7` concede `allow` para `Bash`, `Write` e `Edit` sem restrição, e
`:34-46` registra um `PreToolUse` que roda `node` sobre `.claude/hooks/block-commands.js`. Por
convenção, esse arquivo é **local de máquina**: a própria documentação da skill de terceiro
vendorizada diz que ele fica fora do Git (`.claude/skills/impeccable/reference/hooks.md:17`).
Versionado, ele passa a valer para qualquer pessoa que clone o repositório e confie na pasta. Os
comandos de shell do agente dela ficam pré-aprovados, e o hook, que é *fail-open* por desenho
(`block-commands.js:15-16`, `:66`, `:71`), passa a ser a única trava.

*Por que não pontua:* nenhuma fronteira de privilégio é cruzada. Quem roda um agente neste
repositório já confia no código do autor: o mesmo clone roda `docker compose up`, que executa o
`entrypoint.sh` dele. O hook e a blocklist são benignos, e foram lidos por inteiro. É higiene de
publicação, não vulnerabilidade.

*Recomendação:* versionar a parte que serve a qualquer pessoa como `.claude/settings.json` (as
listas `deny` e `ask` de `:8-32` e o hook), e manter o `allow` amplo apenas num
`settings.local.json` fora do Git. A trava continua conferível por quem avalia, e a preferência
pessoal de permissão não é imposta a quem clona.

**IA-2 · Duas frases passam a mentir no momento do commit.**
`CLAUDE.md:3` afirma que o arquivo **não é versionado** (ADR-009), e os comentários de
`.gitignore:1-2` e `:6-7` descrevem o estado de antes. Já `.claude/README.md:4-5` diz que a pasta
**é** versionada. Não há risco de segurança. É consistência de documento normativo, a mesma classe
do O-3 de 09/09, e custa uma linha no commit que versionar os quatro.

**IA-3 · Um resíduo de incidente de terceiro já está versionado fora dos quatro artefatos.**
`backend/src/Shared/Observability/StderrLogger.php:14-18`, anterior à base, descreve o incidente
que motivou a redação central de log com **os tipos de dado expostos e a duração da exposição**. A
regra 2 do ADR-011 manda retirar justamente a duração. O trecho não nomeia empresa nem sistema, e
isolado não identifica ninguém. Registro porque a revisão de anonimização do ADR-011 está
descrita sobre os dois padrões e a camada `.claude/`, e este comentário mora no código. Vale
incluí-lo na mesma passada e reduzi-lo à lição.

### O que só o autor pode verificar

A regra 5 do ADR-011 mantém **fora do repositório** a lista de termos proibidos: nome da empresa,
de sistema, de produto e de pessoas. Sem essa lista, esta auditoria prova a ausência de
**categorias** de dado sensível, mas **não** prova a ausência de um nome próprio específico. Antes
do `git add`, rodar a lista sobre os quatro artefatos **e** sobre o que já é versionado:
comentários de código, `docs/` e as mensagens de commit da branch. A regra 4 do ADR-011 também
cobre metadado de commit, que está fora destes quatro arquivos.

Fora do escopo pedido e **não inspecionado**: `docs/visual-identity-refs/`, não rastreado na árvore
de trabalho. Se for versionado, as imagens merecem a mesma verificação de metadado feita aqui
sobre os WebP (EXIF, XMP e C2PA), que em arte gerada por ferramenta costumam vir preenchidos.

---

## Persistentes de 09/09, no estado do código atual

Não entram na contagem, porque não são novos. Nenhum arquivo que os sustenta mudou desde a base
(`git diff --stat 88f76ce...HEAD` vazio para `UseCases/Auth`, `docker-compose.yml`, `docker/app`,
`Middleware`, `Guard.php` e `public/index.php`).

| Achado de 09/09 | Estado | Evidência atual |
|---|---|---|
| **M-1** · array em `$_GET`/`$_COOKIE` → `500` antes do pipeline (OF-001) | **Corrigido e verificado.** Confirmado aqui pelo ângulo de segurança | `Request.php:89`, `:91` → `onlyStrings()` em `:260-271`, que descarta o não escalar. Chave de cookie de sessão em forma de array vira cookie ausente → `401` pelo guard. Poluição de parâmetro (`?page=1&page[]=2`) degrada para ausente, sem erro. **Resíduos que continuam:** o `catch` externo de `index.php` ainda responde sem `SecurityHeaders` qualquer falha anterior ao pipeline (sem gatilho conhecido hoje), e `docker-compose.yml` segue sem `logging.options.max-size` |
| **M-2** · limite de login evadível por rotação de IP; senha mínima de 8 | Persistente | `AuthenticateUserUseCase.php` fora do diff; `login-form.js:18` mantém `MIN_PASSWORD_LENGTH = 8` (o diff do arquivo só acrescentou `await onSuccess(user)`, sem efeito de segurança) |
| **M-3** · porta publicada em todas as interfaces com `APP_ENV=local` | Persistente | `docker-compose.yml:48` (`APP_ENV: local`) e `:57-58` (`"8080:80"`) |
| **L-1** · linha de base de cabeçalhos só no bloco do document root | Persistente, **com superfície ampliada** | `apache.conf:78-93` sem `nosniff` e sem CSP; agora também serve 12 SVG e 6 WebP da identidade visual |
| **L-2** · pilha de log com valores de argumento | Persistente | `php.ini:1-27` sem `zend.exception_ignore_args`. Os `500` de catálogo citados acima são gatilhos adicionais, só de `ADMIN` e sem credencial |
| **O-3** · `ENGENHARIA.md` declara document root errado | Persistente na árvore de trabalho | `docs/ENGENHARIA.md:114` diz `backend/public/`; `apache.conf:52` diz `frontend/public` |
| **O-4** · allowlist de imagem remota aceita `http:` | Persistente | `RemoteUrlImageSource.php` fora do diff |
| **O-5** · sem HSTS, `Permissions-Policy` e rotação de log | Persistente | `apache.conf` e `docker-compose.yml` fora do diff |

---

## Não-achados verificados

### A · Controle de acesso

- **Cobertura de guard:** 22 rotas, 21 `Guard::protect`, 1 pública justificada
  (`AuthModule.php:62-64`). As nove de catálogo foram lidas uma a uma (`CatalogModule.php:60-106`).
- **Nenhuma identidade vinda do corpo.** As quatro rotas novas não leem `userId`, `role` nem
  `level`. A autorização é integralmente do guard (ADR-006).
- **Atribuição em massa impossível nas rotas novas.** Campo a campo, com tipo conferido na borda
  (`is_string`, `is_int`, `!== false`): `CreateEditionRoute.php:40-45`,
  `CreateRarityRoute.php:40-46`, `UpdateEditionRoute.php:43-50`, `UpdateRarityRoute.php:43-51`.
  `ColorField::read` lê um campo só e transforma valor presente e não textual em `''`, que a
  allowlist recusa, em vez de tratá-lo como ausente (`ColorField.php:19-28`). O `code` não é lido
  no `PUT`. `Request` continua sem getter de corpo inteiro (`Request.php:143-149`).
- **Pertencimento e IDOR.** O `PUT` de edição ou raridade não aceita `gameId` nem `code`, então não
  há como mover o item para outro jogo nem trocar o identificador público
  (`UpdateEditionInput`, `UpdateRarityInput.php:14-24`). A criação resolve o jogo pelo slug do
  caminho, com `NotFoundError` quando ele não existe (`CreateRarityUseCase.php:39-43`). Ausência de
  posse é decisão do ADR-006. O `{id}` é segmento inteiro pelo roteador (`Router.php:20`) e é
  convertido com `(int)`: texto vira `0`, e `0` vira `404` em `gameIdOf`.
- **CSRF nas escritas novas.** O middleware exige o token em todo método que altera estado
  (`Csrf.php:42`, falha `403` em `:57`), com a única isenção em `index.php:104`. O diff não
  acrescenta isenção.

### B · Autenticação e sessão

Fora do diff. Nenhum arquivo de sessão, guard, middleware ou `UseCases/Auth` mudou. O único efeito
transversal é o do OF-001, tratado acima: cookie de sessão malformado deixa de derrubar a
requisição e passa a ser sessão ausente.

### C · Injeção

- **SQL:** todas as instruções novas ou alteradas usam placeholder, inclusive número e cor:
  `RarityRepositoryPdo.php:87-104` (insert), `:106-125` (update);
  `EditionRepositoryPdo.php:87-104`, `:105-121`; `CardRepositoryPdo.php:43` (coluna `r.color`
  acrescentada à lista fixa) e `:292`. Nenhum nome de coluna dinâmico foi introduzido. A cor
  gravada é sempre `RarityColor->value`, nunca o texto do cliente. `0011_add_rarity_color.sql:8-9`
  e `0012_paint_seeded_rarities.sql:14-30` só têm literais.
- **Seed:** as instruções de `editions` e `rarities` usam placeholder e
  `ON DUPLICATE KEY UPDATE id = id` (`seed.php:137-141`, `:190-194`).
- **Comando, inclusão, desserialização, cabeçalho:** nada disso entrou no diff.

### D · Exposição de dado

- **Nenhum id interno novo para quem não é `ADMIN`.** `ref` e `sortOrder` só saem com `withState`
  (`CatalogPresenter.php:96-100`), e a cor da carta é a chave do enum (`CardPresenter.php:40-46`).
- **Logs novos sem dado pessoal.** Os casos de uso de catálogo registram tipo, `gameId` e `itemId`
  (`CreateRarityUseCase.php:64`, `UpdateRarityUseCase.php:55`). No cliente, o log novo registra o
  objeto da raridade (código, nome, cor) quando a cor sai da paleta (`cards-api.js:51`).
- **Seed, os quatro pontos do contrato, relidos no arquivo alterado:**
  1. a senha administrativa fora de `local` vem de `random_bytes`, é exibida uma vez e não é
     gravada (`seed.php:66-76`);
  2. o upsert de usuário toca **só** o nome (`seed.php:48`), então senha e `role_level` de usuário
     existente são intocáveis;
  3. edições e raridades existentes não são mais reescritas (OF-006);
  4. as cartas só entram com a tabela vazia (`:225-230`).

  O upsert de jogos (`:91`) ainda reescreve nome e ordem, mas não há rota de escrita de jogo, então
  nenhuma escolha de usuário é desfeita.
- **Binários de imagem sem metadado:**
  - `card-*.webp`: `VP8X` + `ALPH` + `VP8`;
  - `table-*.webp`: só `VP8`;
  - `apple-touch-icon.png`: `IHDR` + `IDAT` + `IEND`;
  - `favicon.ico`: duas imagens PNG internas, com os mesmos três blocos.

  Nenhum `EXIF`, `XMP`, `ICCP`, `tEXt`/`iTXt`/`zTXt` ou `C2PA`/`jumb`.
- **Nenhum literal de segredo acrescentado pelo diff**, pela varredura das linhas `+` de
  `backend/`, `frontend/`, `.gitignore` e `README.md`. O `README.md` só ganhou texto de roteiro e
  a seção de processo. As credenciais de demonstração são as mesmas de antes, publicadas pelo
  ADR-006.
- **Suítes novas servidas em `/tests`:**
  - `frontend/tests/suites/login-page.test.js:180-181` usa a credencial de demonstração já pública
    (ADR-006);
  - `frontend/tests/suites/layout-geometry.test.js:211` e `:806` usam o nome do próprio autor como
    parte local de um e-mail, num domínio fictício de demonstração, como texto de medida de
    layout.

  Nenhum dado de terceiro, e nenhum contato real.

### E · Upload e superfície não autenticada

Fora do diff: `Infra/Storage` e `Domain/Card` estão sem alteração. A superfície pública continua
sendo só `POST /api/auth/login`. A `/paleta` não faz nenhuma chamada de rede.

### F · Plataforma

- `apache.conf`, `php.ini`, `Dockerfile`, `entrypoint.sh` e `docker-compose.yml` estão fora do
  diff. O hash da CSP confere com o `index.html` alterado (`apache.conf:43`).
- **Sem CORS:** `grep -rni "access-control-allow"` em `backend/src`, `docker`, `frontend/src` e
  `frontend/public` não acha nada.
- **Sem dependência de terceiros (RNF-01, ADR-001):**
  - não existem `vendor/`, `node_modules/`, `composer.json`, `composer.lock`, `package.json` nem
    `package-lock.json`;
  - no código servido, o grep por bibliotecas conhecidas e CDNs só acha comentário
    (`card-image-field.js:7`, `tokens.css:92`) e URLs fictícias de teste;
  - a única URL externa acrescentada pelo diff em código servido é o namespace XML do SVG
    (`xmlns`), que não gera requisição;
  - todo `url()` de imagem aponta para a mesma origem (`tokens.css:227-274`, `:339-342`,
    `:412-415`), coberto por `img-src 'self'`.
- A skill de terceiro vendorizada em `.claude/skills/impeccable/` vem com `LICENSE` e `NOTICE.md`,
  e a origem está declarada (`.claude/README.md:37`). É material de ferramenta, não dependência de
  execução: nenhum arquivo dela é carregado pela aplicação.

### G · Frontend como superfície

- **Nenhum sink de HTML.** Em `frontend/src/`, `innerHTML`, `insertAdjacentHTML`, `outerHTML`,
  `document.write`, `eval(`, `new Function(` e `srcdoc` só aparecem em comentários
  (`brand-mark.js:12`; `elements.js:5`, `:21`, `:42`, `:118`) e no conjunto de atributos
  **proibidos** (`elements.js:25`, que também recusa `style`).
- **Dado editável só por `textContent`:**
  - o nome da raridade no selo (`rarity-badge.js:26`);
  - o nome da carta no verso (`card-back.js:37`);
  - o nome do item no painel (`catalog-panel.js:219`) e no campo de edição, via `input.value`
    (`:250`);
  - as notificações que interpolam o nome (`notifications.js:62`).

  `aria-label` interpolado vai por `setAttribute`, que não interpreta HTML.
- **Cor sem injeção de CSS.** A classe é composta só depois da allowlist (`rarity-badge.js:22`,
  `rarity-colors.js:37-39`), e o seletor de cor gera suas opções a partir da lista fechada
  (`rarity-color-field.js:23-33`).
- **Conjuntos fechados.** Nome de ícone e de ilustração vem de literal do código e lança fora do
  conjunto (`icon.js:29`, `:43-45`; `feedback.js:46-52`).
- **`/paleta`.** Lê as regras das folhas de estilo da própria origem (`palette-page.js:291`) e
  pinta por CSSOM (`:46-52`), sem entrada externa.
- **Armazenamento.** O diff não acrescenta `localStorage`, `sessionStorage` nem
  `document.cookie`. O único uso continua o da preferência de tema (`preference.js:24`, `:44`).
- **`index.html`.** Os três `<link>` novos são da mesma origem, e nenhum `<script>` inline ou
  atributo `on*` foi acrescentado.
- **SVG.** Os 13 têm zero conteúdo ativo.

---

## Requer verificação dinâmica

Nada disto foi executado nesta auditoria.

1. **`/favicon.ico` responde a imagem, e não o `index.html`.**
   `curl -sI http://localhost:8080/favicon.ico` deve devolver `200` com `Content-Type` de imagem.
   Se voltar `text/html`, o arquivo não está no document root do contêiner e o fallback de página
   única o engoliu. O mesmo vale para `/favicon.svg` e `/apple-touch-icon.png`.
2. **A superfície ampliada do L-1.** `curl -sI http://localhost:8080/src/assets/brand/symbol.svg`
   deve confirmar `Content-Type: image/svg+xml` e **ausência** de `X-Content-Type-Options` e de
   CSP. Isso confirma que o L-1 alcança os SVG novos, sem risco atual.
3. **A allowlist de cor no servidor.** Como `ADMIN`, com token CSRF, `PUT /api/rarities/{id}` com
   `"color":"red"` e depois com `"color":["gold"]` deve responder `400` com `errors.color`, e o
   banco não deve mudar.
4. **O seed preserva a edição do ADMIN (OF-006).** Renomear uma raridade da massa pelo `PUT`, rodar
   `backend/bin/seed.php` e conferir o nome em
   `GET /api/games/pokemon/rarities?incluirInativos=1`. A prova estática está feita (ver "Para
   consolidar"), e esta é a de integração. **Escreve no banco:** rodar só em ambiente descartável.
5. **Os itens 1, 2, 3, 5 e 6 da seção homônima de 09/09** seguem valendo, sem mudança: CSP numa
   tela real, `zend.exception_ignore_args` efetivo, `post_max_size` estourado, concorrência no
   limite de tentativas e volume de log.

---

## Roteiro de remediação

### 1. Imediato — antes do commit que versiona os quatro artefatos

- **IA-1.** Separar `.claude/settings.local.json`: `deny`, `ask` e o hook vão para
  `.claude/settings.json`, que é versionado; o `allow` amplo fica num `settings.local.json` fora do
  Git. Isso exige manter uma entrada no `.gitignore` para `/.claude/settings.local.json` quando a
  linha `/.claude/` sair.
- **IA-2.** Ajustar `CLAUDE.md:3` e os comentários de `.gitignore:1-2`, `:6-7` no mesmo commit.
- **Lista de termos do ADR-011** sobre os quatro artefatos e sobre o que já é versionado
  (IA-3 incluso).

### 2. Esta semana (persistentes de 09/09, fora do diff)

- **M-3**, duas linhas: `docker-compose.yml:58` → `"127.0.0.1:8080:80"`, e uma frase no `README.md`
  junto das credenciais.
- **L-2**, uma linha: `zend.exception_ignore_args = 1` em `docker/app/php.ini`.
- **L-1**: subir `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy` para o nível do
  `<VirtualHost>`. Com os SVG novos em `/src`, fica mais barato do que antes deixar de fora.
- **Rotação de log** no compose (resíduo do M-1).

### 3. Antes da próxima entrega — não desta

- **M-2** (janela por conta e piso de senha), **O-4** e **O-5**, como prescrito em 09/09.
- Os `500` de catálogo (M-1, M-2 e B-2 da qualidade de backend de 14/09) fecham também o gatilho
  adicional do L-2.

**Nada neste relatório bloqueia a entrega.**

---

## Para consolidar

### (a) Ledger — `docs/audits/open-findings.md`

**Linhas novas:** nenhuma. Esta auditoria não tem `CRITICAL` nem `HIGH`, então não há
`OF-NOVO-*`.

**Atualizações de linha existente:**

| ID | Proposta | Base |
|---|---|---|
| OF-006 | `Status`: `fixed` → `verified`. Acrescentar à coluna `Origem`: `sec_audit_2026-09-14_001_C0_H0_M0_L0_diff.md` (verificação) | `seed.php:140` e `:193` usam `ON DUPLICATE KEY UPDATE id = id` nas duas instruções que o achado aponta, e o comentário de `:132-136` e `:187-189` registra o motivo. `SeedPreservesAdminEditsTest` (`backend/tests/Shared/Quality/SeedPreservesAdminEditsTest.php:23-53`) extrai do texto do seed a lista de colunas atribuídas no upsert de `editions` e de `rarities`, e falha se ela contiver `name`, `sort_order`, `color` ou `active`. Contra o texto anterior, que atribuía `name` e `sort_order`, o teste falharia, então ele mede o defeito. A semântica do `ON DUPLICATE KEY UPDATE id = id` é determinística. **Ressalva:** a prova de integração (item 4 de "Requer verificação dinâmica") não foi executada, porque escreve no banco. Se a consolidação exigir prova em execução para `verified`, a linha fica `fixed` até ela. |
| OF-001 | Status inalterado (`verified`). Acrescentar à coluna `Origem`: `sec_audit_2026-09-14_001_C0_H0_M0_L0_diff.md` (confirmação pelo ângulo de segurança) | `Request.php:89`, `:91` e `:260-271`, lidos. Os resíduos (resposta do `catch` externo sem `SecurityHeaders` e compose sem rotação de log) ficam na tabela de persistentes deste relatório, sem reabrir a linha. |

**Nota sugerida**, substituindo a última frase do primeiro parágrafo de "Notas" ("A auditoria diff
de segurança de 14/09 foi interrompida e não tem relatório."):

> A auditoria diff de segurança de 14/09 foi refeita e está em
> `sec_audit_2026-09-14_001_C0_H0_M0_L0_diff.md`: nenhum achado novo (marcador `CLEAN`), OF-006
> verificado por leitura, e os quatro artefatos que vão ser versionados (`.claude/`, `CLAUDE.md` e
> os dois padrões) sem segredo, credencial ou dado pessoal. Ficam três observações de publicação
> sem pontuação: `settings.local.json` com permissão ampla, duas frases que deixam de valer no
> commit, e o resíduo de incidente em `StderrLogger.php:14-18`.

### (b) Métrica — `docs/audits/audit-metrics.jsonl`

```json
{"date":"2026-09-14","agent":"security-auditor","model":"opus","scope":"diff","branch":"feature-documentacao","duration_ms":null,"output_tokens":null,"tool_uses":43,"critical":0,"high":0,"medium":0,"low":0,"marker":"CLEAN","report":"docs/audits/sec_audit_2026-09-14_001_C0_H0_M0_L0_diff.md"}
```

CLEAN
