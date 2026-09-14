# Oráculo · Backend — Relatório de Auditoria de Qualidade

**Data:** 14/09/2026 | **Branch:** `feature-identidade-visual` | **Commit:** `ae28d94` | **Escopo:** diff contra `b7034fe`
**Auditor:** backend-quality-auditor

> **Nome, ledger e métrica.** Três auditores rodaram em paralelo nesta data, e por isso o nome
> leva `_backend_`. Esta execução **não** escreveu em `docs/audits/open-findings.md` nem em
> `docs/audits/audit-metrics.jsonl`: as linhas vão na seção **"Para consolidar"**, no fim, e a
> consolidação é feita em série por quem conduz a entrega.

**Conjunto auditado:** `git diff --name-only b7034fe...HEAD -- backend/`, com **45 arquivos**:
32 de produção (`bin/seed.php`, as migrations `0011` e `0012`, e 29 arquivos de `src/`, dos
quais 3 foram removidos e 2 renomeados) e 13 de teste. Nada não commitado em `backend/`.

**Raio de alcance incluído:** `Modules/CatalogModule.php` (registro das seis escritas);
`EditionGateway` e `RarityGateway`; `DeactivateCatalogItemUseCase` e sua rota, que continuam
sobre `CatalogItemGateway`; `docker/app/entrypoint.sh` e `docker-compose.yml` (quando o seed
roda); `Infra/Database/Connection.php` e o `sql_mode` do MySQL em execução; `ErrorHandler`
(o destino de uma exceção de banco); e `frontend/src/features/catalogs/components/catalog-panel.js`,
lido **só** para saber o que a tela alcança.

**Dimensões que voltaram a `full`:** nenhuma pela regra — o diff não toca `Guard`,
`ErrorHandler`, `Middleware/` nem `public/index.php`. Mas `Request::fromGlobals()` roda antes do
pipeline para toda rota, então a correção do OF-001 foi conferida contra várias rotas, e não só
contra o arquivo.

**Portão automatizado:** `validate.php` e `test.php` **não** foram rodados nesta execução, por
instrução de quem invocou (a cadeia estava rodando em paralelo sobre o banco compartilhado). O
que foi rodado, apenas em modo leitura:
- `docker compose exec app php backend/bin/check-boundaries.php`: **"Fronteiras de camada
  respeitadas (204 arquivos)"**, saída 0;
- `php -l` nos 27 arquivos PHP de produção presentes no diff: nenhum erro;
- `SELECT @@GLOBAL.sql_mode`: `ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,…` (MySQL 8.4.11);
- cinco requisições anônimas contra `http://localhost:8080`, para verificar o OF-001.

---

## Sumário executivo

| Severidade | Qtd. | Tempo estimado |
| ---------- | ---- | -------------- |
| CRÍTICO    | 0    | —              |
| ALTO       | 1    | 30min          |
| MÉDIO      | 2    | 2h30           |
| BAIXO      | 2    | 1h             |
| Convenção  | 0    | —              |

**Nenhum CRÍTICO.** O único ALTO é de integridade de dado, não de segurança: o seed desfaz, a
cada boot, a edição de nome e ordem que o ADMIN faz nas edições e raridades da massa.

### O que foi verificado e está correto

| Dimensão | Resultado no diff |
| --- | --- |
| Rota sem `Guard::protect` (`ENGENHARIA.md` §4.1) | **0.** As nove rotas do catálogo nascem protegidas (`CatalogModule.php:62-105`): três leituras em `VIEWER` e seis escritas em `ADMIN`. Os caminhos são os mesmos de antes da separação e batem com `docs/api-contract.md` §9 |
| Adequação do nível | **0.** Toda escrita de catálogo continua em `ADMIN`; nenhuma escrita em `VIEWER` |
| Status HTTP fora do `ErrorHandler` (§4.2) | **0** acertos nos arquivos alterados |
| Corpo repassado inteiro / identidade do corpo (§4.3) | **0.** As quatro rotas novas ou renomeadas lêem campo a campo e entregam a um DTO próprio (`Create/UpdateEditionInput`, `Create/UpdateRarityInput`). `ColorField::read` lê um campo só. O `code` não é lido no `PUT` |
| SQL concatenado / nome dinâmico sem allowlist (§4.4) | **0.** A cor entra por placeholder (`$color->value`) e só depois de passar pela allowlist (`RarityColor::tryFrom`). A `0012` só tem literais |
| Fronteiras de camada (§3) | **0.** O verificador está verde. `Domain\Catalog\Entity\Rarity` importa `Shared\Enum\RarityColor`, o que é permitido (`Domain ◀── Shared`). `UseCases/` não importa nada de `Infra` |
| Detalhe de banco alcançando o usuário | **0** nas mensagens novas. Mas veja M-1 e M-2: exceção de banco vira `500` genérico |
| Segredo / env com default | **0** |
| `SELECT *` / leitura sem limite (§4.5) | **0.** As três leituras de carta passam por `CardRepositoryPdo::COLUMNS`, que ganhou `r.color` (listagem na linha 84, `fetchOne` na 203, e `findDuplicate`, que usa `fetchOne`). Nenhuma leitura monta `Rarity` sem a coluna |
| N+1 | **0.** A cor vem pelo `JOIN` que já existia |
| Caso de uso chamando caso de uso (§4.10) | **0.** `CatalogItemRules` é regra de domínio compartilhada, não um caso de uso |
| Migration aplicada editada (§5) | **0.** `git diff --diff-filter=MDR b7034fe...HEAD -- backend/migrations/` e `git log --diff-filter=M -- backend/migrations/` voltam vazios. `0011` e `0012` são novas e ficaram separadas, com o motivo escrito no arquivo |
| Seed reescrevendo senha/permissão | **0** para usuários. **Para catálogo, veja A-1** |
| `throw new \Exception` cru / valor mágico de permissão / `pathinfo` / `json_encode` fora de apresentador / depuração | **0** em cada um |
| `declare(strict_types=1);` | **42/42** arquivos PHP presentes no diff |
| Apresentadores (ADR-004, sob TDD) | A cor sai na carta e na listagem da administração; a cascata pública continua `{id, name}`. Coberto por `CatalogPresenterTest::testAListagemPublicaDeRaridadeNaoGanhaCampo` e `CardPresenterTest::testARaridadeLevaACorDoSelo` |
| Cobertura dos casos de uso novos (§10.5) | Caminho feliz, cada validação, código repetido e item inexistente estão presentes nos quatro testes. A autorização fica no guard (ADR-006), então não há regra de nível dentro do caso de uso para testar |

### Achados anteriores tocados pelo diff

- **OF-001: verificado.** `Request.php:89` e `:91` passam por `onlyStrings()`
  (`Request.php:260-271`), que descarta o que não é escalar. Há três testes em `RequestTest`
  (`testDescartaParametroDeQueryQueNaoSejaTexto`, `testDescartaCookieQueNaoSejaTexto`,
  `testNumeroEmQueryContinuaVirandoTexto`). Reproduzido contra o contêiner em execução, sem
  sessão:
  ```
  /api/games?a[]=1          -> 401
  /api/cards?page[]=1       -> 401
  /api/cards?search[]=x     -> 401
  /api/games                -> 401
  Cookie: ORACULOSID[a]=b   -> 401   {"message":"Sessão expirada. Entre novamente."}
  ```
  Antes da correção, os casos com array respondiam `500`; hoje respondem igual à requisição
  bem formada. Proposta de status: `fixed → verified` (ver "Para consolidar").
- **M-3 de 09/09 (`SaveCatalogItemInput` com campos mortos): fechado e conferido.** O DTO saiu
  junto com `Create/UpdateCatalogItemUseCase`, e cada escrita tem hoje uma entrada com só os
  campos que usa.
- **B-4 de 09/09 continua de pé.** `seed.php:29` ainda diz "o enum chega no Épico 1". O
  arquivo está no diff, mas a linha não foi tocada.

### O que não foi reportado por decisão de ADR

- **`ColorField` e as rotas novas sem teste unitário**, e **repositórios PDO sem teste**: pelo
  ADR-004, fiação de rota e repositório ficam fora do TDD estrito.
- **Ausência de checagem de posse**: ADR-006.
- **Literais de cor no seed e na `0012`**: massa de dados é intencional e fica fora da dimensão
  de valor fixo.

---

## CRÍTICO

Nenhum.

---

## ALTO

### A-1 · O seed desfaz, a cada boot, o nome e a ordem que o ADMIN deu às edições e raridades da massa

- **Local:** `backend/bin/seed.php:185` (raridades) e `backend/bin/seed.php:135` (edições). Quem
  executa é `docker/app/entrypoint.sh:16-17`, em todo boot.
- **Evidência:**

  ```php
  // seed.php:182-190 — a instrução que o diff alterou, e o comentário que o diff escreveu
  $insertRarity = $pdo->prepare(
      'INSERT INTO rarities (game_id, code, name, color, sort_order, active, created_at)
       VALUES (:game_id, :code, :name, :color, :sort_order, 1, :now)
       ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)'
  );

  // A cor entra só na inserção, e fica FORA do ON DUPLICATE KEY UPDATE: o seed
  // roda a cada boot, e reescrevê-la desfaria a escolha do ADMIN a cada
  // `docker compose up`. Banco que já existia recebe as cores pela migration 0012.
  ```
  ```php
  // seed.php:132-136 — edições, a mesma cláusula
  ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)'
  ```
  ```sh
  # entrypoint.sh:13-17
  echo "[entrypoint] aplicando migrations"
  php /var/www/backend/bin/migrate.php
  echo "[entrypoint] aplicando seed"
  php /var/www/backend/bin/seed.php
  ```

  O que a tela alcança. É o editor que entrou em `477e1c2` (11/09, dentro deste diff), em
  `frontend/src/features/catalogs/components/catalog-panel.js:302-307`:
  ```js
  await api.update(item.ref, {
    name: name.value,          // o nome digitado pelo ADMIN
    sortOrder: item.sortOrder,
    active: item.active,
    color: color?.value ?? item.color,
  });
  ```
  A API altera nome **e** ordem (`UpdateRarityRoute.php:45-46`, `UpdateEditionRoute.php:45-46`).

  A sequência: o ADMIN renomeia `pokemon:rare-holo` de "Rara Holo" para "Rara Holográfica" e
  recebe `204`. No boot seguinte, o seed executa o `INSERT` com
  `('pokemon', 'rare-holo', 'Rara Holo', 4, 'aquamarine')`. A chave `(game_id, code)` já existe,
  então o `ON DUPLICATE KEY UPDATE` devolve `name` a "Rara Holo" e `sort_order` a 4. A cor
  escolhida pelo ADMIN fica. Nada é logado e nada falha.

  **Não reproduzido em execução**, porque exigiria escrever no banco compartilhado e rodar o
  `seed.php`, e as duas coisas estavam vetadas nesta auditoria. A conclusão vem da leitura, e a
  semântica do `ON DUPLICATE KEY UPDATE` é determinística.

- **Problema:** o comentário que este diff escreveu três linhas abaixo já enuncia a regra certa
  ("reescrevê-la desfaria a escolha do ADMIN a cada `docker compose up`"), mas ela foi aplicada
  só à cor. Nome e ordem são o mesmo tipo de escolha do ADMIN, e o nome é justamente o campo que
  a tela de edição nova oferece. A auditoria de 09/09 conferiu esta cláusula apenas do ângulo de
  senha e permissão de usuário. Na época a tela não oferecia "Editar" (a nota do ledger sobre
  RF-41/RF-42 registra isso), então a edição só era alcançável pela API.
- **Impacto:**
  1. **RF-41 e RF-42 perdem o efeito.** A edição, entregue e verificada na tela em 11/09, some
     no próximo boot para os 30 itens da massa, que no ambiente entregue são praticamente o
     catálogo inteiro. Com `restart: unless-stopped` no `docker-compose.yml`, "próximo boot"
     inclui reiniciar o Docker ou a máquina.
  2. **O registro fica incoerente consigo mesmo.** Cor e estado sobrevivem; nome e ordem voltam.
     Uma "Mítica" repintada e renomeada volta com a cor nova e o nome velho.
  3. **Contradiz a tese escrita no próprio `CatalogModule.php:37-39`**: "entra em produção por
     cadastro, não por deploy". Aqui, um deploy desfaz um cadastro.

  **O que não acontece**, e por isso não é CRÍTICO: itens criados pelo ADMIN (códigos
  diferentes) não são tocados; a desativação sobrevive, porque `active` não está no `UPDATE`;
  não há impacto de segurança.

- **Correção:** o seed passa a só **criar**. Corrigir a massa de um banco que já existe é
  trabalho de migration, que é exatamente o raciocínio da `0012`.

  **Antes** (`seed.php:135` e `seed.php:185`):
  ```php
  ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)'
  ```
  **Depois:**
  ```php
  // Chave natural que já existe é item que já pertence ao ADMIN: o seed só
  // CRIA. Nome, ordem e cor que ele mudou não podem voltar ao valor da massa
  // a cada boot. Corrigir a massa de um banco existente é migration (ver 0012).
  ON DUPLICATE KEY UPDATE id = id'
  ```
  Use `id = id`, e não `INSERT IGNORE`. O `IGNORE` rebaixa a aviso **qualquer** erro da linha
  (truncamento, chave estrangeira), e o seed seguiria com dado errado sem dizer nada.

  No mesmo passo:
  - generalizar o comentário de `seed.php:188-190`, que deixa de ser só sobre a cor;
  - ajustar o cabeçalho (`seed.php:8-9`, "idempotente por chave natural") e
    `docs/database-schema.md:338`, que descrevem o upsert;
  - por consistência, aplicar o mesmo em `seed.php:91` (jogos), que hoje não tem rota de
    escrita.

- **Verificação que a correção precisa trazer.** O ADR-004 diz que bug corrigido entra com o
  teste que o reproduz. O seed fica fora do runner unitário, então a prova vai para o roteiro de
  integração, ao lado da checagem que já existe para senha: renomear "Mítica" e mudar a ordem
  pelo `PUT`, rodar `seed.php` e confirmar em `GET /api/games/magic/rarities?incluirInativos=1`
  que nome e ordem continuam os do ADMIN.

---

## MÉDIO

### M-1 · Nome de edição ou raridade maior que a coluna responde 500

- **Local:** `backend/src/Domain/Catalog/Validation/CatalogItemRules.php:42-45`. Limites reais em
  `backend/migrations/0006_create_editions.sql:7` (`name VARCHAR(120)`) e
  `backend/migrations/0007_create_rarities.sql:28` (`name VARCHAR(80)`).
- **Evidência:**
  ```php
  // CatalogItemRules.php:41-45 — a única regra de nome, usada nas quatro escritas
  /** @return array<string,string> */
  public static function nameErrors(string $name): array
  {
      return $name === '' ? ['name' => 'O nome é obrigatório.'] : [];
  }
  ```
  ```
  SELECT @@GLOBAL.sql_mode  ->  ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,…
  ```
  Nenhum `maxlength` existe em `frontend/src/` (`grep -rn maxlength` sem acerto), então a tela
  deixa digitar qualquer tamanho.
- **Problema:** com `STRICT_TRANS_TABLES`, um nome de raridade com 81 caracteres faz o `INSERT`
  ou o `UPDATE` falhar com `SQLSTATE[22001]` (1406, *Data too long*). A `PDOException` não é
  `DomainError`, cai em `ErrorHandler::fromUnexpected` (`ErrorHandler.php:66-79`) e sai como
  `500 "Erro interno. Tente novamente."`, com a pilha no log.

  O repositório já tem o precedente certo: o nome da carta é validado contra o tamanho da coluna
  (`Domain/Card/Validation/Step/NameEnRequired.php:19`, `MAX_LENGTH = 150`, com `mb_strlen`). O
  cabeçalho de `CatalogItemRules` justifica unificar as regras "para a raridade não aceitar o que
  a edição recusa", mas as duas colunas têm limites **diferentes**. Uma regra sem parâmetro não
  consegue expressar o limite verdadeiro de nenhuma das duas.
- **Impacto:** o ADMIN recebe um erro genérico, sem campo apontado; tentar de novo falha igual;
  e o contrato promete `400` com o campo para entrada inválida. É MÉDIO, e não ALTO, porque só o
  `ADMIN` alcança e porque nome de catálogo desse tamanho é improvável. **Não reproduzido**, pois
  exigiria escrita no banco; a conclusão vem do `sql_mode` confirmado somado ao tipo da coluna.
- **Correção:** o limite entra como parâmetro, com uma constante por catálogo.

  **Antes:**
  ```php
  public static function nameErrors(string $name): array
  {
      return $name === '' ? ['name' => 'O nome é obrigatório.'] : [];
  }
  ```
  **Depois:**
  ```php
  /** Os limites das colunas: editions.name (0006) e rarities.name (0007). */
  public const EDITION_NAME_MAX = 120;
  public const RARITY_NAME_MAX = 80;

  /** @return array<string,string> */
  public static function nameErrors(string $name, int $maxLength): array
  {
      if ($name === '') {
          return ['name' => 'O nome é obrigatório.'];
      }

      // Acima da coluna, o MySQL em modo estrito recusa a escrita, e a recusa
      // chegava ao usuário como 500 genérico, sem campo apontado.
      return mb_strlen($name) > $maxLength
          ? ['name' => 'O nome precisa ter no máximo ' . $maxLength . ' caracteres.']
          : [];
  }
  ```
  `errors()` recebe o mesmo parâmetro. Testes, sob TDD estrito (domínio):
  `CatalogItemRulesTest::testNomeNoLimiteDaColunaPassaEUmAcimaNao`, e um caso por catálogo nos
  testes de criação e alteração. O `maxlength` correspondente na tela é assunto do frontend (ver
  "Fora de escopo").

### M-2 · `sortOrder` no `PUT`: ausente ou não inteiro vira 0 em silêncio; fora da faixa, vira 500

- **Local:** `backend/src/Infra/Http/Routes/Catalog/UpdateRarityRoute.php:46` e
  `backend/src/Infra/Http/Routes/Catalog/UpdateEditionRoute.php:46`. A faixa vale também para
  `CreateRarityRoute.php:44` e `CreateEditionRoute.php:44`. Colunas `sort_order SMALLINT UNSIGNED`
  em `0006_create_editions.sql:9` e `0007_create_rarities.sql:30`.
- **Evidência:**
  ```php
  // UpdateRarityRoute.php:46 (e UpdateEditionRoute.php:46)
  sortOrder: is_int($request->body('sortOrder')) ? $request->body('sortOrder') : 0,
  ```
  ```php
  // UpdateRarityUseCase.php:17-20 — o docblock que o diff escreveu
  * **A cor é obrigatória aqui**, ao contrário da criação. O `PUT` é
  * substituição: um cliente que esquecesse o campo pintaria de grafite, em
  * silêncio, a raridade que era ouro. Recusar é o que torna o esquecimento
  * visível — o mesmo defeito que já zerava a ordem na reativação.
  ```
- **Problema:** são duas falhas no mesmo campo.
  1. **Ausente vira 0.** O diff fez o servidor recusar cor ausente no `PUT` para que um cliente
     esquecido não repinte nada em silêncio, e cita como motivo "o mesmo defeito que já zerava a
     ordem". Mas **esse** defeito, o da ordem, foi corrigido só no cliente (`b7eb04f`): o servidor
     continua transformando `sortOrder` ausente, ou `"sortOrder": "4"`, em `0`. O cabeçalho do
     próprio `ColorField` descreve a armadilha ("tratar como ausente esconderia o erro do
     cliente"), e ela ficou aberta para a ordem.
  2. **Fora da faixa vira 500.** `-1` ou `70000` estouram o `SMALLINT UNSIGNED`. Em modo estrito,
     isso é `SQLSTATE[22003]` (1264), e sai como `500` pelo mesmo caminho do M-1.
- **Impacto:** qualquer cliente que não seja a tela atual (um `curl`, uma tela futura, um script)
  e omita a ordem manda a "Mítica" para o topo da cascata sem erro nenhum. É exatamente o
  defeito visto em 10/09, que continua possível pelo servidor. A faixa gera `500` em entrada de
  `ADMIN`. **Não reproduzido**, pelo mesmo motivo do M-1.
- **Correção:** tratar a ordem como a cor já é tratada. Na rota:
  ```php
  // Infra/Http/Routes/Catalog/SortOrderField.php — irmão do ColorField
  final class SortOrderField
  {
      /**
       * Ausente vira null, e o caso de uso decide: 0 na criação, erro na
       * alteração. Presente e não inteiro vira -1, que a faixa recusa — virar 0
       * esconderia o erro do cliente, como a cor ausente virando grafite.
       */
      public static function read(Request $request): ?int
      {
          $raw = $request->body('sortOrder');

          if ($raw === null) {
              return null;
          }

          return is_int($raw) ? $raw : -1;
      }
  }
  ```
  No domínio:
  ```php
  // CatalogItemRules
  /** sort_order é SMALLINT UNSIGNED (0006, 0007). */
  public const SORT_ORDER_MAX = 65535;

  /** @return array<string,string> */
  public static function sortOrderErrors(?int $sortOrder, bool $required): array
  {
      if ($sortOrder === null) {
          return $required ? ['sortOrder' => 'Informe a ordem de exibição.'] : [];
      }

      return $sortOrder < 0 || $sortOrder > self::SORT_ORDER_MAX
          ? ['sortOrder' => 'A ordem precisa ser um número inteiro entre 0 e ' . self::SORT_ORDER_MAX . '.']
          : [];
  }
  ```
  Os `Input` passam a `?int $sortOrder`. A criação usa `required: false` (e `null` vira 0, como o
  contrato já diz); a alteração usa `required: true`. A tela já manda o campo nos dois `PUT`
  (`catalog-panel.js:191` e `:304`), então nada muda no frontend. Testes sob TDD estrito:
  `UpdateRarityUseCaseTest::testSemOrdemERecusadoEmVezDeZerar`, o mesmo em
  `UpdateEditionUseCaseTest`, e `CatalogItemRulesTest::testOrdemForaDaFaixaERecusada`. Em
  `docs/api-contract.md`, na tabela "Escrita nos catálogos", registrar a ordem como obrigatória
  no `PUT` e a faixa.

---

## BAIXO

### B-1 · `Rarity::with` aceita omitir a cor

`backend/src/Domain/Catalog/Entity/Rarity.php:45`

```php
RarityColor $color = RarityColor::DEFAULT,
```

Os dois caminhos de produção passam a cor (`CardRepositoryPdo.php:285`,
`RarityRepositoryPdo.php:176`), e o padrão só serve aos testes
(`RarityTest::testRaridadeSemCorEscolhidaEGrafite`). O problema é que um valor padrão na fábrica
do domínio reabre, por baixo, o caminho que o `PUT` fecha. Uma terceira leitura (um relatório,
uma exportação) que esqueça `r.color` compila, passa nos testes e pinta tudo de grafite em
silêncio. Tirar o padrão faz o esquecimento virar erro de tipo. Os dublês passam
`RarityColor::DEFAULT` explicitamente, e o que o teste afirma já está coberto por
`RarityColorTest::testOPadraoEOGrafiteONeutroDeHoje`.

### B-2 · Criação concorrente com o mesmo código responde 500, não 409

`backend/src/UseCases/Catalog/CreateRarityUseCase.php:58-62` e
`backend/src/UseCases/Catalog/CreateEditionUseCase.php:51-55`

```php
if ($this->rarities->existsWithCode($game->id, $code, null)) {
    throw new ConflictError('Já existe uma raridade com este código neste Card Game.');
}

$id = $this->rarities->insert($game->id, $code, $name, $input->sortOrder, $color);
```

O caso de uso confere e depois insere. Com duas requisições simultâneas e o mesmo código, a
`UNIQUE (game_id, code)` preserva a integridade, mas a perdedora recebe `1062` e sai como `500`.
A mesma lacuna aparece por outro caminho: `existsWithCode` filtra `deleted_at IS NULL`
(`RarityRepositoryPdo.php:137`) e a chave única não. Nenhum código grava `deleted_at` em
catálogo hoje, então esse segundo caminho só existe com escrita direta no banco.

Correção: `insert` devolve `?int`, com `null` quando o driver responder `23000/1062`, e o caso de
uso lança o mesmo `ConflictError`, mantendo a mensagem num lugar só. É BAIXO porque exige dois
`ADMIN` criando o mesmo código ao mesmo tempo; o duplo clique já é barrado na tela pela flag
`submitting`.

---

## Convenções

Nenhum achado.

| O que foi conferido | Método | Resultado |
| --- | --- | --- |
| Nome do branch (ADR-010: hífen, nunca barra) | `git branch --show-current` | `feature-identidade-visual`, conforme |
| Idioma dos identificadores | leitura dos arquivos do diff | inglês (`RarityColor`, `CatalogItemRules`, `ColorField`, `UpdateRarityInput`) |
| Idioma de comentário, nome de teste e mensagem ao usuário | idem | português (`testSemCorERecusadoEmVezDeApagarACorQueHavia`, "Escolha uma das cores da paleta.") |
| Arquivo PHP em `PascalCase.php` | lista do diff | conforme |
| Constante em `UPPER_SNAKE_CASE` | leitura | `CODE_PATTERN`, `DEFAULT`, `COLUMNS`, conforme |
| `declare(strict_types=1);` | varredura dos arquivos do diff | 42/42 |

---

## Fora de escopo — notado

- **O B-2 de 09/09 continua de pé, e agora um teste o contradiz.** O docblock de
  `backend/src/UseCases/Catalog/DeactivateCatalogItemUseCase.php:26-27` ainda promete "quantas
  cartas usam o item". O arquivo está fora do diff, mas o teste dele entrou no diff
  (`DeactivateCatalogItemUseCaseTest::testDesativaItemEmUsoEInformaQueEstavaEmUso`) e afirma um
  booleano.
- **Frontend: nenhum campo tem `maxlength`** (`frontend/src/shared/components/field.js:35-46`).
  É isso que torna o M-1 alcançável pela tela. A checagem do cliente não substitui a do servidor,
  mas pouparia a ida e volta. Fica para o auditor de frontend.

---

## Recomendações

1. **Corrigir o A-1 nesta branch, antes do merge em `development`.** São três cláusulas num
   arquivo que a branch já alterou, e o princípio certo já está escrito no comentário ao lado. É
   o único achado que desfaz, sem aviso, algo que o usuário fez.
2. **Fechar M-1 e M-2 juntos.** É a mesma classe de defeito (entrada fora do domínio da coluna,
   saindo como `500` ou virando padrão silencioso), no mesmo arquivo (`CatalogItemRules`), com
   testes em camada de TDD estrito. Não precisa bloquear o merge, mas deve fechar antes de `main`.
3. **Mover o OF-001 para `verified`** no ledger. A verificação está neste relatório.
4. **B-1, B-2 e o B-4 de 09/09** quando passar por perto.

---

## Para consolidar

### (a) Ledger — `docs/audits/open-findings.md`

**Linha nova:**

```markdown
| OF-NOVO-1 | HIGH | — | O seed reaplica a massa sobre edições e raridades que já existem (`ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)`) e roda a cada boot: o nome e a ordem editados pelo ADMIN (RF-41/RF-42, editor de `477e1c2`) voltam ao valor do seed no próximo `docker compose up`, sem erro nem log. A cor, na mesma instrução, foi deixada de fora exatamente por esse motivo, escrito no comentário ao lado | `backend/bin/seed.php:135`, `backend/bin/seed.php:185` | `2026-09-14_feature-identidade-visual_backend_0c-1h-2m-2l_diff.md` | open | | 2026-09-14 | |
```

**Atualização de linha existente:**

- **OF-001**: `Status` de `fixed` para `verified`. Acrescentar à coluna `Origem`
  `2026-09-14_feature-identidade-visual_backend_0c-1h-2m-2l_diff.md` (verificação).
  Nota sugerida: *"OF-001 verificado em 14/09 pela auditoria de backend (diff contra `b7034fe`):
  `onlyStrings()` em `Request.php:89` e `:91`, três testes em `RequestTest`, e cinco requisições
  anônimas (`/api/games?a[]=1`, `/api/cards?page[]=1`, `/api/cards?search[]=x`, `/api/games`,
  `Cookie: ORACULOSID[a]=b`) respondendo `401`, nenhuma `500`."*

OF-002 a OF-005 são de frontend e não foram avaliados aqui.

### (b) Métrica — `docs/audits/audit-metrics.jsonl`

```json
{"date":"2026-09-14","agent":"backend-quality-auditor","model":"opus","scope":"diff","branch":"feature-identidade-visual","duration_ms":null,"output_tokens":null,"tool_uses":39,"critical":0,"high":1,"medium":2,"low":2,"marker":"HIGH_ONLY","report":"docs/audits/2026-09-14_feature-identidade-visual_backend_0c-1h-2m-2l_diff.md"}
```

HIGH_ONLY
