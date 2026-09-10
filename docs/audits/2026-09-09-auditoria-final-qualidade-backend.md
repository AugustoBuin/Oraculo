# Oráculo · Backend — Relatório de Auditoria de Qualidade

**Data:** 09/09/2026 | **Branch:** `development` | **Commit:** `88f76ce` | **Escopo:** full
**Auditor:** backend-quality-auditor
**Ocasião:** auditoria de fechamento da entrega (F-051), agendada em
`docs/audits/open-findings.md` como "09/09, antes da entrega".

> **Nome do arquivo.** Este relatório usa `2026-09-09-auditoria-final-qualidade-backend.md`
> em vez do `AAAA-MM-DD-auditoria-final-qualidade.md` padrão porque a auditoria de qualidade
> do frontend rodou em paralelo e os dois nomes colidiriam.
>
> **Ledger e métrica.** Esta execução **não** escreveu em `docs/audits/open-findings.md` nem
> em `docs/audits/audit-metrics.jsonl`: três auditorias rodaram hoje e a consolidação é
> serial, feita por quem conduziu a entrega. As linhas de ledger e a linha de métrica foram
> devolvidas na resposta da invocação, sem `OF-NNN` atribuído.

---

## Sumário executivo

| Severidade | Qtd. | Tempo estimado |
| ---------- | ---- | -------------- |
| CRÍTICO    | 0    | —              |
| ALTO       | 1    | 45min          |
| MÉDIO      | 6    | 3h             |
| BAIXO      | 8    | 1h             |
| Convenção  | 0    | —              |

**Nenhum achado CRÍTICO. A entrega não está bloqueada.**

O portão automatizado está verde: `docker compose exec app php backend/bin/validate.php`
percorre os cinco passos (marcadores de conflito, `php -l`, fronteiras de camada,
placeholders de SQL, testes) e fecha com **217 passou, 0 falhou**.

### O que foi verificado e está correto

Estas são as dimensões que mais reprovam neste repositório, e todas passaram — registrado
aqui porque conformidade verificada tem o mesmo valor de informação que um achado:

| Dimensão | Resultado |
| --- | --- |
| Rota sem `Guard::protect` (`ENGENHARIA.md` §4.1) | **0.** As 22 rotas conferidas uma a uma contra `php bin/routes.php` e contra `docs/api-contract.md` §9: mapa idêntico, 1 pública (`POST /api/auth/login`), justificada por escrito em `AuthModule.php:62-64` e no cabeçalho de `LoginRoute.php` |
| Adequação do nível | **0.** Nenhuma escrita em `VIEWER`; toda operação de catálogo em `ADMIN`; toda mutação de carta em `EDITOR`. O `incluirInativos` das rotas de catálogo é decidido no caso de uso pelo nível da sessão, não na rota — com o efeito negado coberto por teste |
| Status HTTP fora do `ErrorHandler` (§4.2) | **0.** O único `http_response_code()` do código é `Response.php:128`, dentro do `send()`. Os outros três acertos do grep são comentários explicando a regra |
| Corpo repassado inteiro / identidade vinda do corpo (§4.3) | **0.** `Request` **não tem** getter de corpo inteiro — só `body(string $field)`. Toda rota desestrutura campo a campo; `authorId` e `userId` vêm sempre de `Guard::USER_ATTRIBUTE` |
| SQL por concatenação / nome dinâmico sem allowlist (§4.4) | **0.** `ORDER BY` só por `CardQuery::SORTS`; `LIMIT`/`OFFSET` interpolados a partir de inteiros normalizados ou de constantes internas, sempre sob `max(1, …)`; `EMULATE_PREPARES` desligado |
| Fronteiras de camada (§3) | **0.** `check-boundaries.php` verde em 186 arquivos; grep manual em `Domain/` e `UseCases/` sem um acerto sequer |
| Detalhe de banco alcançando o usuário | **0.** `ErrorHandler::fromUnexpected` devolve frase neutra e manda SQLSTATE, arquivo e stack só para o log |
| Segredo no código / env com default | **0.** `Env::required` lança `EnvironmentError` sem fallback; nenhum `getenv()` solto |
| `SELECT *` / leitura sem limite (§4.5) | **0.** Nenhum `SELECT *`. Toda leitura tem `WHERE` e/ou paginação, conforme `PADROES.md` §7.3 e o DoD §17.1 |
| N+1 | **0.** Jogo, edição e raridade vêm por `JOIN`; o nome do autor da auditoria também |
| Caso de uso chamando caso de uso (§4.10) | **0.** A reação transversal é evento (`CardChanged` → `WriteCardAuditHandler`) |
| Handler de evento que lança (§4.9) | **0.** Corpo inteiro em `try/catch` no handler **e** no dispatcher; nenhum `throw` depois do `catch` |
| Migration já aplicada editada (§5) | **0.** `git log --diff-filter=M -- backend/migrations/` volta vazio. A correção da coluna `payload` virou a migration nova `0010`, com a razão escrita no próprio arquivo |
| Seed reescrevendo senha/permissão | **0.** `ON DUPLICATE KEY UPDATE name = VALUES(name)` — só o nome. Senha fixa só em `APP_ENV=local` |
| `declare(strict_types=1);` | **0 ausências** em 186 arquivos de `src/`, `bin/` e `public/` |
| Valor mágico de permissão | **0.** Nenhum `'ADMIN'`/`'EDITOR'`/`'VIEWER'` solto fora do enum |
| Upload validado por extensão (ADR-008) | **0.** Tipo apurado por `finfo` sobre o conteúdo; nenhum `pathinfo` no código |
| Depuração esquecida | **0.** Os acertos de `echo` são o `Response::send()` e comentários da própria regra |

### O que não foi reportado por decisão de ADR

- **Cobertura de teste não uniforme** — ADR-004. Repositórios PDO, fiação de rota e
  renderização de DOM ficam fora do TDD estrito, com verificação por roteiro manual. É poda
  deliberada, não lacuna.
- **Ausência de checagem de posse (IDOR)** — ADR-006. Não há recurso com dono neste
  domínio; a autorização é integralmente por nível, e o ADR registra a avaliação.
- **`401` para sessão ausente e `403` para nível insuficiente** — ADR-007, que diverge do
  `PADROES.md` §4.2 de propósito. O código segue o ADR.
- **Apparatus de observabilidade reduzido** — ADR-002.
- **Valores fixos do seed** (`DEMO_PASSWORD`, `LEVEL_*`) — massa de exemplo está fora do
  escopo de achado de valor fixo, e a senha de demonstração só existe em `APP_ENV=local`.

---

## CRÍTICO

Nenhum.

---

## ALTO

### A-1 · Parâmetro de consulta ou cookie em forma de array derruba qualquer rota `/api/*` com 500, sem autenticação

- **Local:** `backend/src/Infra/Http/Request.php:89` e `backend/src/Infra/Http/Request.php:91`
- **Evidência:**

  ```php
  // Request.php:85-96 — dentro de fromGlobals()
  return new self(
      method: $method,
      path: $path,
      rawBody: (string) file_get_contents('php://input'),
      query: array_map('strval', $_GET),      // linha 89
      headers: self::normalizeHeaders(self::headersFromServer($_SERVER)),
      cookies: array_map('strval', $_COOKIE), // linha 91
      // …
  );
  ```

  Reproduzido contra o contêiner em execução, **sem sessão**:

  ```
  GET /api/cards?page[]=1   → 500   {"message":"Erro interno. Tente novamente."}
  GET /api/cards            → 401   {"message":"Sessão expirada. Entre novamente."}
  GET /api/games?a[]=1      → 500
  GET /api/cards?search[]=x → 500
  POST /api/auth/login?x[]=1 → 500
  Cookie: ORACULOSID[a]=b   → 500   (mesmo defeito, linha 91)
  ```

  E a linha que sai no log a cada requisição dessas:

  ```json
  {"level":"error","message":"Falha não tratada","context":{"exception":"ErrorException",
   "message":"Array to string conversion","origin":"/var/www/backend/src/Infra/Http/Request.php:89",
   "trace":"#1 [internal function]: strval(Array)\n#2 …Request.php(89): array_map('strval', Array)
   \n#3 …/public/index.php(108): App\\Infra\\Http\\Request::fromGlobals()"}}
  ```

- **Problema:** `$_GET` e `$_COOKIE` não são `array<string,string>` — o PHP transforma
  `?page[]=1` num array aninhado. `strval()` sobre um array emite o warning
  `Array to string conversion`, que o `set_error_handler` do front controller
  (`public/index.php:46-52`) converte em `ErrorException` — deliberadamente, e a decisão
  está certa. O que está errado é a suposição de tipo em `fromGlobals()`.

  A falha acontece em `Request::fromGlobals()`, ou seja **antes do pipeline inteiro**:
  antes do `SessionMiddleware`, antes do guard, antes do roteador. Por isso ela alcança
  todas as 22 rotas, inclusive as protegidas, sem nenhuma credencial. A anotação
  `@param array<string,string> $query` na linha 25 documenta um contrato que a origem do
  dado não cumpre.

- **Impacto:**
  1. **Contrato quebrado.** `docs/api-contract.md` §2 define `500` como "falha não
     tratada" e `400` como "entrada inválida". Entrada malformada do cliente respondendo
     `500` classifica um erro do cliente como incidente do servidor.
  2. **Log envenenado.** Cada requisição dessas grava uma linha `error` com stack trace
     completa. Um laço de `curl` de uma linha, sem autenticação, enche o log do contêiner e
     afoga qualquer falha real no meio do ruído — exatamente o que o `traceId` e o logger
     estruturado existem para evitar (`PADROES.md` §6).
  3. **Percepção na avaliação.** É um `500` alcançável com uma URL, na entrega.

  **O que *não* acontece, e por isso o achado não é CRÍTICO:** nada vaza. O corpo é a
  mensagem genérica `"Erro interno. Tente novamente."`; o texto real, o caminho do arquivo
  e a stack ficam só no log, como o `ErrorHandler` promete. Não há bypass de autenticação
  nem de autorização — a requisição morre antes de alcançar dado nenhum.

- **Correção:** achatar para texto o que é texto e descartar o resto, na borda onde a
  suposição nasce.

  **Antes** (`Request.php:89` e `:91`):

  ```php
  query: array_map('strval', $_GET),
  // …
  cookies: array_map('strval', $_COOKIE),
  ```

  **Depois:**

  ```php
  query: self::onlyStrings($_GET),
  // …
  cookies: self::onlyStrings($_COOKIE),
  ```

  ```php
  /**
   * Só os valores escalares, já como texto.
   *
   * $_GET e $_COOKIE não são array<string,string>: `?page[]=1` produz um array
   * aninhado, e `strval()` sobre ele emite warning — que o front controller
   * converte em exceção, transformando entrada malformada do cliente em 500.
   * Um parâmetro que chega como array é um parâmetro que o contrato não prevê:
   * descartá-lo faz a rota seguir pelo caminho de "ausente", que ela já trata.
   *
   * @param array<array-key,mixed> $values
   * @return array<string,string>
   */
  private static function onlyStrings(array $values): array
  {
      $clean = [];

      foreach ($values as $key => $value) {
          if (is_string($key) && (is_string($value) || is_numeric($value))) {
              $clean[$key] = (string) $value;
          }
      }

      return $clean;
  }
  ```

  Com isso, `?page[]=1` passa a responder como se `page` não tivesse sido enviado — `200`
  com a primeira página —, e `Cookie: ORACULOSID[a]=b` passa a responder `401`, que é a
  resposta correta para "não há sessão utilizável".

- **Teste que a correção precisa trazer** (ADR-004: bug corrigido entra com o teste que o
  reproduz, mesmo em camada fora do TDD estrito — e `RequestTest.php` já existe):
  `testDescartaParametroDeConsultaEmFormaDeArray` e
  `testDescartaCookieEmFormaDeArray`.

---

## MÉDIO

### M-1 · `page` muito grande estoura o inteiro e vira 500

- **Local:** `backend/src/Domain/Card/Gateway/CardQuery.php:60` e `:72-75`
- **Evidência:**

  ```php
  // linha 60, dentro de create()
  page: max(1, (int) ($page ?? 1)),   // sem teto superior

  // linhas 72-75
  public function offset(): int
  {
      return ($this->page - 1) * $this->perPage;
  }
  ```

  Verificado no contêiner:

  ```
  $ php -r '… CardQuery::create(page: "99999999999999999999"); $q->offset();'
  page=int(9223372036854775807)
  PHP Fatal error: Uncaught TypeError: CardQuery::offset(): Return value must be of type
  int, float returned in …/CardQuery.php:74
  ```

- **Problema:** `(int) "99999999999999999999"` satura em `PHP_INT_MAX`; a multiplicação
  seguinte transborda para `float`, e o tipo de retorno `: int` sob `strict_types=1` lança
  `TypeError`. `perPage` tem teto (`min(self::MAX_PAGE_SIZE, …)`) e `sort` tem allowlist —
  `page` é o único dos três parâmetros normalizados que ficou sem limite superior, o que
  contradiz o próprio cabeçalho da classe: *"Existe para que o repositório receba valores em
  que possa confiar"*.
- **Impacto:** `500` em vez do `200` com lista vazia que o contrato descreve para `page`
  além do fim (`docs/api-contract.md` §5, "`page` | inteiro ≥ 1"). Mesma poluição de log do
  A-1, porém por um caminho bem menos provável — exige um valor de ~19 dígitos, o que na
  prática só aparece em fuzzing. É por isso que fica em MÉDIO e não acompanha o A-1.
- **Correção:** dar a `page` o mesmo tratamento que `perPage` já tem — um teto.

  **Antes:**
  ```php
  page: max(1, (int) ($page ?? 1)),
  ```
  **Depois:**
  ```php
  // Teto pelo mesmo motivo do teto de perPage: valor absurdo é truncado, não
  // recusado. Sem ele, (page - 1) * perPage transborda para float e o retorno
  // int de offset() lança TypeError — um 500 vindo da query string.
  page: min(self::MAX_PAGE, max(1, (int) ($page ?? 1))),
  ```
  ```php
  /** Bem além de qualquer catálogo real, e longe do estouro de inteiro. */
  public const MAX_PAGE = 1_000_000;
  ```

  O teste vive em camada sob TDD estrito (`CardQuery` é domínio):
  `testTruncaPaginaAbsurdaEmVezDeEstourar`.

### M-2 · Três casos de uso lançam `\RuntimeException` cru em vez de erro de `Domain/Errors/`

- **Local:** `backend/src/UseCases/Card/CreateCardUseCase.php:86`,
  `backend/src/UseCases/Card/UpdateCardUseCase.php:101`,
  `backend/src/UseCases/Card/RestoreCardUseCase.php:67`
- **Evidência:**

  ```php
  // CreateCardUseCase.php:83-89
  $saved = $this->cards->findById($id);

  if ($saved === null) {
      throw new \RuntimeException('A carta recém-criada não foi encontrada.');
  }
  ```

- **Problema:** `PADROES.md` §17.1 pede que "erros lançados são subclasses de domínio, com
  mensagem em português". Aqui a mensagem está em português mas a classe não é de domínio,
  e a hierarquia de erro é justamente a peça que o ADR-002 manteve **integral**.

  Vale registrar o que está certo: o efeito prático é aceitável — o `ErrorHandler` trata
  qualquer `Throwable` não-`DomainError` como `500` com mensagem genérica e log completo,
  que é exatamente o desfecho desejado para uma invariante violada. O achado é de
  conformidade, não de comportamento.
- **Impacto:** três exceções fora da hierarquia. Baixo hoje; a dívida é que, se alguém
  amanhã escrever um `catch (DomainError)` em volta, esses três casos escapam do tratamento
  sem que a diferença fique visível na leitura.
- **Correção:** um erro de domínio nomeado para "invariante interna violada", que já nasce
  com `status()` = `500` e mensagem genérica ao cliente.

  **Antes:**
  ```php
  throw new \RuntimeException('A carta recém-criada não foi encontrada.');
  ```
  **Depois:**
  ```php
  // Domain/Errors/InvariantError.php
  final class InvariantError extends DomainError
  {
      public function status(): HttpStatus
      {
          return HttpStatus::INTERNAL_SERVER_ERROR;
      }
  }
  ```
  ```php
  throw new InvariantError('Não foi possível concluir a operação. Tente novamente.');
  ```
  A mensagem técnica ("a carta recém-criada não foi encontrada") passa a viver no log, não
  no `getMessage()` que o `ErrorHandler` devolveria ao cliente para um `DomainError`.

### M-3 · `SaveCatalogItemInput` tem dois campos mortos, e a atualização de catálogo não usa DTO de entrada

- **Local:** `backend/src/UseCases/Catalog/SaveCatalogItemInput.php:16-24` e
  `backend/src/UseCases/Catalog/UpdateCatalogItemUseCase.php:33`
- **Evidência:**

  ```php
  // SaveCatalogItemInput.php:16-24
  public function __construct(
      public readonly string $gameSlug,
      public readonly string $name,
      public readonly ?string $code = null,
      public readonly int $sortOrder = 0,
      public readonly bool $active = true,   // nunca lido
      public readonly ?int $itemId = null,   // nunca lido
  ) {
  }
  ```
  ```php
  // UpdateCatalogItemUseCase.php:33 — quatro parâmetros soltos, sem DTO
  public function execute(int $itemId, string $name, int $sortOrder, bool $active): void
  ```

  `grep -rn "SaveCatalogItemInput"` devolve exatamente dois usos: a declaração e
  `CreateCatalogItemUseCase::execute`. Nem `active` nem `itemId` são lidos em lugar nenhum
  — e são precisamente os dois campos que existiriam para a atualização.

- **Problema:** duas coisas na mesma linha de código. (1) Campos mortos num DTO — o leitor
  seguinte assume que `active` faz algo na criação, e não faz. (2) `PADROES.md` §2.2 exige
  `Input`/`Output` DTO explícitos no caso de uso, e o ADR-002 marca essa anatomia como
  **mantida integral** ("custa ~10 linhas por caso de uso e elimina mass assignment por
  construção"). O `UpdateCatalogItemUseCase` é o único caso de uso com mais de um parâmetro
  que passa ao largo dela — e o DTO que ele deveria usar já existe, com os campos certos,
  ao lado.
- **Impacto:** inconsistência de anatomia entre casos de uso irmãos, e dois campos que
  prometem comportamento que não têm. Nenhum risco de segurança: a rota continua
  desestruturando o corpo campo a campo.
- **Correção:** usar o DTO que já existe.

  **Antes** (`UpdateCatalogItemRoute.php:43-50`):
  ```php
  $this->useCase->execute(
      itemId: (int) $request->param('id'),
      name: is_string($request->body('name')) ? $request->body('name') : '',
      sortOrder: is_int($request->body('sortOrder')) ? $request->body('sortOrder') : 0,
      active: $request->body('active') !== false,
  );
  ```
  **Depois:**
  ```php
  $this->useCase->execute(new SaveCatalogItemInput(
      gameSlug: '',                       // não usado na atualização — ver nota abaixo
      name: is_string($request->body('name')) ? $request->body('name') : '',
      sortOrder: is_int($request->body('sortOrder')) ? $request->body('sortOrder') : 0,
      active: $request->body('active') !== false,
      itemId: (int) $request->param('id'),
  ));
  ```
  Se o `gameSlug` vazio incomodar — e deve —, a alternativa mais limpa é separar em
  `CreateCatalogItemInput` e `UpdateCatalogItemInput`, cada um com só os campos que usa.
  Nesse caso `SaveCatalogItemInput` perde `active` e `itemId`, e o achado se fecha pelos
  dois lados.

### M-4 · As duas políticas de CSP divergiram: `data:` em `img-src` no PHP, ausente no Apache

- **Local:** `backend/src/Infra/Http/Middleware/SecurityHeaders.php:27-37` e
  `docker/app/apache.conf:33`
- **Evidência:**

  ```php
  // SecurityHeaders.php:19-30 — o comentário e a política
  /**
   * A política é restritiva por padrão. `img-src` aceita https externo porque
   * carta pode ter imagem informada por URL (RF-31) — é a única concessão.
   */
  private const CONTENT_SECURITY_POLICY =
      "default-src 'self'; "
      . "img-src 'self' https: data:; "   // <- data: também está aqui
  ```
  ```apache
  # apache.conf:23-33 — a política do documento, revista no Épico 10
  #   Não aceita `data:`: `isSafeUrl` já recusa esse esquema na borda, e deixá-lo
  #   aberto reabriria por baixo o que a borda fecha.
  Define CSP_COMUM "img-src 'self' https: blob:; …"
  ```

- **Problema:** o Épico 10 endureceu a política do documento e escreveu por que `data:`
  fica de fora — mas a política da API manteve `data:`. Além da divergência, o comentário do
  PHP afirma que o `https:` é "a única concessão" enquanto a constante logo abaixo concede
  duas. Comentário que descreve algo diferente do código é pior que comentário nenhum
  (`PADROES.md` §8.3).
- **Impacto:** pequeno na prática — a política que o navegador consulta para decidir o que
  executar é a do **documento**, servida pelo Apache; a do PHP acompanha respostas de API,
  que o navegador só trata como documento se alguém navegar direto para `/api/media/{ref}`.
  O risco real é de manutenção: duas políticas que se apresentam como equivalentes e não
  são, e a próxima revisão de CSP vai mexer numa e esquecer a outra.
- **Correção:** alinhar `img-src` e corrigir o comentário.

  **Antes:**
  ```php
  . "img-src 'self' https: data:; "
  ```
  **Depois:**
  ```php
  // Alinhado com a política do documento (docker/app/apache.conf): `https:`
  // porque carta pode ter imagem por URL (RF-31), e nada além disso. `data:`
  // saiu no Épico 10 — a borda já recusa o esquema, e mantê-lo aqui reabriria
  // por baixo o que ela fecha.
  . "img-src 'self' https:; "
  ```
  E o `@` do docblock passa a dizer "é a única concessão" com verdade. O
  `SecurityHeadersTest.php` já existe e deve receber a asserção correspondente.

### M-5 · Duas regras de senha escrevem na mesma chave, e a segunda apaga a primeira

- **Local:** `backend/src/UseCases/Auth/ChangePasswordUseCase.php:67-84`
- **Evidência:**

  ```php
  private function validate(ChangePasswordInput $input): void
  {
      $errors = [];

      if (mb_strlen($input->newPassword) < self::MIN_LENGTH) {
          $errors['newPassword'] = 'A nova senha precisa ter pelo menos 8 caracteres.';
      }

      if ($input->newPassword === $input->currentPassword) {
          $errors['newPassword'] = 'A nova senha precisa ser diferente da atual.';  // sobrescreve
      }

      if ($errors !== []) {
          throw ValidationError::fields($errors);
      }
  }
  ```

- **Problema:** o mapa é indexado por campo, então a segunda regra sobrescreve a mensagem da
  primeira. Quem repetir a senha atual **e** ela tiver menos de 8 caracteres recebe apenas
  "precisa ser diferente da atual"; corrige, envia de novo, e só então descobre o limite de
  tamanho. É o oposto do princípio que o `CardValidation` documenta com todas as letras:
  *"o objetivo é juntar os erros de todos os campos independentes antes de responder, para
  que o usuário corrija o formulário de uma vez em vez de descobrir um problema por
  tentativa"*.
- **Impacto:** uma ida e volta extra ao servidor num formulário de três campos. Sem impacto
  de segurança — a requisição é recusada nos dois casos.
- **Correção:** concatenar em vez de sobrescrever, ou — mais simples e mais legível — parar
  na primeira falha, já que as duas mensagens tratam do mesmo campo.

  **Depois:**
  ```php
  if (mb_strlen($input->newPassword) < self::MIN_LENGTH) {
      throw ValidationError::field(
          'newPassword',
          'A nova senha precisa ter pelo menos ' . self::MIN_LENGTH . ' caracteres.'
      );
  }

  if ($input->newPassword === $input->currentPassword) {
      throw ValidationError::field('newPassword', 'A nova senha precisa ser diferente da atual.');
  }
  ```
  `ChangePasswordUseCaseTest` está sob TDD estrito e já cobre as duas regras isoladas;
  falta `testSenhaCurtaEIgualAAtualRelataOTamanho`.

### M-6 · Arquivo acima do teto do PHP responde "Nenhum arquivo foi enviado" em vez do limite de tamanho

- **Local:** `backend/src/Infra/Http/Request.php:117-136` e
  `backend/src/Infra/Http/Routes/Card/UploadCardImageRoute.php:49-51`
- **Evidência:**

  ```php
  // Request.php:121-123
  if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
      return null;   // UPLOAD_ERR_INI_SIZE cai aqui, junto com "não enviou nada"
  }
  ```
  ```php
  // UploadCardImageRoute.php:49-51
  $image = $this->upload->resolve([
      'contents' => $request->uploadedFileContents(self::FIELD) ?? '',
  ]);
  ```

  Exercitado de ponta a ponta contra o contêiner, autenticado como `editor@oraculo.local`
  (`docker/app/php.ini`: `upload_max_filesize = 4M`; `UPLOAD_MAX_BYTES = 3145728`):

  ```
  arquivo de 3,5 MB → 413  {"message":"A imagem precisa ter no máximo 3 MB."}      correto
  arquivo de 5,0 MB → 400  {"errors":{"image":"Nenhum arquivo foi enviado."}}      errado
  ```

- **Problema:** `UPLOAD_ERR_INI_SIZE` (o PHP recusou por tamanho) é achatado no mesmo `null`
  de `UPLOAD_ERR_NO_FILE` (o usuário não anexou nada). Quem arrasta uma foto de 5 MB — que é
  o tamanho de qualquer foto de celular — lê que não enviou arquivo nenhum. A mensagem é
  em português e não expõe interno, mas **é falsa**, e `PADROES.md` §4.1 pede que o texto
  ao usuário diga o que aconteceu e o que fazer.
- **Impacto:** o usuário não descobre que o problema é o tamanho e não tem o que corrigir.
  A faixa entre 3 MB e 4 MB responde certo, o que torna o defeito intermitente aos olhos de
  quem usa — pior de diagnosticar do que se falhasse sempre.
- **Correção:** distinguir os códigos de erro do PHP na borda que os lê.

  **Antes** (`Request.php:117-136`), assinatura `uploadedFileContents(string $field): ?string`.

  **Depois:**
  ```php
  /**
   * Distingue "não anexou" de "o PHP recusou por tamanho".
   *
   * UPLOAD_ERR_INI_SIZE e UPLOAD_ERR_FORM_SIZE significam que o arquivo veio e
   * era grande demais para o teto do servidor — que fica ACIMA de
   * UPLOAD_MAX_BYTES de propósito, para que o limite da aplicação seja o que
   * fala com o usuário. Achatar os dois no mesmo null faz quem enviou 5 MB ler
   * "nenhum arquivo foi enviado".
   */
  public function uploadedFileContents(string $field): ?string
  {
      $file = $_FILES[$field] ?? null;

      if (!is_array($file)) {
          return null;
      }

      $error = $file['error'] ?? UPLOAD_ERR_NO_FILE;

      if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
          throw new PayloadTooLargeError('A imagem enviada é grande demais.');
      }

      if ($error !== UPLOAD_ERR_OK) {
          return null;
      }
      // … resto igual
  }
  ```
  O `PayloadTooLargeError` já existe em `Domain/Errors/` e já mapeia para `413` — o status
  continua vindo da classe lançada, sem tocar no `ErrorHandler`.

  Alternativa complementar, mais barata: subir `post_max_size`/`upload_max_filesize` bem
  acima do limite de aplicação (ex.: `16M`) para que a recusa por tamanho seja **sempre** a
  da aplicação. As duas juntas são o ideal — a segunda estreita a janela, a primeira fecha.

### M-7 · `docs/ENGENHARIA.md` §2 está desatualizado em dois pontos, e um deles quebra o boot

- **Local:** `docs/ENGENHARIA.md:40` e `docs/ENGENHARIA.md:46-47`
- **Evidência:**

  ```markdown
  | `docker compose exec app php backend/bin/validate.php` | Cadeia completa: conflitos →
  `php -l` → fronteiras → testes. É o que roda no hook de pré-push. |

  Variáveis obrigatórias (`.env`, **fora** do document root): `DB_HOST`, `DB_NAME`,
  `DB_USER`, `DB_PASS`, `APP_ENV`, `APP_URL`, `SESSION_TTL_SECONDS`, `UPLOAD_MAX_BYTES`.
  ```

  Mas o código exige uma nona variável:

  ```php
  // Connection.php:23-32
  return self::$pdo ??= new \PDO(
      self::dsn(
          host: Env::required('DB_HOST'),
          port: Env::requiredInt('DB_PORT'),   // <- não está na lista da §2
          database: Env::required('DB_NAME'),
      ),
  ```

  E a cadeia do `validate.php` tem **cinco** passos, não quatro:

  ```php
  // validate.php:123-129 — o passo 4, ausente da tabela
  $steps[] = ['placeholders de SQL', static function () use ($binDirectory): bool {
      passthru('php ' . escapeshellarg($binDirectory . '/check-sql-placeholders.php'), $status);
      return $status === 0;
  }];
  ```

- **Problema:** o próprio cabeçalho do `ENGENHARIA.md` diz que ele **é normativo, não
  descritivo**, e que "quando o código divergir daqui, um dos dois está errado". Aqui o
  errado é o documento, nos dois pontos. `.env.example` e `docker-compose.yml` trazem
  `DB_PORT` corretamente — só a §2 não.
- **Impacto:** quem montar o `.env` a partir da lista da §2 — que é exatamente o que o
  documento pede que se faça — sobe a aplicação e recebe `EnvironmentError: DB_PORT`. O
  passo omitido do `validate.php` é menos grave, mas subestima o portão: o
  `check-sql-placeholders.php` é o verificador que nasceu de dois defeitos reais no mesmo
  dia, e não aparece na única tabela que descreve a cadeia.
- **Correção:**

  ```diff
  -| `docker compose exec app php backend/bin/validate.php` | Cadeia completa: conflitos → `php -l` → fronteiras → testes. É o que roda no hook de pré-push. |
  +| `docker compose exec app php backend/bin/validate.php` | Cadeia completa: conflitos → `php -l` → fronteiras → placeholders de SQL → testes. É o que roda no hook de pré-push. |

  -Variáveis obrigatórias (`.env`, **fora** do document root): `DB_HOST`, `DB_NAME`,
  -`DB_USER`, `DB_PASS`, `APP_ENV`, `APP_URL`, `SESSION_TTL_SECONDS`, `UPLOAD_MAX_BYTES`.
  +Variáveis obrigatórias (`.env`, **fora** do document root): `DB_HOST`, `DB_PORT`,
  +`DB_NAME`, `DB_USER`, `DB_PASS`, `APP_ENV`, `APP_URL`, `SESSION_TTL_SECONDS`,
  +`UPLOAD_MAX_BYTES`.
  ```

---

## BAIXO

### B-1 · `catch` que só relança

`backend/src/Domain/Card/Validation/Step/ImageIsValid.php:46-50`

```php
} catch (DomainError $error) {
    // Tamanho excedido e tipo não permitido não são ValidationError: …
    throw $error;
}
```

Como `ValidationError extends DomainError` e o `catch` anterior já o captura, este bloco é
funcionalmente idêntico a não existir. A explicação é boa e vale ficar — como parágrafo do
docblock do método, não como ramo de código que não faz nada.

### B-2 · Docblock promete uma contagem que o método não devolve

`backend/src/UseCases/Catalog/DeactivateCatalogItemUseCase.php:26-28`

> "O que a operação devolve é **quantas cartas** usam o item, para que a interface possa
> dizer 'esta edição é usada por **12 cartas**; elas continuam como estão'."

O método devolve `bool` (`isInUse`), não um número — e a anotação `@return bool` logo abaixo
está certa. A interface não consegue montar a frase do exemplo. Corrigir o texto para "se o
item está em uso", como o comentário da rota (`DeactivateCatalogItemRoute.php:20-21`) já diz
corretamente.

### B-3 · Comentário do Apache descreve um mecanismo que o código não usa

`docker/app/apache.conf:54-56`

```apache
# Toda a API passa pelo front controller. AcceptPathInfo entrega o restante
# do caminho em PATH_INFO, que é o que o roteador consome.
```

`Request::fromGlobals()` documenta o contrário, e com razão:

```php
// REQUEST_URI e não PATH_INFO: o caminho público é o que os documentos
// de contrato descrevem ('/api/cards/12'), e não depende de como o
// servidor foi configurado para chegar até o front controller.
```

Quem for mexer no `Alias` vai otimizar em cima da premissa errada.

### B-4 · Comentário do seed em tempo futuro para algo já entregue

`backend/bin/seed.php:29`

```php
/** Espelha App\Shared\Enum\PermissionLevel — o enum chega no Épico 1. */
```

O Épico 1 fechou. Trocar por "espelha `PermissionLevel`; o seed roda antes do autoload de
domínio e por isso repete os valores" — ou, melhor, usar o enum, já que
`src/autoload.php` está carregado na linha 23. (Os valores em si estão fora do escopo de
achado de valor fixo: massa de seed é intencional.)

### B-5 · O portão de pré-push existe, mas não sobrevive a um clone

`docs/ENGENHARIA.md:168` afirma:

> O `pre-push` roda `backend/bin/validate.php` no contêiner e barra o envio se a cadeia
> ficar vermelha.

O hook existe e está correto (`.git/hooks/pre-push`, verificado), mas `.git/hooks/` não é
versionado, não há `core.hooksPath` configurado, não existe diretório `.githooks/` e nenhum
documento explica como instalá-lo. Quem clonar o repositório — inclusive quem avaliar —
não tem portão nenhum. Versionar o hook em `.githooks/pre-push` e documentar
`git config core.hooksPath .githooks` fecha a lacuna em duas linhas.

### B-6 · Robustez assimétrica ao ler a trilha de auditoria

`backend/src/Infra/Repository/Card/CardAuditRepositoryPdo.php:70-78`

```php
// changes corrompido: tratado, com o motivo escrito
$changes = is_array($decoded) ? $decoded : [];
// …
action: CardAction::from((string) $row['action']),   // corrompido: ValueError -> 500
```

O comentário três linhas acima diz "histórico com JSON corrompido não pode derrubar a tela
inteira" — a mesma lógica vale para a coluna `action`. `CardAction::tryFrom()` com um
descarte da entrada ilegível mantém o resto do histórico legível.

### B-7 · `array` sem tipo declarado no construtor público de `ImageIsValid`

`backend/src/Domain/Card/Validation/Step/ImageIsValid.php:17-20`

```php
public function __construct(
    private readonly array $sources,
) {
```

Sem `@param array<string, ImageSource> $sources`. O DoD §17.1 pede DTOs e tipos explícitos,
sem `mixed`/`any` de conveniência. Como existe a fábrica `with(ImageSource, ImageSource)`
logo abaixo, o construtor também poderia ser privado — o que tornaria a única forma de
montar o elo a que já é tipada.

### B-8 · `Response::ok()` anotado como mapa, usado como lista

`backend/src/Infra/Http/Response.php:60-64` declara `@param array<string,mixed> $data`, e
`backend/src/Infra/Http/Routes/Card/CardHistoryRoute.php:46` passa uma `list<array>`. O
comportamento em tempo de execução está correto e casa com o contrato
(`{"data": [...]}`), mas a anotação não descreve os dois usos. `array<array-key,mixed>`
resolve.

---

## Convenções

Nenhum achado. Verificado item a item:

| O que foi conferido | Comando / método | Resultado |
| --- | --- | --- |
| Nome do branch (ADR-010: hífen, nunca barra) | `git branch --show-current` | `development` — branch de integração prevista |
| Idioma dos identificadores | leitura de `src/` | inglês, sem exceção |
| Idioma de comentário, teste e mensagem ao usuário | leitura de `src/` e `tests/` | português, inclusive nos nomes de teste (`testRecusaSenhaNovaIgualAAtual`) |
| Arquivo PHP em `PascalCase.php` | `find backend/src -name '*.php'` | 100% conforme |
| Constante global em `UPPER_SNAKE_CASE` | `grep -rn "const [a-z]" backend/src/` | nenhum acerto |
| `declare(strict_types=1);` no topo | varredura de `src/`, `bin/`, `public/` | 186/186 |

Os desvios de comentário e documentação encontrados estão em B-2, B-3, B-4 e M-7, e não em
nomenclatura — por isso a contagem de convenção fica em zero.

---

## Recomendações

1. **Corrigir o A-1 antes do push de entrega.** É o único achado que muda o comportamento
   observável do sistema para quem só aponta um navegador ou um `curl` — e a correção é uma
   função privada de dez linhas em `Request.php`, com dois testes em `RequestTest.php`, que
   já existe.
2. **Fechar M-1 junto com o A-1.** São o mesmo tema — entrada do cliente que não foi
   normalizada até o fim — e a auditoria seguinte fica mais barata se a classe inteira de
   defeito sair de uma vez. Depois dos dois, vale um teste de fumaça que percorra as 22
   rotas com `?x[]=1` e um `page` absurdo, verificando que nenhuma responde `500`.
3. **M-6 e M-7 têm impacto desproporcional ao esforço.** `DB_PORT` fora da lista de
   variáveis obrigatórias é o tipo de detalhe que trava quem for rodar o projeto pela
   primeira vez a partir da documentação — e é uma linha de Markdown.
4. **Versionar o hook de pré-push (B-5).** O `bin/validate.php` é a melhor peça de garantia
   deste repositório e a documentação o apresenta como portão ativo; hoje ele só existe na
   máquina de quem escreveu. É a diferença entre uma regra verificável e uma regra que
   depende de disciplina — a distinção que o próprio `validate.php` abre dizendo.
5. **Manter M-2, M-3, M-4, M-5, B-1..B-8 para depois da entrega.** Nenhum altera
   comportamento observável, e mexer em quatro arquivos na véspera compra mais risco do que
   qualidade. Entram na primeira leva pós-entrega, com o ledger atualizado.
6. **Registrar a conformidade nas notas do ledger** (`PADROES.md` §14.2). A tabela "o que
   foi verificado e está correto" deste relatório é exatamente o insumo dessa seção: guard,
   status pelo erro lançado, corpo desestruturado, SQL parametrizado e leitura limitada
   foram conferidos em toda a base e estão conformes em 09/09/2026.

---

**Base auditada:** 186 arquivos PHP em `backend/src/`, `backend/bin/` e `backend/public/`;
22 rotas; 10 migrations; `docker/app/` (apache.conf, php.ini, Dockerfile, entrypoint.sh);
`docker-compose.yml`; `.env.example`.
**Portão automatizado:** `validate.php` verde — 217 testes, 0 falhas, 2469 ms.

HIGH_ONLY
