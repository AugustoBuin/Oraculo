# Oráculo — Relatório de Auditoria de Segurança (SAST)

**Data:** 09/09/2026 | **Branch:** `development` | **Commit:** `88f76ce` | **Escopo:** `full`
**Auditor:** security-auditor
**Método:** análise estática + revisão arquitetural. Nenhum código executado ou alterado.
**Ocasião:** auditoria de fechamento da entrega (F-051), agendada em
`docs/audits/open-findings.md` como "09/09, antes da entrega — `CRITICAL` bloqueia".

> **Ledger e métrica.** Esta execução **não** escreveu em `docs/audits/open-findings.md`
> nem em `docs/audits/audit-metrics.jsonl`. Três auditorias rodaram hoje e a consolidação
> do ledger é serial, feita por quem conduziu a entrega: escrita concorrente perderia linha
> e dois auditores simultâneos escolheriam o mesmo `OF-NNN`. O ledger foi **lido** como
> entrada obrigatória. As linhas de ledger e a linha de métrica foram devolvidas na resposta
> da invocação, sem `OF-NNN` atribuído.

> **Limite desta execução — leia antes de confiar em qualquer afirmação sobre a CSP.**
> A extensão do Chrome **não estava conectada** nesta sessão. **Nada foi verificado no
> navegador:** nenhum cabeçalho de resposta observado, nenhuma tela carregada, nenhum
> console lido, nenhuma requisição emitida. Tudo o que este relatório afirma sobre a
> Content-Security-Policy vem da **leitura de `docker/app/apache.conf` e de
> `SecurityHeaders.php`**, mais a conferência aritmética dos hashes `sha256` contra os
> bytes dos arquivos HTML — não de tráfego observado. Onde a diferença importa, o item está
> na seção "Requer verificação dinâmica".

---

## Sumário executivo

**Nenhum achado `CRITICAL` e nenhum `HIGH`. A entrega não está bloqueada por esta auditoria.**

A postura de segurança deste repositório é, para o tamanho que ele tem, incomum: as duas
falhas que mais aparecem em auditoria de portal administrativo — rota que nasce sem
verificação de permissão e identidade lida do corpo da requisição — **não existem aqui, e
não existem por construção, não por disciplina**. As 22 rotas registradas pelos três
`*Module.php` foram cruzadas uma a uma com `docs/api-contract.md` §9: as 22 aparecem nos
dois lados, com o **mesmo nível mínimo em todas**, e a única rota pública
(`POST /api/auth/login`) traz o comentário de justificativa que o padrão exige
(`AuthModule.php:62-64`). O `Guard` envolve a rota no composition root em vez de checar
dentro dela, o que torna uma rota desprotegida visível na leitura de quinze linhas; e o
`Request` **não tem** um getter de corpo inteiro, o que faz da atribuição em massa um erro
que não se consegue cometer sem antes alterar a classe (`Request.php:12-21`). O SQL é
integralmente parametrizado, inclusive nos dois pontos onde normalmente sobrevive um
defeito: o `ORDER BY` sai de uma allowlist fechada (`CardQuery.php:27-31`) e `LIMIT`/`OFFSET`
são interpolados a partir de inteiros já normalizados dentro de faixas fixas, nunca de texto
do cliente.

**O que um atacante externo, sem sessão, consegue hoje.** Consegue três coisas, todas de
alcance limitado. Pode tentar autenticar-se, sujeito a um teto de cinco tentativas por
quinze minutos — teto que ele **evade rodando o ataque a partir de vários endereços IP**,
porque a chave da janela inclui o IP (achado M-2). Pode derrubar qualquer rota `/api/*` com
`500` acrescentando `?x[]=1` na URL, sem credencial nenhuma, e cada requisição dessas grava
no log uma linha com a pilha completa — o que é uma torneira de inundação de log aberta a
qualquer um e um apagador do rastro de auditoria (achado M-1). E, se estiver na mesma rede
local da máquina que rodou `docker compose up`, alcança o portal em `:8080` com as
credenciais de demonstração publicadas no README, porque o compose entregue fixa
`APP_ENV=local` e publica a porta em todas as interfaces (achado M-3). O que ele **não**
consegue: ler ou escrever carta, catálogo, usuário ou sessão; não há uma única rota de dado
acessível sem sessão válida.

**O que um usuário autenticado de nível `VIEWER` consegue.** Consegue exatamente o que o
ADR-006 diz que ele deve conseguir, e nada além. Listar e ver cartas, ler o catálogo ativo
para alimentar a cascata, buscar a própria sessão e trocar a própria senha — o "própria"
garantido estruturalmente, porque o `userId` vem de `Guard::USER_ATTRIBUTE` e o corpo só
carrega as duas senhas (`ChangePasswordRoute.php:52-61`). Não alcança nenhuma escrita de
carta, nenhuma escrita de catálogo, nem o histórico. A tentação clássica desta versão —
`GET /api/games/{gameId}/editions?incluirInativos=1` — foi fechada no lugar certo: o
parâmetro é lido na rota como pedido, mas quem o honra é o caso de uso, comparando o nível
que veio **da sessão** (`ListEditionsUseCase.php:63`). Um `VIEWER` que acrescente o
parâmetro na barra do navegador recebe a lista de ativos, sem erro e sem vazamento.

Os três achados `MEDIUM` não são falhas de arquitetura; são três arestas de borda. Um é uma
suposição de tipo sobre `$_GET` que explode antes do pipeline; outro é a dimensão IP da
chave do limitador de tentativas; o terceiro é a configuração de entrega do `docker-compose`
combinada com credenciais que o ADR-006 decidiu publicar de propósito. Os dois `LOW` são
endurecimento de plataforma: a linha de base de cabeçalhos está declarada em apenas um dos
três blocos `<Directory>` do Apache, e o `php.ini` não desliga a inclusão de argumentos nas
pilhas registradas em log.

| Severidade | Qtd. | Faixa CVSS |
|---|---|---|
| Critical | 0 | 9,0–10,0 |
| High     | 0 | 7,0–8,9  |
| Medium   | 3 | 4,0–6,9  |
| Low      | 2 | 0,1–3,9  |

Além disso, **5 observações de endurecimento** sem pontuação CVSS (nenhuma propriedade de
segurança é violada), registradas em seção própria para não inflar a contagem.

---

## Mapa da superfície de ataque

Levantado por leitura direta dos três composition roots — `AuthModule.php`,
`CatalogModule.php` e `CardModule.php` — cruzando cada `::create(` de rota com o
`Guard::protect(` que a envolve, e cada par com `docs/api-contract.md` §9.
**Sem amostragem: as 22 rotas do sistema estão abaixo.**

| Método | Caminho | Protegida | Nível mínimo | Observação |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | **não** | — (pública) | Única pública. Justificada em `AuthModule.php:62-64`: é a rota que cria a sessão. Única isenta de CSRF (`index.php:104`). Único ponto com limite de tentativas. |
| `GET` | `/api/auth/session` | sim | `VIEWER` | `AuthModule.php:66`. Responder `401` aqui é caminho normal, não erro (ADR-007). Devolve o token CSRF ao recarregar a página. |
| `DELETE` | `/api/auth/session` | sim | `VIEWER` | `AuthModule.php:67`. Logout apaga a linha no servidor (`EndSessionUseCase.php:33`), não só o cookie. |
| `PUT` | `/api/auth/password` | sim | `VIEWER` | `AuthModule.php:71`. `VIEWER` e não `ADMIN` porque o alvo é sempre o próprio usuário — `userId` vem da sessão. |
| `GET` | `/api/cards` | sim | `VIEWER` | `CardModule.php:99`. Paginada, com allowlist de ordenação. |
| `POST` | `/api/cards` | sim | `EDITOR` | `CardModule.php:104`. `authorId` da sessão (`CreateCardRoute.php:48`). |
| `GET` | `/api/cards/{id}` | sim | `VIEWER` | `CardModule.php:100`. |
| `PUT` | `/api/cards/{id}` | sim | `EDITOR` | `CardModule.php:105`. `cardId` do caminho, nunca do corpo (`UpdateCardRoute.php:48-50`). |
| `DELETE` | `/api/cards/{id}` | sim | `EDITOR` | `CardModule.php:106`. Exclusão lógica. Inalcançável em `VIEWER`. |
| `POST` | `/api/cards/{id}/restore` | sim | `EDITOR` | `CardModule.php:107`. |
| `GET` | `/api/cards/{id}/history` | sim | `EDITOR` | `CardModule.php:108`. Mais restrito que a leitura da própria carta — correto: expõe id e nome de usuário. |
| `POST` | `/api/uploads/card-image` | sim | `EDITOR` | `CardModule.php:109`. Único ponto que recebe bytes. |
| `GET` | `/api/media/{reference}` | sim | `VIEWER` | `CardModule.php:101`. Imagem enviada **exige sessão**; não há mídia anônima. |
| `GET` | `/api/games` | sim | `VIEWER` | `CatalogModule.php:54-57`. |
| `GET` | `/api/games/{gameId}/editions` | sim | `VIEWER` | `CatalogModule.php:58-61`. `incluirInativos` honrado só para `ADMIN`, decidido no caso de uso. |
| `POST` | `/api/games/{gameId}/editions` | sim | `ADMIN` | `CatalogModule.php:90-96` via `writeRoutes('editions', …)`. |
| `PUT` | `/api/editions/{id}` | sim | `ADMIN` | `CatalogModule.php:97-103`. |
| `DELETE` | `/api/editions/{id}` | sim | `ADMIN` | `CatalogModule.php:104-110`. Desativação, não exclusão física. |
| `GET` | `/api/games/{gameId}/rarities` | sim | `VIEWER` | `CatalogModule.php:62-65`. Mesma regra de `incluirInativos`. |
| `POST` | `/api/games/{gameId}/rarities` | sim | `ADMIN` | `CatalogModule.php:90-96` via `writeRoutes('rarities', …)`. |
| `PUT` | `/api/rarities/{id}` | sim | `ADMIN` | `CatalogModule.php:97-103`. |
| `DELETE` | `/api/rarities/{id}` | sim | `ADMIN` | `CatalogModule.php:104-110`. |

**22 rotas. 21 protegidas, 1 pública e justificada. Divergência com `api-contract.md` §9:
nenhuma** — nem de caminho, nem de método, nem de nível.

### Adequação dos níveis (ADR-006: `ADMIN` > `EDITOR` > `VIEWER`)

As três perguntas que a auditoria faz mesmo quando o guard está presente, respondidas:

- **Escrita alcançável em `VIEWER`?** Não. As nove escritas do sistema estão em `EDITOR`
  (cartas e upload) ou `ADMIN` (catálogo). A única operação de escrita em `VIEWER` é a troca
  da **própria** senha, cujo alvo não é escolhível pelo cliente.
- **Catálogo alcançável em `EDITOR`?** Não para escrita. As seis escritas de catálogo estão
  em `ADMIN`. As três leituras estão em `VIEWER` porque a cascata Jogo → Edição → Raridade
  é o motor da tela de consulta — e leitura de catálogo ativo não é informação sensível.
- **Exclusão alcançável abaixo de `EDITOR`?** Não. `DELETE /api/cards/{id}` exige `EDITOR`;
  as desativações de catálogo exigem `ADMIN`.

### O portão que mantém isto assim

`backend/bin/routes.php` monta os três módulos de verdade e imprime método, caminho e nível
lendo `Guard::minimumLevel()`. As linhas 91-95 fazem o comando **sair com código 1 se
aparecer uma segunda rota pública**. É o único mecanismo do repositório que transforma
"esqueceram o guard" em falha visível em vez de descoberta por auditoria — e ele funciona
porque `Guard` é um `Route` que delega `method()` e `path()`, então uma rota sem guard é
distinguível de uma com guard por `instanceof`.

---

## Achados

Ordenados `Critical` → `High` → `Medium` → `Low`.

### Critical

Nenhum.

### High

Nenhum.

---

### M-1 — Parâmetro de consulta ou cookie em forma de array derruba qualquer rota `/api/*` antes da autenticação, gravando pilha completa no log a cada requisição

- **Severidade:** Medium — **CVSS v3.1:** 6,5 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L`)
- **CWE:** CWE-779 (registro de dado excessivo em log), com CWE-248 (exceção não capturada)
  como mecanismo e CWE-693 (falha de mecanismo de proteção) como agravante
- **OWASP:** A09:2021 — Security Logging and Monitoring Failures
- **Local:** `backend/src/Infra/Http/Request.php:89` e `backend/src/Infra/Http/Request.php:91`;
  agravante em `backend/public/index.php:107-113` e `backend/src/Infra/Http/ErrorHandler.php:68-73`

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
      body: [],
      routeParams: [],
      attributes: [],
      server: $_SERVER,
  );
  ```

  O ponto de chamada, que é o que determina o alcance da falha:

  ```php
  // public/index.php:107-113
  $response = $pipeline->process(
      Request::fromGlobals(),                          // avaliado ANTES de process()
      static fn(Request $request): Response => $router->dispatch($request)
  );
  } catch (\Throwable $error) {
      // Rede de proteção para o que falha antes de o pipeline existir …
      $response = $errorHandler->toResponse($error);   // sem SecurityHeaders
  }
  ```

  E a linha que sai no log:

  ```php
  // ErrorHandler.php:68-73
  $this->logger->error('Falha não tratada', [
      'exception' => $error::class,
      'message' => $error->getMessage(),
      'origin' => $error->getFile() . ':' . $error->getLine(),
      'trace' => $error->getTraceAsString(),
  ]);
  ```

- **Vetor de ataque:** o atacante não precisa de sessão, de token CSRF, nem de conhecer o
  sistema. Envia, em laço:

  ```
  GET /api/cards?a[]=1 HTTP/1.1
  Host: alvo:8080
  ```

  `$_GET['a']` é um array; `strval()` sobre array emite o warning
  `Array to string conversion`; o `set_error_handler` de `index.php:46-52` o converte em
  `ErrorException` — decisão correta e deliberada, o defeito é a suposição de tipo em
  `fromGlobals()`. Como `Request::fromGlobals()` é **argumento** de
  `$pipeline->process(...)`, ele é avaliado antes de a cadeia começar: a exceção não passa
  pelo `ErrorBoundary` (que é elo do pipeline, `index.php:96`) e cai no `catch` externo. O
  resultado é `500` com mensagem genérica — e uma linha de log com `getTraceAsString()`
  inteiro. O mesmo vale para `Cookie: ORACULOSID[a]=b`, pela linha 91.

  Três propriedades tornam isto explorável de forma barata: **(a)** a requisição do atacante
  custa dezenas de bytes e a linha de log custa alguns quilobytes — é amplificação;
  **(b)** o caminho é anterior ao `SessionMiddleware` e ao `Guard`, então **todas** as 22
  rotas servem de gatilho, inclusive as protegidas; **(c)** `docker-compose.yml` não define
  `logging.options.max-size` em nenhum serviço, e `apache.conf:139-140` manda tudo para
  `/dev/stderr`, ou seja o log vai para o driver `json-file` do Docker **sem rotação**.

- **Impacto no negócio:** o dano não é a resposta `500` — é o log. Num portal de catálogo
  com três níveis de acesso, o log de contêiner é o **único** registro de quem tentou
  autenticar-se e quando (`AuthenticateUserUseCase.php:83-86` grava
  `Tentativa de autenticação recusada` com e-mail e IP; `:105-108` grava `Sessão aberta`).
  Um atacante que inunde o log com milhares de `Falha não tratada` afoga exatamente as
  linhas que permitiriam detectar o ataque de força bruta descrito em M-2 — e o faz sem
  autenticar-se, sem deixar rastro distinguível e sem tocar em nenhum dado. Em segundo
  plano, o crescimento sem rotação leva ao esgotamento de disco do hospedeiro, e com
  `restart: unless-stopped` os dois contêineres reiniciam em laço.

  Há ainda um efeito de segunda ordem que vale registrar mesmo sendo pouco explorável: a
  resposta produzida pelo `catch` externo **não passa pelo `SecurityHeaders`**, porque esse
  middleware é o primeiro elo do pipeline que nunca chegou a rodar. O `500` sai sem CSP, sem
  `X-Content-Type-Options`, sem `X-Frame-Options` e sem `Referrer-Policy` — e o bloco
  `<Directory /var/www/backend/public>` do `apache.conf` (linhas 59-63) também não declara
  nenhum. Como o corpo é a constante `{"message":"Erro interno. Tente novamente."}`, sem
  nenhum byte controlado pelo atacante, **não há vetor de XSS ou de sniffing aqui hoje**;
  o que existe é a quebra da promessa do `api-contract.md` §7 ("aplicados a **todas** as
  respostas") e do comentário de `ErrorBoundary.php:14-18`, e o risco de que uma resposta
  futura nesse caminho passe a carregar conteúdo variável.

- **Mitigação:** normalizar na origem, em `Request.php`, mantendo o contrato
  `array<string,string>` que o PHPDoc da linha 25 declara. Trocar as linhas 89 e 91 por uma
  função privada que descarta — ou achata — o valor não escalar, em vez de convertê-lo:

  ```php
  // Request.php — substitui array_map('strval', …) nas linhas 89 e 91
  query: self::scalarStrings($_GET),
  cookies: self::scalarStrings($_COOKIE),

  /**
   * $_GET e $_COOKIE não são array<string,string>: `?page[]=1` produz um valor
   * aninhado, e strval() sobre ele emite warning — que o front controller converte
   * em ErrorException, antes do pipeline e portanto sem autenticação.
   *
   * @param array<array-key,mixed> $source
   * @return array<string,string>
   */
  private static function scalarStrings(array $source): array
  {
      $normalized = [];

      foreach ($source as $key => $value) {
          if (is_string($key) && (is_scalar($value) || $value === null)) {
              $normalized[$key] = (string) $value;
          }
      }

      return $normalized;
  }
  ```

  Com isso `?page[]=1` passa a responder como se `page` não tivesse sido enviado, e
  `GET /api/cards?a[]=1` volta a `401` sem sessão — que é a resposta correta.

  Dois passos operacionais que **não** dependem da correção acima e que valem por si:

  1. Em `docker-compose.yml`, definir rotação nos dois serviços, para que nenhum defeito
     futuro do mesmo tipo consiga encher o disco:
     `logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }`.
  2. Mover a construção da requisição para **dentro** do escopo protegido pelo
     `ErrorBoundary`, de modo que uma falha na montagem também receba os cabeçalhos de
     segurança. Concretamente: passar um `callable` que constrói a `Request` em vez do
     objeto já construído, ou aplicar os cabeçalhos de base também no `catch` externo de
     `index.php`. É a diferença entre "o caminho de erro está coberto" e "o caminho de erro
     está coberto **exceto** o que falha antes do primeiro elo".

- **Nota sobre a origem deste achado.** Ele foi levantado primeiro pela auditoria de
  qualidade do backend desta mesma data
  (`docs/audits/2026-09-09-auditoria-final-qualidade-backend.md`, achado A-1), que o
  reproduziu contra o contêiner em execução e capturou a linha de log. **Esta auditoria não
  executou nada**: reavaliou o mesmo código pelo ângulo de segurança e concorda que é
  também um achado de segurança, pela amplificação de log por não autenticado e pela perda
  de rastro de auditoria. A pontuação CVSS 6,5 é atribuição desta auditoria. A divergência
  aparente de severidade — `ALTO` lá, `Medium` aqui — não é discordância: são duas réguas
  diferentes. Pela régua de qualidade, uma requisição plausível que devolve `500` numa API
  entregue é grave. Pela régua CVSS, a confidencialidade não é afetada, a integridade e a
  disponibilidade sofrem impacto parcial, e a aritmética fecha em 6,5. **É um único achado
  com duas origens** e deve ocupar **uma** linha no ledger consolidado.

---

### M-2 — O limite de tentativas de login é evadível por rotação de IP, e a política de senha é de oito caracteres sem complexidade

- **Severidade:** Medium — **CVSS v3.1:** 4,8 (`CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N`)
- **CWE:** CWE-307 (restrição imprópria de tentativas de autenticação), com CWE-521
  (requisito fraco de senha)
- **OWASP:** A07:2021 — Identification and Authentication Failures
- **Local:** `backend/src/UseCases/Auth/AuthenticateUserUseCase.php:148-151` e `:36-37`;
  `backend/src/UseCases/Auth/ChangePasswordUseCase.php:27` e `:71-73`

- **Evidência:**

  ```php
  // AuthenticateUserUseCase.php:36-37
  private const MAX_ATTEMPTS = 5;
  private const WINDOW_SECONDS = 900; // 15 minutos

  // AuthenticateUserUseCase.php:148-151
  private function identifierFor(AuthenticateUserInput $input): string
  {
      return hash('sha256', strtolower(trim($input->email)) . '|' . ($input->ipAddress ?? ''));
  }
  ```

  ```php
  // ChangePasswordUseCase.php:27 e 71-73
  private const MIN_LENGTH = 8;
  …
  if (mb_strlen($input->newPassword) < self::MIN_LENGTH) {
      $errors['newPassword'] = 'A nova senha precisa ter pelo menos ' . self::MIN_LENGTH . ' caracteres.';
  }
  ```

- **Vetor de ataque:** a janela de bloqueio é indexada por `hash(email | IP)`. O IP é uma
  dimensão **sob controle do atacante**: cada endereço de origem novo abre uma janela nova e
  independente de cinco tentativas por quinze minutos para o **mesmo** e-mail. Um atacante
  com um conjunto de mil endereços — infraestrutura de custo trivial hoje — obtém cinco mil
  tentativas a cada quinze minutos contra uma única conta, e o contador nunca alcança o teto
  em nenhuma das janelas. Não existe teto por conta, nem teto global, nem atraso progressivo,
  nem qualquer sinal que faça o sistema tratar "esta conta recebeu duas mil tentativas na
  última hora" de forma diferente de "cinco pessoas erraram a senha".

  O e-mail alvo não é segredo: os três de demonstração estão no README
  (`admin@oraculo.local`, `editor@oraculo.local`, `consulta@oraculo.local`) e o mesmo padrão
  se repete no `seed.php:61-63` e `:71` para o administrador de ambiente não-local. A
  superfície de senha é de oito caracteres sem exigência de classe de caractere e sem
  conferência contra lista de senhas vazadas — e a senha de demonstração publicada,
  `oraculo123` (`seed.php:26`), está em qualquer dicionário de ataque.

  A validação de tamanho vive apenas em `ChangePasswordUseCase`. O `seed.php` não a aplica,
  e como não existe CRUD de usuários pela interface (decisão do PRD §3.2), a única senha que
  passa por essa validação é a que o próprio usuário escolhe ao trocá-la.

- **Impacto no negócio:** comprometimento de conta. O nível alcançado depende da conta
  acertada: um `VIEWER` dá leitura do catálogo inteiro; um `EDITOR` dá escrita, exclusão e
  restauração de qualquer carta, mais o histórico de auditoria; um `ADMIN` dá, além disso, a
  gestão de edições e raridades — isto é, a capacidade de desativar uma edição inteira e
  fazer sumir das opções de cadastro tudo o que depende dela. Como não existe segundo fator
  e a sessão dura doze horas com renovação automática pela metade do prazo
  (`SessionMiddleware.php:99-112`), um único acerto rende acesso persistente até que alguém
  troque a senha — o que, aí sim, revoga todas as sessões (`ChangePasswordUseCase.php:58`).

- **Justificativa da pontuação, para quem quiser discordar do número em vez de adivinhá-lo.**
  `AC:H` porque a exploração exige infraestrutura de rotação de endereço **e** que a senha
  esteja no espaço adivinhável — condição fora do controle do atacante. `C:L`/`I:L` e não
  `C:H`/`I:H` porque as defesas que existem são reais e limitam o alcance: mensagem única
  para os três casos de falha (`GENERIC_FAILURE`, linha 45), verificação de hash **também**
  quando o e-mail não existe, com o `DUMMY_HASH` da linha 43, o que fecha o oráculo de
  tempo; `password_verify` de tempo constante; bcrypt com custo 12, que impõe um custo real
  por tentativa; e o limite continua valendo **inclusive para a credencial correta**
  (linha 73, antes da verificação), o que é a decisão certa e frequentemente esquecida.
  Com `C:H/I:H` o vetor fecharia em 7,4 — **High**. Esta auditoria julga que o teto de
  impacto Low é o retrato honesto de um controle que existe e funciona, cuja chave tem uma
  dimensão fraca. Registro a alternativa por escrito para que a decisão seja auditável.

- **Mitigação:** três mudanças, em ordem de valor.

  1. **Somar uma janela por conta, independente do IP.** Manter a janela atual por
     `(e-mail, IP)`, que é a que protege contra o vizinho de NAT distraído, e acrescentar
     uma segunda por e-mail apenas, com teto mais alto e janela mais longa — por exemplo 20
     tentativas por hora. O gateway já suporta: `LoginAttemptGateway::countSince($identifier,
     $since)` é chamado com um identificador opaco, então basta gravar **duas** linhas por
     tentativa, com dois identificadores, e conferir as duas em `assertWithinAttemptLimit`.
     Nenhuma migration é necessária — `login_attempts.identifier` já é `CHAR(64)` e o índice
     `idx_attempts_window (identifier, attempted_at)` serve às duas consultas.
  2. **Elevar o piso de senha** em `ChangePasswordUseCase.php:27` de 8 para 12 caracteres e
     recusar a lista curta de senhas óbvias do domínio (`oraculo`, `oraculo123`, o nome do
     usuário, o e-mail). Doze caracteres sem exigência de classe é mais forte, e mais
     usável, do que oito com exigência de símbolo.
  3. **Registrar o estouro de janela como evento de segurança.** Hoje
     `TooManyRequestsError` sobe sem passar pelo logger; a linha `warning` só é escrita no
     caminho de credencial inválida (`:83-86`). Um `warning` explícito no estouro é o que
     torna o ataque de M-2 visível — e é também o que M-1 é capaz de afogar, razão a mais
     para corrigir os dois.

  Passo operacional: as três contas de demonstração usam a mesma senha publicada. Se
  qualquer instância deste projeto passar a existir fora da máquina do avaliador, **as três
  senhas precisam ser rotacionadas**, não apenas o README ajustado.

---

### M-3 — O `docker-compose` de entrega publica a porta em todas as interfaces com `APP_ENV=local`, o que ativa as credenciais de demonstração publicadas no README

- **Severidade:** Medium — **CVSS v3.1:** 5,4 (`CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N`)
- **CWE:** CWE-1392 (uso de credencial padrão), com CWE-668 (exposição de recurso a esfera
  indevida)
- **OWASP:** A05:2021 — Security Misconfiguration
- **Local:** `docker-compose.yml:48` e `docker-compose.yml:57-58`; credenciais em
  `backend/bin/seed.php:26` e `:60-64`; publicação em `README.md:25-40`

- **Evidência:**

  ```yaml
  # docker-compose.yml:47-58
  environment:
    APP_ENV: local
    APP_URL: http://localhost:8080
    …
  ports:
    - "8080:80"
  ```

  ```php
  // seed.php:26 e 60-64
  const DEMO_PASSWORD = 'oraculo123';
  …
  if ($isLocal) {
      $seedUser('Administrador', 'admin@oraculo.local', LEVEL_ADMIN, DEMO_PASSWORD);
      $seedUser('Editor de Catálogo', 'editor@oraculo.local', LEVEL_EDITOR, DEMO_PASSWORD);
      $seedUser('Consulta', 'consulta@oraculo.local', LEVEL_VIEWER, DEMO_PASSWORD);
  ```

- **Vetor de ataque:** a forma curta `"8080:80"` faz o Docker vincular a porta em `0.0.0.0`
  — todas as interfaces da máquina —, não em `127.0.0.1`. Quem roda `docker compose up` num
  notebook conectado a uma rede compartilhada (escritório, coworking, Wi-Fi de evento,
  hotel) publica o portal para todo o segmento de rede. Um vizinho que varra a faixa em
  busca de `:8080` encontra a tela de login, e o `APP_ENV: local` fixado na linha 48 garante
  que o seed criou as três contas de demonstração cujas senhas o `README.md` publica em
  texto claro, por decisão registrada — `admin@oraculo.local` / `oraculo123` entrega `ADMIN`
  em uma requisição. Nenhuma das defesas de M-2 ajuda: quem tem a senha correta não precisa
  de tentativas.

  Vale separar o que **é** e o que **não é** o achado. Publicar as credenciais no README é
  decisão deliberada e documentada do ADR-006 ("Três usuários no seed, com credenciais
  publicadas no README — o avaliador consegue **testar** o RBAC, não só ler sobre ele"), e
  esta auditoria a considera correta para um artefato de avaliação: sem elas, o revisor não
  consegue exercitar os três níveis. O achado é o **alcance de rede** que o compose entrega
  junto, que não está registrado como decisão em lugar nenhum.

  Sobre o banco, a configuração está certa e merece registro explícito: o serviço `db` **não
  publica porta** (não há bloco `ports:` em `docker-compose.yml:14-36`), então
  `MYSQL_ROOT_PASSWORD: root` e `MYSQL_PASSWORD: oraculo` só são alcançáveis de dentro da
  rede do compose. O comentário das linhas 1-7 antecipa a pergunta e a responde. Não é
  achado.

- **Impacto no negócio:** numa instância exposta, um estranho na mesma rede obtém `ADMIN`
  e, com ele, a integridade inteira do catálogo: criar, editar, excluir e restaurar carta;
  desativar edição ou raridade, o que remove das opções de cadastro tudo que dependa delas
  (`DeactivateCatalogItemUseCase`); e ler o histórico de auditoria, que expõe id e nome dos
  usuários do portal (`CardHistoryRoute.php:47-63`). Também obtém os e-mails e nomes de
  todas as contas, via o histórico e via `GET /api/auth/session`.

- **Justificativa da pontuação.** `AV:A` porque a exposição alcança a rede local adjacente,
  não a internet — a porta é publicada pelo hospedeiro, não roteada. `C:L`/`I:L` porque a
  instância alcançada é uma cópia de avaliação cujo conteúdo é a massa do próprio seed:
  jogos, edições, raridades e trinta e três cartas reproduzidas do enunciado, mais as três
  contas de demonstração. **Se este mesmo arquivo `docker-compose.yml` for usado um dia para
  subir uma instância com dado real, os mesmos metadados passam a `C:H`/`I:H` e o achado
  passa a 8,1 — High.** É o gatilho de reavaliação deste item.

- **Mitigação:** duas linhas, nenhuma delas com efeito sobre a experiência do avaliador.

  ```yaml
  # docker-compose.yml:57-58 — vincula só ao laço local
  ports:
    - "127.0.0.1:8080:80"
  ```

  `http://localhost:8080` continua funcionando exatamente igual para quem roda o projeto; o
  que deixa de funcionar é o acesso a partir de outra máquina, que nunca foi requisito.

  E, no `README.md`, uma frase junto da tabela de credenciais, dizendo o que a tabela
  significa: que as três contas existem **apenas** com `APP_ENV=local`, que em qualquer
  outro ambiente o seed cria um único administrador com senha de `random_bytes` exibida uma
  vez (`seed.php:68-76`), e que estas senhas não devem ser usadas em nenhuma instância que
  guarde dado real. Isso transforma uma configuração conveniente numa decisão consciente —
  que é a diferença entre as duas coisas.

---

### L-1 — A linha de base de cabeçalhos de segurança está declarada em apenas um dos três blocos `<Directory>` do Apache

- **Severidade:** Low — **CVSS v3.1:** 3,1 (`CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N`)
- **CWE:** CWE-693 (falha de mecanismo de proteção), com CWE-16 (configuração)
- **OWASP:** A05:2021 — Security Misconfiguration
- **Local:** `docker/app/apache.conf:78-93` (`/src`), `:100-115` (`/tests`) e `:117-136`
  (document root), comparados entre si

- **Evidência:** os quatro `Header always set` existem **só** no bloco do document root:

  ```apache
  # apache.conf:117-128 — o único bloco com a linha de base completa
  <Directory /var/www/frontend/public>
      …
      Header always set Content-Security-Policy "${CSP_APP}"
      Header always set X-Content-Type-Options "nosniff"
      Header always set X-Frame-Options "DENY"
      Header always set Referrer-Policy "same-origin"
  ```

  ```apache
  # apache.conf:78-93 — /src: nenhum cabeçalho de segurança
  <Directory /var/www/frontend/src>
      Require all granted
      AllowOverride None
      Options -Indexes
      Header set Cache-Control "no-cache"
  </Directory>

  # apache.conf:100-115 — /tests: CSP sim, os outros três não
  <Directory /var/www/frontend/tests>
      …
      Header always set Content-Security-Policy "${CSP_TESTES}"
  </Directory>
  ```

  Diretiva `Header` em `<Directory>` não é herdada de um bloco irmão: cada um dos três
  caminhos servidos recebe exatamente o que declara. `/src` serve **todo** o JavaScript e
  o CSS da aplicação — `main.js`, os módulos de `shared/`, `features/` e `pages/`, e as
  quatro folhas de estilo — e serve tudo isso sem `X-Content-Type-Options: nosniff`.

- **Vetor de ataque:** a ausência de CSP em `/src` e `/tests` tem pouco efeito prático,
  porque a CSP governa **documentos** e esses caminhos servem sub-recursos, cuja política é
  a do documento que os importou. A falta que tem efeito real é a de `nosniff` sobre
  `/src/*.js` e `/src/*.css`: um agente que ignore o `Content-Type` declarado e adivinhe o
  tipo pelo conteúdo pode tratar um desses recursos como outra coisa em cenários de
  confusão de MIME. Como todo o conteúdo servido por `/src` é código do próprio projeto, sem
  um único byte controlável por usuário, **não há hoje caminho de exploração** — daí `AC:H`
  e `UI:R`. O que existe é uma linha de base declarada três vezes de três jeitos diferentes,
  que é a forma como um cabeçalho some sem ninguém perceber.

- **Impacto no negócio:** nenhum imediato. O custo é de manutenção e de erosão: quem
  acrescentar um quarto `Alias` amanhã copiará um dos blocos existentes, e há duas chances
  em três de copiar o que não tem a linha de base.

- **Mitigação:** subir os quatro cabeçalhos comuns para o nível do `<VirtualHost>`, onde são
  herdados por todos os `<Directory>`, e deixar em cada bloco **apenas** o que é específico
  dele — a CSP, que é a única diretiva que legitimamente difere entre a aplicação e a página
  de testes:

  ```apache
  # apache.conf — dentro de <VirtualHost *:80>, antes dos blocos <Directory>
  # Linha de base: vale para tudo que este host serve. A CSP fica por
  # <Directory> porque é a única que difere entre aplicação e página de testes.
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "DENY"
  Header always set Referrer-Policy "same-origin"
  ```

  E declarar a CSP também para `/src`, ainda que redundante para sub-recursos, para que o
  host não tenha nenhum caminho servido sem política — é a mesma razão pela qual
  `SecurityHeaders` é o primeiro elo do pipeline e não o último.

  Vale estender a linha de base ao bloco do front controller
  (`apache.conf:59-63`, `/var/www/backend/public`): hoje as respostas da API recebem seus
  cabeçalhos do PHP, o que funciona — **exceto** no caminho descrito em M-1, que não chega
  ao pipeline. Declará-los também no Apache fecha esse buraco por baixo, independentemente
  da correção do M-1.

---

### L-2 — Pilhas registradas em log incluem os valores dos argumentos, e o campo `trace` não é redigido

- **Severidade:** Low — **CVSS v3.1:** 2,5 (`CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:U/C:L/I:N/A:N`)
- **CWE:** CWE-532 (inserção de informação sensível em arquivo de log)
- **OWASP:** A09:2021 — Security Logging and Monitoring Failures
- **Local:** `docker/app/php.ini` (ausência da diretiva `zend.exception_ignore_args`);
  `backend/src/Infra/Http/ErrorHandler.php:72`;
  `backend/src/Shared/Observability/StderrLogger.php:32-35`

- **Evidência:** o `php.ini` do contêiner define oito diretivas e **não** define
  `zend.exception_ignore_args`:

  ```ini
  ; docker/app/php.ini:1-10
  display_errors = Off
  display_startup_errors = Off
  log_errors = On
  error_reporting = E_ALL
  error_log = /dev/stderr
  expose_php = Off
  ```

  A imagem `php:8.3-apache` não ativa `php.ini-production` por padrão — ela deposita
  `php.ini-development` e `php.ini-production` em `/usr/local/etc/php/` e deixa a escolha a
  cargo do Dockerfile, que aqui copia apenas `oraculo.ini`
  (`docker/app/Dockerfile:13`). Sem a diretiva, vale o padrão embutido do PHP, que **inclui**
  os argumentos nas pilhas. A pilha é registrada crua:

  ```php
  // ErrorHandler.php:68-73
  'trace' => $error->getTraceAsString(),
  ```

  E a redação do logger casa por **nome de campo**, não por conteúdo — `trace` não contém
  nenhum dos fragmentos da lista:

  ```php
  // StderrLogger.php:32-35
  private const SENSITIVE_FRAGMENTS = [
      'pass', 'senha', 'token', 'secret', 'segredo',
      'authorization', 'apikey', 'api_key', 'credential', 'hash',
  ];
  ```

  Corroboração independente: a auditoria de qualidade desta mesma data capturou, do
  contêiner em execução, uma linha de log cujo campo `trace` mostra
  `strval(Array)` e `array_map('strval', Array)` — isto é, **com os argumentos presentes**.
  Esta auditoria não executou nada e cita a evidência de terceiro como corroboração, não
  como observação própria.

- **Vetor de ataque:** `getTraceAsString()` do PHP imprime os argumentos escalares de cada
  quadro, truncando string em quinze caracteres seguidos de reticências. Basta que uma
  exceção inesperada nasça num quadro que receba credencial em texto claro como argumento
  escalar para que o prefixo dessa credencial vá para o log. Os quadros que qualificam
  existem e são poucos: `AuthenticateUserUseCase::isValid($credentials, $password)`
  (linha 119), `UserCredentials::matches($plainPassword)`
  (`UserCredentials.php:28`), a chamada interna `password_verify(...)`, e
  `password_hash($input->newPassword, …)` em `ChangePasswordUseCase.php:55`. De forma mais
  ampla e mais provável, qualquer falha inesperada durante uma requisição faz o log receber
  os argumentos que o usuário enviou — termo de busca, e-mail, nome de carta, referência de
  imagem.

  Quem lê o log lê isso: o operador do contêiner, qualquer coletor de log para onde o
  `stdout`/`stderr` do Docker seja encaminhado, e quem obtiver acesso ao hospedeiro. Daí
  `AV:L` e `PR:L`.

- **Impacto no negócio:** exposição parcial de credencial e de entrada de usuário a quem
  tem acesso ao log. Não é comprometimento direto — quinze caracteres de uma senha ainda
  precisam ser completados —, mas é exatamente o tipo de resíduo que sobrevive em backup e
  em coletor por muito mais tempo do que a senha que ele descreve. O `StderrLogger` foi
  escrito com essa preocupação explícita (o comentário das linhas 14-18 registra um
  incidente concreto de token e telefone expostos em produção por mais de um mês); o campo
  `trace` é a porta que escapou da regra.

- **Mitigação:** uma linha no `php.ini`, que resolve o problema na raiz e sem custo de
  diagnóstico relevante — o quadro, o arquivo e a linha continuam no log, só os **valores**
  dos argumentos saem:

  ```ini
  ; docker/app/php.ini — acrescentar junto do bloco de erro
  ; A pilha registrada em log não carrega os VALORES dos argumentos: um quadro
  ; como password_verify('minhasenha1234...') gravaria o prefixo da credencial.
  ; Quadro, arquivo e linha continuam presentes — é o que se usa para depurar.
  zend.exception_ignore_args = 1
  ```

  Como o `php.ini` do repositório é a única fonte de configuração copiada pelo Dockerfile,
  a diretiva vale para CLI e para Apache de uma vez.

  Não recomendo acrescentar `trace` à lista de fragmentos sensíveis do `StderrLogger`:
  redigir a pilha inteira destruiria o valor do log de erro, que é justamente o que M-1
  mostra ser necessário para investigar. A diretiva do PHP resolve o problema certo no lugar
  certo.

---

## Observações de endurecimento (sem pontuação CVSS)

Itens verificados que **não violam nenhuma propriedade de segurança** — a base CVSS seria
0,0 — e que por isso não entram na contagem de achados. Ficam registrados porque cada um é
uma superfície a menos ou uma ambiguidade a menos para quem mexer aqui depois.

**O-1 · A página de testes do frontend é servida pelo mesmo host da entrega.**
`apache.conf:98` publica `Alias /tests /var/www/frontend/tests`, e o bloco das linhas
100-115 concede `Require all granted`. Qualquer pessoa que alcance a aplicação alcança o
runner e as suítes, sem sessão. O risco concreto é baixo: `/src` já expõe todo o código do
frontend por decisão explícita e correta (o comentário das linhas 66-75 argumenta que em
front-end o código é público por natureza), e as suítes usam dublês de rede
(`double.on("POST", "/api/auth/login", …)` em `tests/suites/auth-api.test.js:45`) em vez de
tocar a API real. Ainda assim, é ferramenta de desenvolvimento no host de entrega. Se a
página de testes precisa continuar publicada — e há bom argumento para isso num artefato de
avaliação, já que ela demonstra a suíte rodando —, vale ao menos declará-la como escolha no
próprio `apache.conf`, na altura do `Alias`, do mesmo jeito que a rota pública de login é
declarada no `AuthModule`.

**O-2 · Duas CSPs divergentes, e o contrato de API documenta uma terceira coisa.**
A CSP do documento (`apache.conf:33-49`) e a CSP das respostas da API
(`SecurityHeaders.php:27-37`) não são iguais: `img-src` do documento é
`'self' https: blob:` e o da API é `'self' https: data:`. A divergência é deliberada de um
lado — o comentário de `apache.conf:23-27` explica que `data:` foi retirado de propósito,
porque `isSafeUrl` recusa esse esquema na borda — mas não foi propagada ao PHP, que
continua com `data:` liberado. Não há exploração: a CSP da API só governa um documento
quando alguém navega direto a uma URL de `/api/`, e nesse caso o documento é uma imagem ou
um JSON, sem HTML que consuma `img-src`. O que precisa ser corrigido é a documentação:
`docs/api-contract.md` §7 descreve **apenas** a política do PHP, não menciona a CSP do
documento introduzida no Épico 10 — que é a que o navegador de fato consulta para decidir
qual script executa — e afirma que os cabeçalhos são "aplicados a **todas** as respostas",
o que o caminho descrito em M-1 desmente. Alinhar `img-src` nas duas políticas e atualizar
o §7 fecha as três pontas.

**O-3 · `docs/ENGENHARIA.md` §5 declara um document root que não é o que o Apache usa.**
A linha 115 afirma: "**O document root é `backend/public/`.** Nada fora dele pode ser
alcançável pela web." O `apache.conf:52` diz `DocumentRoot /var/www/frontend/public`, e o
próprio cabeçalho de `backend/public/index.php:6-8` diz "O document root do servidor aponta
para `frontend/public`". As três frases não podem estar todas certas. A configuração real
está correta e segura — `backend/src`, `.env`, `migrations/` e `storage/` não têm caminho
servido, e conferi que não há `Alias` para `/var/www/backend` nem para `/var/www/frontend`,
apenas para `frontend/public` (document root), `frontend/src`, `frontend/tests` e o front
controller. O problema é que o documento **normativo** de engenharia descreve errado a
fronteira web, e é justamente esse documento que alguém vai ler antes de mexer no
`apache.conf`. Corrigir a linha 115 é uma frase, e evita que a próxima alteração "conserte"
a configuração na direção errada.

**O-4 · A allowlist de esquema da imagem remota aceita `http:`, que nenhuma CSP do sistema
permite carregar.** `RemoteUrlImageSource.php:24` define
`ALLOWED_SCHEMES = ['http', 'https']`, conforme o ADR-008. Mas `img-src` da CSP do documento
é `'self' https: blob:` e o da API é `'self' https: data:` — nenhum dos dois admite `http:`.
O resultado é falha fechada, e portanto seguro: uma carta cadastrada com `http://…` é aceita
pelo backend e depois **bloqueada pelo navegador**, exibindo o espaço reservado do RF-34 sem
mensagem que explique por quê. É defeito de coerência, não de segurança. A correção mais
simples é estreitar a allowlist do backend para `https` apenas, o que alinha as três
declarações e melhora a postura; se o `http:` precisar ficar por compatibilidade com algum
CDN, então o ADR-008 e o `api-contract.md` §5 devem registrar que ele é aceito na gravação e
bloqueado na exibição.

**O-5 · Endurecimentos ausentes, sem risco atual, para a lista de "quando sair do local".**
Não há `Strict-Transport-Security` nem `Permissions-Policy` em nenhum lugar da configuração
— irrelevante hoje, porque o `APP_URL` de entrega é `http://localhost:8080` e HSTS sobre
HTTP é ignorado, mas obrigatório no dia em que houver TLS. Não há
`docker-compose.yml → logging.options.max-size`, que é o que transforma a amplificação de
M-1 em crescimento ilimitado de disco. E `password_needs_rehash` não é consultado em lugar
nenhum: hoje isso não é lacuna, porque os **dois** únicos pontos que geram hash usam
`PASSWORD_BCRYPT` com `cost => 12` (`seed.php:27` e `ChangePasswordUseCase.php:28`), então
não existe hash legado no sistema; passa a ser lacuna no instante em que alguém alterar o
custo, porque não há caminho de atualização e as senhas antigas ficariam no custo antigo
para sempre.

---

## Não-achados verificados

O que foi conferido, arquivo por arquivo, e está sólido. Registrado com a mesma seriedade
dos achados: conformidade verificada tem valor de informação, e esta seção é o que evita
reauditar o mesmo terreno na próxima passagem.

**Cobertura de guard — a verificação de maior rendimento deste repositório.** As 22 rotas
instanciadas nos três `*Module.php` foram cruzadas com os 21 `Guard::protect(` que as
envolvem. Nenhuma rota de carta, catálogo, usuário ou sessão nasce fora de um guard. A única
exceção é `POST /api/auth/login`, com comentário de justificativa em `AuthModule.php:62-64`
— e a justificativa é válida: é a rota que cria a sessão, então não pode exigir sessão.
`bin/routes.php:91-95` falha com código 1 se uma segunda rota pública aparecer.

**Nenhuma divergência entre o código e `api-contract.md` §9.** Método, caminho e nível
mínimo conferem nas 22 linhas. Não houve nenhum caso em que o contrato prometesse uma
proteção que o código não aplica — que é a divergência que importa, porque o código é o que
vale para o atacante.

**A identidade vem sempre da sessão.** `grep` por `userId|user_id|role|level` em
`Infra/Http/Routes/` devolve apenas leituras de `Guard::USER_ATTRIBUTE`
(`CreateCardRoute.php:42`, `UpdateCardRoute.php:42`, `DeleteCardRoute`, `RestoreCardRoute`,
`ChangePasswordRoute.php:55`, `ListEditionsRoute.php:49`, `ListRaritiesRoute.php:50`). Não há
uma única leitura de `userId`, `role` ou `level` a partir do corpo da requisição.

**Atribuição em massa é estruturalmente impossível.** `Request` não expõe o corpo inteiro —
só `body(string $field)` (`Request.php:146-149`) — e o cabeçalho da classe registra que há
teste que falha se um `all()`, `toArray()` ou `input()` for acrescentado. O único ponto onde
um objeto aninhado entra, `image`, é filtrado campo a campo em
`CardRequestReader.php:49-52`, descartando tudo que não for `type` ou `reference`.

**Contenção entre entidades, no lugar certo.** `EditionBelongsToGame.php:35` e
`RarityBelongsToGame` resolvem por `findByGameAndCode($game->id, $codigo)` — a regra vive na
consulta, então uma edição de outro jogo com a mesma sigla simplesmente não é encontrada, em
vez de depender de uma comparação posterior que um refactor pode remover. A mesma disciplina
em `ListCardsUseCase.php:65-86`, que ainda recusa filtro de edição ou raridade sem jogo.
Ausência de checagem de posse é decisão avaliada, não esquecimento: o ADR-006 registra que
neste domínio não existe recurso com dono.

**Sessão.** Cookie `ORACULOSID` com `HttpOnly`, `SameSite=Lax` e `Path=/` obrigatórios por
construção (`Cookie.php:47-56`), e `Secure` condicionado a `APP_URL` começar com `https://`
(`index.php:68`) — condicionamento correto, porque em HTTP local um cookie `Secure` não é
gravado e o login pararia sem mensagem. Nome do cookie não denuncia a stack
(`SessionMiddleware.php:26-29`). Fixação de sessão fechada por construção: cada login gera
um id novo de `bin2hex(random_bytes(32))` (`Session.php:54`), sem depender de
`session_regenerate_id`. Logout apaga a linha no servidor (`EndSessionUseCase.php:33`) e
expira o cookie. Troca de senha revoga **todas** as sessões (`ChangePasswordUseCase.php:58`,
RF-05) na ordem certa — conferir, gravar, revogar — e a resposta já limpa o cookie de quem
pediu. Sessão expirada é apagada na passagem e resulta em `401`, nunca `403`
(`SessionMiddleware.php:81-87` + `Guard.php:76-80`), conforme ADR-007. Usuário desativado ou
excluído mata a sessão na hora (`SessionMiddleware.php:51-57`), e `UserRepositoryPdo` filtra
`deleted_at IS NULL` nos três métodos de leitura.

**Senha.** `password_hash` com `PASSWORD_BCRYPT` e `cost => 12` nos dois únicos pontos que
geram hash. `password_verify` na comparação, sempre — nenhum `==`, `===` ou `strcmp` sobre
hash em lugar nenhum do repositório. `role_level` fora do enum lança em vez de virar um
default permissivo (`UserRepositoryPdo.php:99-108`), o que é a decisão certa e rara.

**Enumeração de usuário e oráculo de tempo, fechados.** Mensagem idêntica para usuário
inexistente, senha errada e conta inativa (`GENERIC_FAILURE`,
`AuthenticateUserUseCase.php:45`), e o hash é conferido **também** quando o e-mail não
existe, contra o `DUMMY_HASH` da linha 43, para que o relógio não denuncie qual dos casos
ocorreu. O `Guard` trata usuário inativo como ausente de propósito, para não confirmar a
existência da conta (`Guard.php:76-80`). A tabela `login_attempts` guarda o **hash** de
(e-mail, IP), não o e-mail — a migration 0004 registra a razão: guardar em claro
transformaria a tabela numa lista de usuários do sistema.

**O `LoginAttemptGateway` é de fato usado, não apenas definido.** `assertWithinAttemptLimit`
é chamado na linha 73 de `AuthenticateUserUseCase`, **antes** da verificação de credencial,
e o limite vale inclusive para a senha correta — que é o detalhe que faz o limite servir para
alguma coisa contra força bruta. As limitações desse limite estão em M-2.

**CSRF.** Exigido em toda escrita (`Csrf.php:42-48`), com a única isenção sendo
`/api/auth/login`, declarada em `index.php:104` e justificada. Comparação em tempo constante
com `hash_equals` (`Session.php:121`). Token de 32 bytes de `random_bytes`, por sessão
(`Session.php:56`). Falha é `403` e não `401`, conforme ADR-007 — não desloga o usuário por
um problema que se resolve rebuscando o token. No cliente, o token vive **em memória**
(`frontend/src/shared/api/csrf.js:15`), nunca em `localStorage`, `sessionStorage`, cookie
legível ou URL — e há teste que verifica isso (`tests/suites/client.test.js:118-123`). Ele
viaja no cabeçalho `X-CSRF-Token`, montado num ponto único (`client.js:107-111`).

**SQL.** Toda instrução do repositório é parametrizada, inclusive as de número. Os dois
lugares onde o defeito costuma sobreviver foram lidos em detalhe: `ORDER BY` sai de
`CardQuery::SORTS`, um mapa fechado de três entradas, e `orderByClause()` só consegue
devolver um dos três valores porque `create()` recusa qualquer `sort` fora do mapa
(`CardQuery.php:53-55`); `LIMIT`/`OFFSET` são interpolados a partir de `perPage`, limitado a
`[1, 100]`, e `page`, limitado a `>= 1` (`CardQuery.php:60-63`), nunca de texto do cliente.
`LIKE` com curinga passa por `escapeLike` (`CardRepositoryPdo.php:232`). Não há `IN (...)`
montado dinamicamente em lugar nenhum. `ATTR_EMULATE_PREPARES => false`
(`Connection.php:61`), sem o qual o prepared statement deixaria de ser a proteção que se
supõe que é. Nenhum `SELECT *`.

**Travessia de caminho na rota de mídia.** A validação acontece **duas vezes**, em camadas
independentes: `ServeCardImageRoute.php:62` recusa antes de qualquer acesso, e
`LocalImageStorage::isSafeName` (`:63-68`) recusa de novo antes de tocar o disco. O padrão
`^[a-f0-9]{32}\.(jpg|png|webp|gif)$` não admite barra, ponto-ponto, byte nulo nem qualquer
caractere de caminho, e é ancorado nas duas pontas. O `Content-Type` sai de um mapa fixo
indexado pelo grupo capturado — nunca de adivinhação sobre o arquivo. Referência inválida e
arquivo inexistente devolvem a **mesma** `NotFoundError`, o que fecha o oráculo de
existência.

**Execução de comando, inclusão dinâmica, desserialização.** Nenhuma ocorrência de `exec`,
`shell_exec`, `system`, `passthru`, `proc_open`, `popen`, `eval`, `assert`, `unserialize`,
`extract` ou `create_function` em `backend/src/`. As três chamadas de `passthru`/`exec` do
repositório estão em `backend/bin/validate.php:102-134`, ferramenta de desenvolvimento fora
do caminho de requisição, e todas usam `escapeshellarg`. Não há `include`/`require` com
variável: o autoloader monta o caminho a partir do nome da classe, que nunca vem de entrada
externa, e confere com `is_file` antes de incluir (`autoload.php:27-31`).

**Injeção de cabeçalho e redirecionamento aberto.** `header()` é chamado num lugar só,
`Response::send()` (`:130-137`). Os valores que chegam lá são: `Content-Type` de constante ou
de mapa fixo; `Location` montado como `'/api/cards/' . $card->id`, com id inteiro; `ETag` a
partir da referência já validada contra o padrão hexadecimal; e `Set-Cookie`, cujo valor
passa por `rawurlencode` (`Cookie.php:48`). Nenhum caminho leva texto livre do usuário a um
cabeçalho. Não existe redirecionamento HTTP no backend.

**Exposição de dado.** `display_errors` e `display_startup_errors` desligados, `expose_php`
desligado (`php.ini:3-10`). `fromUnexpected` devolve frase neutra ao cliente e mantém
`SQLSTATE`, nome de coluna, caminho e pilha só no log (`ErrorHandler.php:66-79`).
`EnvironmentError` **não** descende de `DomainError` (`EnvironmentError.php:14`), de modo
deliberado, então o nome da variável ausente nunca chega numa resposta HTTP. A entidade
`User` não carrega o hash; o hash é lido em um único método e sai embrulhado em
`UserCredentials`. Nenhum id interno de catálogo escapa: `CardPresenter` publica slug e
código, não id (`CardPresenter.php:70-72`). `json_encode` só aparece em `Response::send` e no
logger.

**Seed — os quatro pontos que o padrão exige, todos corretos.** Fora de `APP_ENV=local`,
o administrador nasce com `bin2hex(random_bytes(12))`, é exibido uma única vez em `STDERR`
e não é gravado em lugar nenhum (`seed.php:68-76`); e só nasce **se não houver nenhum
usuário** (`:66-68`). O `ON DUPLICATE KEY UPDATE` de `seedUser` toca **apenas** `name`
(`seed.php:48`) — senha e `role_level` de usuário existente são intocáveis, o que é o que
impede o seed de virar uma porta dos fundos que se auto-restaura a cada deploy. Cartas só
entram se a tabela estiver vazia (`:216-221`), preservando o que for cadastrado entre
reinícios.

**Upload — as sete regras do ADR-008, todas cumpridas.** Tipo apurado pelo **conteúdo**, com
`finfo_buffer` (`UploadedFileImageSource.php:85-97`); allowlist de quatro tipos com **SVG
deliberadamente fora**; tamanho conferido **antes** de inspecionar ou gravar
(`:60-64`), e o teto de aplicação (`UPLOAD_MAX_BYTES`, 3 MB) está abaixo dos tetos do PHP
(`upload_max_filesize = 4M`, `post_max_size = 6M`), que é a ordem correta; nome gerado pelo
servidor com `bin2hex(random_bytes(16))` (`:74`); destino fora do document root
(`index.php:76-78`); servido por rota com `Content-Type` verificado na gravação; referência
validada contra padrão estrito antes de tocar o disco. `is_uploaded_file` confere que o
caminho temporário veio de um upload HTTP desta requisição (`Request.php:127-131`), e o
método devolve os **bytes**, não o registro de `$_FILES`, para que o nome original e o tipo
declarado pelo cliente não fiquem fáceis de usar por engano.

**Sem SSRF.** O servidor **nunca** busca a URL informada pelo usuário. Não há `curl_*` em
nenhum arquivo, e as quatro ocorrências de `file_get_contents` são: `php://input`, o caminho
temporário de um upload validado, um arquivo de migration e um arquivo do diretório de
uploads validado contra o padrão hexadecimal. `RemoteUrlImageSource` valida esquema e
formato e devolve a string — não faz requisição.

**Origem única, sem CORS.** `grep -rni "access-control-allow"` em `backend/`, `docker/` e
`frontend/src/` não devolve **nenhuma** ocorrência. Não há `Access-Control-Allow-Origin`,
nem permissivo nem restrito — o que é mais restritivo do que qualquer configuração de CORS,
e é exatamente o que o ADR-003 decidiu. O cliente usa `credentials: "same-origin"` e não
`"include"` (`client.js:197`).

**Plataforma.** A CSP do documento **não contém** `unsafe-inline` nem `unsafe-eval`, e traz
`frame-ancestors 'none'`, `object-src 'none'` e `base-uri 'none'`
(`apache.conf:33-49`) — RNF-08 cumprido. Listagem de diretório desligada nos três blocos
(`Options -Indexes`) e o módulo removido na imagem (`Dockerfile:10`, `a2dismod -f autoindex`).
O `db` não publica porta. `.env` está no `.gitignore` e **nunca esteve versionado**:
`git log --all -- .env` não devolve nada, e a única entrada do histórico é `.env.example`,
que documenta nomes sem valores. Nenhum literal de segredo em `backend/src/`, `backend/bin/`
ou `docker/`, exceto o `DEMO_PASSWORD` do seed, que é intencional e restrito a
`APP_ENV=local`. `Env::required` e `Env::requiredInt` não têm valor de reserva
(`Env.php:27-54`) — nenhum `?:` nem `??` sobre `getenv`.

**Os dois hashes da CSP conferem.** Verificação aritmética, não confiança na anotação: o
`sha256` do conteúdo exato do bloco `<script type="importmap">` de
`frontend/public/index.html` é `uBe61TLOgUZyopiIimcIToVknvqJ+W5vLpBrThdXkaA=`, idêntico ao
declarado em `apache.conf:43`; o de `frontend/tests/index.html` é
`1ZXl6zUZKdHuAFAQSI6ao8S/QDCbF4P46LbHBo8Fg/k=`, idêntico ao de `apache.conf:49`. Os arquivos
são `text eol=lf` por `.gitattributes`, então os bytes no contêiner são os mesmos que
calculei. Isto significa que a política **não** vai forçar um `unsafe-inline` de emergência
por hash desatualizado — que é o modo típico como uma CSP correta vira decoração.

**Frontend.** Zero ocorrências de `innerHTML`, `insertAdjacentHTML`, `outerHTML`,
`eval(`, `new Function(` ou `document.write` em `frontend/src/`. Todo dado externo entra por
`textContent` (`shared/dom/elements.js:42`). Todo atributo de URL passa por uma allowlist de
esquema que resolve com o construtor `URL`, o que fecha as fugas de espaço, caractere de
controle e maiúsculas (`shared/dom/safe-url.js:29-43`); atributo `on*` **lança**, porque só
aparece por erro de programação (`elements.js:68-72`). `localStorage` guarda apenas a
preferência de tema, e o valor lido é validado — há teste que injeta
`'"><script>alert(1)</script>'` e verifica que é recusado
(`tests/suites/preference.test.js:44-53`). Nenhum `document.cookie`. As decisões de
permissão do cliente são presentacionais e concentradas numa única comparação
(`shared/session/session.js:72-77`); o servidor recusa de qualquer forma, via `Guard`.

**Nenhuma dependência de terceiros — RNF-01 e ADR-001 confirmados.** Não existem `vendor/`,
`node_modules/`, `composer.json`, `composer.lock`, `package.json` nem `package-lock.json`. O
autoload PSR-4 é próprio, em 32 linhas (`backend/src/autoload.php`). O `index.html` não
carrega nenhum script, folha de estilo ou fonte remota. `grep` por react, vue, jquery,
bootstrap, tailwind, lodash, axios, `cdn.`, `unpkg`, `jsdelivr` e `googleapis` em todo o
código servido devolve **uma** ocorrência, que é a palavra "CDN" dentro de um comentário em
português (`features/cards/components/card-image-field.js:7`). A superfície de cadeia de
suprimentos deste projeto é, literalmente, a imagem `php:8.3-apache` e a `mysql:8.4`.

---

## Requer verificação dinâmica

O que **não** é comprovável por leitura de arquivo, e como confirmar cada item. Nenhum
destes foi verificado nesta execução.

1. **A CSP em vigor numa tela real.** Este é o item mais importante da lista, e é
   consequência direta do limite declarado no topo: a extensão do Chrome não estava
   conectada, então **nenhum cabeçalho de resposta foi observado e nenhuma tela foi
   carregada**. Confirmei que a diretiva está no arquivo, que ela não contém
   `unsafe-inline` nem `unsafe-eval`, e que os dois hashes `sha256` batem com os bytes dos
   HTML. Não confirmei que o Apache a emite, que `mod_headers` está ativo em tempo de
   execução (o `Dockerfile:9` faz `a2enmod rewrite headers`, mas isso é o arquivo, não o
   processo), nem que a aplicação carrega sob ela sem violação. **Como verificar:** abrir
   `http://localhost:8080`, ler o cabeçalho `Content-Security-Policy` na aba Network e
   confirmar que é o `CSP_APP` esperado; conferir que o console não registra nenhum
   `Refused to execute inline script`; repetir em `/tests` esperando `CSP_TESTES`; e pedir
   `/src/main.js` para confirmar o que O-1 e L-1 preveem — resposta **sem** `nosniff` e
   **sem** CSP.
2. **O valor efetivo de `zend.exception_ignore_args`** (base de L-2). Deduzi que o padrão
   embutido do PHP vale, porque o `php.ini` do repositório não define a diretiva e o
   Dockerfile não copia `php.ini-production`. **Como verificar:**
   `docker compose exec app php -i | grep exception_ignore_args`. Se devolver `Off`, L-2 se
   confirma; se `On`, L-2 cai e sobra apenas a recomendação de fixar a diretiva
   explicitamente, para não depender de um padrão que muda entre versões.
3. **O comportamento sob `post_max_size` estourado** no upload. Quando o corpo multipart
   excede `post_max_size = 6M`, o PHP descarta `$_POST` e `$_FILES` e emite um aviso durante
   o startup da requisição — antes de o `set_error_handler` de `index.php:46` existir. Pela
   leitura, o caminho esperado é `uploadedFileContents` devolver `null`, virar `''`, e
   `UploadedFileImageSource:54-56` responder `ValidationError` "Nenhum arquivo foi enviado."
   Não confirmei. **Como verificar:** `POST /api/uploads/card-image` com 8 MB e observar o
   status; qualquer coisa diferente de um erro de validação legível é achado novo.
4. **A ausência real de `Access-Control-Allow-Origin` na resposta.** Confirmei que nenhum
   arquivo do repositório o emite. Não confirmei que nenhuma camada intermediária o
   acrescenta. **Como verificar:** requisição com `Origin: https://exemplo.invalid` contra
   `/api/games` e conferir que nenhum cabeçalho `Access-Control-*` volta.
5. **A eficácia do limite de tentativas na prática** (M-2). A lógica está lida e correta;
   o que não se prova estaticamente é o comportamento sob concorrência — se seis requisições
   simultâneas com o mesmo `(e-mail, IP)` passam todas pela contagem antes de qualquer
   `record`, o teto de cinco é ultrapassado por corrida. **Como verificar:** disparar dez
   tentativas em paralelo e contar quantas recebem `401` antes do primeiro `429`.
6. **A rotação e o volume de log sob o ataque de M-1.** O crescimento sem limite é dedução a
   partir da ausência de `logging.options` no compose. **Como verificar:** medir
   `docker inspect --format '{{.LogPath}}' oraculo-app` antes e depois de mil requisições
   `?a[]=1` e observar o tamanho do arquivo.

---

## Roteiro de remediação

### 1. Imediato — hoje, antes da entrega

Nada aqui bloqueia a entrega: não há `CRITICAL` nem `HIGH`. As duas linhas abaixo custam
minutos, não têm risco de regressão e removem o achado mais barato de explorar e o de maior
alcance de rede.

- **M-3, duas linhas.** `docker-compose.yml:58` → `"127.0.0.1:8080:80"`, e uma frase no
  `README.md` junto da tabela de credenciais dizendo que as três contas existem apenas em
  `APP_ENV=local`. `http://localhost:8080` continua idêntico para o avaliador.
- **L-2, uma linha.** `zend.exception_ignore_args = 1` em `docker/app/php.ini`.

### 2. Esta semana

- **M-1**, a correção de origem: a função `scalarStrings` em `Request.php`, substituindo os
  dois `array_map('strval', …)`. É a mesma correção que a auditoria de qualidade prescreve
  para o achado A-1 dela — **um conserto fecha os dois relatórios**. Acompanha teste que
  envia `?page[]=1` e espera `401` sem sessão, não `500`.
- **M-1, parte operacional:** `logging: { driver: json-file, options: { max-size: "10m",
  max-file: "3" } }` nos dois serviços do compose.
- **L-1:** subir `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy` para o
  nível do `<VirtualHost>`, e declarar CSP também em `/src` e no bloco do front controller.

### 3. Antes da próxima entrega — não desta

- **M-2:** segunda janela de tentativas por conta, independente de IP, reaproveitando o
  `LoginAttemptGateway` sem migration; piso de senha de 12 caracteres; `warning` no estouro
  de janela.
- **O-2 e O-3:** alinhar `img-src` entre as duas CSPs, documentar a CSP do documento em
  `api-contract.md` §7, e corrigir a frase do document root em `docs/ENGENHARIA.md:115`.
  São três correções de documento que evitam que a próxima alteração desfaça o que o
  Épico 10 acertou.
- **O-1 e O-4:** decidir explicitamente sobre `/tests` no host de entrega, e estreitar a
  allowlist de esquema de imagem remota para `https` — ou registrar por escrito por que
  `http` fica.

---

CLEAN
