# Padrões de Engenharia — Documento Único

> **O que é isto.** A consolidação dos padrões de qualidade, segurança e organização que
> construí trabalhando num sistema em produção, reescritos para serem **independentes de
> stack** e prontos para começar um projeto do zero.
>
> **Como ler.** Cada seção tem duas camadas:
> - **Regra** — vale para qualquer linguagem. É o que entra em revisão.
> - **Na prática** — a tradução para a stack do novo projeto (**PHP sem framework,
>   MySQL, frontend em JavaScript vanilla + HTML/CSS puro**). Troque esta camada se
>   a stack mudar; a regra continua valendo.
>
> **Como usar.** Este arquivo é a fonte da verdade. Coloque-o na raiz do repositório
> (`PADROES.md`), aponte o `CLAUDE.md` para ele e trate cada item como **critério de
> aceite**, não como sugestão. O §18 traz os arquivos prontos para colar no
> repositório novo.

---

## Sumário

1. [Princípios inegociáveis](#1-princípios-inegociáveis)
2. [Arquitetura](#2-arquitetura)
3. [Padrões de projeto: obrigatórios e proibidos](#3-padrões-de-projeto-obrigatórios-e-proibidos)
4. [Erros e mensagens](#4-erros-e-mensagens)
5. [Autenticação e autorização](#5-autenticação-e-autorização)
6. [Observabilidade](#6-observabilidade)
7. [Persistência e banco de dados](#7-persistência-e-banco-de-dados)
8. [Nomenclatura, idioma e estilo](#8-nomenclatura-idioma-e-estilo)
9. [Configuração, constantes e segredos](#9-configuração-constantes-e-segredos)
10. [Testes](#10-testes)
11. [Depuração sistemática](#11-depuração-sistemática)
12. [Frontend](#12-frontend)
13. [Git, branches, commits e PR](#13-git-branches-commits-e-pr)
14. [Auditoria contínua e ledger de achados](#14-auditoria-contínua-e-ledger-de-achados)
15. [Camada de agentes de IA](#15-camada-de-agentes-de-ia)
16. [Deploy e infraestrutura](#16-deploy-e-infraestrutura)
17. [Checklists](#17-checklists)
18. [Anexos prontos para colar](#18-anexos-prontos-para-colar)

---

## 1. Princípios inegociáveis

Estes cinco princípios explicam *por que* todas as outras regras existem. Quando
uma regra específica não cobrir o seu caso, decida por eles.

### 1.1 Toda linha nova tem que ser melhor que a anterior

A qualidade estrutural sobe de forma **incremental**, usando cada feature nova como
veículo — nunca uma refatoração big bang. Código novo não tem desculpa para nascer
com dívida conhecida.

### 1.2 Não herde código antigo como correto

Antes de copiar um padrão que já existe no repositório, verifique se ele é
**referência** ou **dívida**. Dois sinais baratos:

- Cruze o arquivo com o ledger de achados abertos (§14). O que está `open` ali é
  dívida conhecida, não modelo.
- Pergunte se o padrão ainda elimina o problema que ele nasceu para eliminar.

> **Por que isso é regra.** Espelhar o código existente sem checar propaga defeitos
> para código novo — inclusive achados de segurança que já estavam catalogados como
> abertos. Copiar a *estrutura* é certo; copiar as *lacunas* é regressão.

### 1.3 Padrão que não elimina nada é decoração

Só aplique um design pattern que remova algo concreto: um `if` que ia crescer, um
acoplamento que ia travar o teste, ou um estado global que ia vazar entre casos.
Padrão decorativo sai na revisão.

### 1.4 Segurança e observabilidade são critério de aceite, não fase posterior

Uma rota sem proteção, uma consulta sem parametrização ou um fluxo sem log
estruturado **não está pronta** — mesmo que o comportamento funcione.

### 1.5 O documento é vivo

Sempre que a equipe fixar um novo padrão, biblioteca, arquitetura ou fluxo, este
arquivo é atualizado no mesmo PR. Padrão que só existe na cabeça de alguém, ou só
no plano de uma feature, não vale para o time — precisa ser **promovido** para cá.

---

## 2. Arquitetura

### 2.1 A regra de dependência

Quatro camadas. As setas de dependência apontam **sempre para dentro**:

```
   infra  ──▶  usecases  ──▶  domain  ◀──  shared
     │                                       ▲
     └───────────────────────────────────────┘
                (infra também usa shared)
```

| Camada | Contém | Nunca pode importar |
|---|---|---|
| `domain` | Entidades, interfaces de gateway (portas), eventos de domínio, serviços e helpers de domínio | Banco, HTTP, cache, qualquer biblioteca de framework |
| `usecases` | Um caso de uso por arquivo, orquestrando o fluxo | Qualquer coisa de `infra` — só conhece as **interfaces** de `domain` |
| `infra` | Repositórios, rotas/controllers, criptografia, provedores externos, agendadores, handlers de evento, mappers | — (é a borda; pode conhecer todo mundo) |
| `shared` | Enums, dispatcher de eventos, utilitários transversais | Regra de negócio |
| `modules` | **Composition root** por feature: instancia repositórios + casos de uso + rotas e devolve a lista de rotas | — |

**Testes de fronteira** (rodam na auditoria e na revisão):

- `domain/` não pode conter nenhum import de banco, HTTP ou cache.
- `usecases/` não pode conter nenhum import de `infra/`.
- Rotas e repositórios não podem conter regra de negócio.

### 2.2 Anatomia de um caso de uso

- Construtor **privado** + fábrica estática `create(...)` — deixa a construção
  explícita e centraliza a injeção.
- Tipos `InputDto` e `OutputDto` explícitos. Nunca receba o corpo cru da requisição.
- Recebe gateways e o dispatcher de eventos **por construtor** (injeção de
  dependência). Nunca busca dependência por conta própria (§3.2).
- Valida, autoriza, orquestra e mapeia a saída por um método privado `present*`.
- **Um caso de uso nunca chama outro caso de uso.** Reação transversal vira evento
  de domínio (§2.4).

### 2.3 Anatomia de uma rota

A rota é fina: lê o que precisa da requisição, monta o DTO **campo a campo**, chama
o caso de uso, mapeia a saída e responde. Sem `if` além de apresentação, sem regra
de negócio, **sem escolher o status de erro na mão** (§4.2).

### 2.4 Eventos de domínio

Reação transversal (ex.: "ao criar um cliente, enviar o e-mail de boas-vindas") é resolvida por
um **dispatcher de eventos**, não por encadeamento de casos de uso. Handlers vivem
em `infra`, são registrados em um único lugar e ligados pelo composition root.

> **Um handler nunca pode lançar exceção.** O dispatcher propaga a falha de volta
> para quem disparou o evento — e aí uma operação já persistida responde erro ao
> usuário. Envolva o corpo inteiro em try/catch e apenas registre o log.

### 2.5 Na prática — PHP sem framework

Estrutura de diretórios, com **autoload PSR-4 via Composer** (Composer é
gerenciador de dependência, não framework — usar é correto):

```
projeto/
├── public/                 ← ÚNICO diretório exposto no document root
│   ├── index.php           ← front controller (o único .php público)
│   └── assets/{js,css,img}
├── src/
│   ├── Domain/<Feature>/{Entity,Gateway,Event,Service}/
│   ├── UseCases/<Feature>/CreateCustomerUseCase.php
│   ├── Infra/
│   │   ├── Http/{Router.php,Route.php,Middleware/}
│   │   ├── Http/Routes/<Feature>/CreateCustomerRoute.php
│   │   ├── Repository/<Feature>/CustomerRepositoryPdo.php
│   │   ├── Crypto/, Providers/, EventHandlers/, Schedules/
│   ├── Shared/{Enum,Event,Observability}/
│   └── Modules/CustomerModule.php
├── migrations/             ← .sql versionados (§7.5)
├── tests/                  ← espelha src/ (§10)
├── bin/                    ← scripts de linha de comando
├── composer.json
└── PADROES.md
```

**Regra de ouro do PHP sem framework:** o document root do servidor aponta para
`public/`, e **nada** fora dele é alcançável pela web. Sem isso, `src/`, `.env`,
`migrations/` e `composer.json` viram URLs públicas.

Contrato de rota:

```php
<?php declare(strict_types=1);

namespace App\Infra\Http;

interface Route
{
    public function getPath(): string;          // '/customers/{id}'
    public function getMethod(): HttpMethod;    // enum: GET, POST, PUT, PATCH, DELETE
    public function handle(Request $request): Response;
}
```

Caso de uso:

```php
<?php declare(strict_types=1);

namespace App\UseCases\Customer;

use App\Domain\Errors\ValidationError;
use App\Domain\Customer\Entity\Customer;
use App\Domain\Customer\Gateway\CustomerGateway;
use App\Shared\Event\EventDispatcher;
use App\Shared\Observability\Logger;

final class CreateCustomerUseCase
{
    private function __construct(
        private readonly CustomerGateway $customerGateway,
        private readonly EventDispatcher $dispatcher,
        private readonly Logger $logger,
    ) {}

    public static function create(
        CustomerGateway $customerGateway,
        EventDispatcher $dispatcher,
        Logger $logger,
    ): self {
        return new self($customerGateway, $dispatcher, $logger);
    }

    public function execute(CreateCustomerInput $input): CreateCustomerOutput
    {
        // Validação de entrada como erro de domínio em português — nunca erro cru do banco.
        if (trim($input->name) === '') {
            throw new ValidationError('O nome do cliente é obrigatório.');
        }

        $customer  = Customer::create($input->name, $input->phone);
        $saved = $this->customerGateway->save($customer);

        $this->dispatcher->dispatch(new CustomerCreatedEvent($saved->id()));

        return $this->present($saved);
    }

    private function present(Customer $customer): CreateCustomerOutput { /* ... */ }
}
```

Composition root da feature — devolve rotas **já protegidas**:

```php
<?php declare(strict_types=1);

namespace App\Modules;

final class CustomerModule
{
    /** @return Route[] */
    public static function routes(TokenVerifier $verifier, EventDispatcher $dispatcher): array
    {
        $repo   = CustomerRepositoryPdo::create(Database::connection());
        $logger = LogModule::loggerFor('customer');                  // logger injetado (§6)
        $create = CreateCustomerUseCase::create($repo, $dispatcher, $logger);

        return [
            guard(CreateCustomerRoute::create($create), $verifier, PermissionLevel::OPERATOR),
            // ...todas as demais rotas, cada uma no nível mínimo certo
        ];
    }
}
```

Front controller — registra os módulos e concentra a tradução de erro:

```php
<?php declare(strict_types=1);
// public/index.php

require __DIR__ . '/../vendor/autoload.php';

$router = new Router([
    ...CustomerModule::routes($verifier, $dispatcher),
    ...UserModule::routes($verifier, $dispatcher),
]);

try {
    $router->dispatch(Request::fromGlobals())->send();
} catch (Throwable $e) {
    ErrorHandler::respond($e);   // ÚNICO tradutor erro → status (§4.2)
}
```

---

## 3. Padrões de projeto: obrigatórios e proibidos

Aplique-os para **eliminar** algo concreto (§1.3). Padrão decorativo sai na revisão.

### 3.1 Obrigatórios — comece por estes

| Padrão | Elimina | Sinal de que é hora de usar |
|---|---|---|
| **Strategy** | `if`/`switch` que cresce a cada variação | Duas ou mais implementações reais do mesmo passo (integração, cálculo, formato de exportação) |
| **Observer + Command** | Encadeamento de casos de uso e acoplamento entre features | "Quando acontece X, também precisa acontecer Y" |
| **Adapter** | Dependência direta de biblioteca ou API externa espalhada pelo código | Todo provedor externo (pagamento, WhatsApp, e-mail, ERP) |
| **Chain of Responsibility** | Uma função que valida/transforma tudo em sequência | Pipeline de validação, de middleware ou de enriquecimento |

> **Teto do Strategy: duas implementações.** Com apenas uma, use uma função pura.
> Strategy com uma estratégia é indireção sem ganho.

**Recusar um padrão obrigatório é aceitável** — desde que a recusa venha
justificada e com o **gatilho** que obriga a promovê-lo depois ("quando surgir a
segunda estratégia, extrair").

### 3.2 Proibidos

| Antipadrão | Por quê |
|---|---|
| **Active Record** | Mistura entidade com persistência e mata a independência do domínio |
| **Service Locator** | A dependência some da assinatura; o teste vira refém do container. Dependência entra **por construtor** |
| **Singleton com estado mutável de aplicação** | Vaza estado entre requisições e entre testes |

> **A linha do singleton.** *Handle de conexão* (pool do banco, cliente de cache)
> pode ser único: o estado mora no servidor externo. O proibido é o singleton que
> guarda **estado de aplicação** — buffer, cursor, lista de assinantes, cache em
> memória. Esse é o que vaza.
---

## 4. Erros e mensagens

Quando cada rota escolhe o próprio status, a API acaba com dois envelopes de erro
divergentes e o cliente recebe `400` para tudo. Centralizar resolve — mas só depois que
**as exceções cruas são convertidas para a classe certa**. As duas metades andam juntas.

### 4.1 Duas plateias, dois textos

| Destino | Idioma | Conteúdo |
|---|---|---|
| **Usuário final** | Português, simples | O que aconteceu e o que ele pode fazer |
| **Desenvolvedor** (log) | Livre | Caso de uso, método, ids, payload, erro original da biblioteca/banco |

Nunca deixe texto de banco chegar ao cliente. `Foreign key constraint failed on
field ownerId` é log, não resposta.

### 4.2 O status é escolhido pela classe que você lança

Uma hierarquia de erros de domínio, cada uma carregando o **próprio status HTTP**,
e **um único tradutor** na borda:

| Classe | Status | Quando |
|---|---|---|
| `ValidationError` | 400 | Entrada inválida |
| `UnauthorizedError` / `ForbiddenError` | 403 | Sem token, ou sem permissão |
| `NotFoundError` | 404 | Entidade não existe (ou o solicitante não pode vê-la) |
| `UniqueConstraintError` | 409 | Violação de unicidade |
| `ExternalServiceError` | 502 | Falha de integração externa |
| `DomainError` (base) | 400 | Violação de regra genérica |

Três regras que vêm junto:

1. **Não defina status na mão dentro do handler.** Lance a classe certa. O tradutor
   de borda lê `status` da exceção e responde. Um `http_response_code(400)` no meio
   da rota é exatamente o que cria envelopes divergentes.
2. **Exceção genérica é uma decisão, não um default.** Ela vira `500` com mensagem
   genérica e o texto original fica só no log. Reserve-a para invariantes internas
   que o cliente não causou e não pode corrigir ("Dados de sessão corrompidos.").
   Tudo que o usuário deveria ler precisa ser uma subclasse de domínio.
3. **Nunca passe valor do banco como critério na mensagem.** `new
   NotFoundError('Cliente não encontrado.')` — e não a forma que injeta `id=…`,
   metadados do driver ou nome de coluna no corpo da resposta. Isso é vazamento de
   informação.

### 4.3 Na prática — PHP

```php
<?php declare(strict_types=1);

namespace App\Domain\Errors;

/**
 * Erro de negócio com mensagem em português JÁ SEGURA para o cliente.
 * O status mora na classe (e não na rota) porque quem sabe o tipo da falha é o
 * domínio; a borda apenas traduz. Erros que NÃO descendem daqui viram 500 com
 * mensagem genérica, e o texto cru fica apenas no log.
 */
class DomainError extends \RuntimeException
{
    public int $status = 400;
}

final class ValidationError       extends DomainError { public int $status = 400; }
final class UnauthorizedError     extends DomainError { public int $status = 403; }
final class NotFoundError         extends DomainError { public int $status = 404; }
final class UniqueConstraintError extends DomainError { public int $status = 409; }
final class ExternalServiceError  extends DomainError { public int $status = 502; }
```

```php
<?php declare(strict_types=1);
// src/Infra/Http/ErrorHandler.php — o ÚNICO tradutor erro → status

final class ErrorHandler
{
    public static function respond(\Throwable $e): void
    {
        $isDomain = $e instanceof DomainError;
        $status   = $isDomain ? $e->status : 500;
        $message  = $isDomain ? $e->getMessage() : 'Erro interno. Tente novamente.';

        if (!$isDomain) {
            // O texto cru (SQL, driver, stack) fica SÓ no log.
            Log::channel('http')->error('Falha não tratada', ['error' => $e]);
        }

        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['message' => $message], JSON_UNESCAPED_UNICODE);
    }
}
```

> **Atenção no PHP:** `display_errors` **desligado** em produção. Um warning
> renderizado na resposta entrega caminho absoluto de arquivo, versão do PHP e às
> vezes o conteúdo da query. Em produção: `display_errors=Off`,
> `log_errors=On`, `error_reporting=E_ALL`.

---

## 5. Autenticação e autorização

### 5.1 Proteção no registro da rota, não dentro dela

Toda rota é registrada **envolvida** por um guard que verifica o token e o nível
mínimo de permissão. Rota pública é exceção deliberada (webhook, health check,
login) e precisa de justificativa escrita no PR.

> Este é o item de maior valor da lista inteira. Rota que nasce sem guard vira leitura
> e exclusão sem autenticação — e, quando o dado é pessoal, é o achado mais caro de
> fechar depois. Em projeto novo, o custo de acertar é zero.

Níveis de permissão em um **enum**, nunca número solto no código:

```php
enum PermissionLevel: int
{
    case OPERATOR   = 1;
    case SUPERVISOR = 2;
    case MANAGER    = 3;
    case ADMIN      = 4;
}
```

O nível mínimo tem que corresponder ao que a rota faz: operação destrutiva ou
administrativa não pode ser alcançável no nível mais baixo.

### 5.2 Autenticado ≠ autorizado (IDOR)

Todo caso de uso que lê ou altera um registro **por id** precisa verificar que o
solicitante pode tocar naquele registro — posse, participação na equipe ou nível
suficiente. Verificar apenas que o registro *existe* é a falha de controle de
acesso mais comum e mais cara.

- A identidade vem **sempre do token**, nunca do corpo da requisição.
- A checagem acontece **logo após carregar o registro e ANTES de qualquer efeito**
  (envio, gravação, chamada externa).
- Rota somente-leitura também precisa: uma resposta de "existe/não existe" já é um
  oráculo sobre a carteira alheia.
- Extraia a regra para um helper de domínio (`assertCanAccessCustomer`) e use-o em
  todas as rotas — regra duplicada diverge.

### 5.3 Mass assignment

Nunca repasse o corpo da requisição inteiro para o caso de uso ou para o banco.
Desestruture **campo a campo**. Um corpo repassado inteiro deixa o cliente
escrever `permission_id`, `level`, `owner_id`, `active`.

```php
// ❌ nunca
$useCase->execute($_POST);
$repo->update($id, $request->body());

// ✅ sempre
$input = new UpdateCustomerInput(
    id:            $request->param('id'),
    name:          $request->body('name'),
    phone:         $request->body('phone'),
    requesterId:   $request->user()->id,          // do TOKEN, não do corpo
    requesterLevel:$request->user()->level,
);
```

### 5.4 Sessões, senhas e recuperação

- Hash de senha com algoritmo lento e custo adequado. Em PHP:
  `password_hash($senha, PASSWORD_BCRYPT, ['cost' => 12])` e `password_verify`.
  Nunca `md5`/`sha1`, nunca hash caseiro.
- Código de recuperação/OTP vem de gerador **criptográfico** (`random_int`,
  `random_bytes`) — nunca de `rand()`/`mt_rand()` — com espaço grande, validade
  curta e **limite de tentativas**.
- Logout invalida a sessão **no servidor**, não só o cookie. Troca de senha
  invalida todas as sessões do usuário.
- Cookie de sessão: `HttpOnly`, `Secure`, `SameSite=Lax` (ou `Strict`), e
  `session_regenerate_id(true)` no login (previne fixação de sessão).
- Token de longa duração sem mecanismo de revogação é achado de segurança: ou
  encurte a validade, ou mantenha a sessão no servidor.
- Mensagens de login e de recuperação **não podem** distinguir "usuário não existe"
  de "senha errada" — isso é enumeração de usuários.
- **CSRF:** toda rota que muda estado e é chamada por formulário/cookie precisa de
  token anti-CSRF por sessão, validado no servidor. Se a API for consumida só por
  `fetch` com `Authorization: Bearer`, documente isso — a proteção passa a ser a
  ausência de credencial ambiente, e o CORS precisa ser restritivo.

### 5.5 Atalhos de desenvolvimento

Se existir qualquer bypass de autenticação para desenvolvimento, ele precisa de
uma trava de ambiente explícita, estar documentado aqui, e ser tratado como risco
enquanto existir em homologação. Preferência: não criar.

---

## 6. Observabilidade

### 6.1 As regras

1. **Log estruturado num barramento único, por canal.** Nada de `echo`,
   `var_dump`, `print_r` ou `console.log` em fluxo instrumentado. Eles continuam
   válidos apenas em scripts, seeds e no boot — antes de a composição existir.
2. **O logger é injetado por construtor**, pedido no composition root do módulo
   (`LogModule::loggerFor('customer')`). Pedir o logger de dentro do caso de uso é
   Service Locator e não passa na revisão (§3.2).
3. **Nunca espere por um log.** Log é síncrono para quem chama e o histórico é
   gravado em lote. Observabilidade não atrasa nem derruba o produtor.
4. **A redação de dados sensíveis é automática e central.** Segredo vira `***` em
   qualquer profundidade; telefone/CPF saem mascarados. Não redija na mão.
5. **Nunca amplie a exposição no código para depurar.** Detalhe fino vai em
   `logger->debug(...)`, capturado só com o *Debug Mode* daquele canal ligado — e
   que expira sozinho.

> **Por que a regra 5 existe.** Quando a única forma de depurar é ampliar a exposição no
> log, a ampliação costuma ficar — e token e dado pessoal passam a morar ali. Debug Mode por
> canal existe para que isso não precise acontecer.

6. **Correlação por `traceId`.** Um identificador por requisição, injetado no
   contexto e presente em toda linha — não passado adiante em assinatura de método.
7. **O armazenamento de log é dependência fraca.** Se o banco de logs cair, a
   aplicação sobe e responde normalmente; as entradas ficam na fila.

### 6.2 Na prática — PHP

- `traceId` gerado no front controller e guardado num contexto estático de request
  (em PHP, uma requisição = um processo, então isso é seguro e não é o singleton
  proibido do §3.2 — não sobrevive à requisição).
- Sinks: `stderr` (o servidor coleta) + tabela `system_log` no MySQL, gravada em
  lote no fim da requisição via `register_shutdown_function`, e **nunca** no meio
  do fluxo.
- Um `Logger` por canal: `auth`, `customer`, `http`, `integration`, `job`.
- Debug Mode por canal fica numa tabela de flags + master switch por variável de
  ambiente, com expiração automática.

```php
$this->logger->error('Falha ao transferir cliente', [
    'customerId'       => $customerId,
    'ownerId'  => $ownerId,
    'error'        => $e,          // o objeto; a redação cuida do resto
]);
```

---

## 7. Persistência e banco de dados

### 7.1 Repositório implementa a porta do domínio

O repositório só traduz domínio ↔ banco. Sem regra de negócio. Todo método público
do repositório existe na interface do gateway — método que não está na interface é
acoplamento escondido.

### 7.2 Consulta parametrizada, sempre

Nenhuma concatenação de valor em SQL. Nunca. Nem "só desta vez", nem para número,
nem para nome de tabela vindo de configuração.

```php
// ❌ injeção de SQL
$pdo->query("SELECT * FROM customer WHERE email = '{$email}'");

// ✅ prepared statement
$stmt = $pdo->prepare('SELECT id, nome, email FROM customer WHERE email = :email LIMIT 1');
$stmt->execute(['email' => $email]);
```

Conexão PDO obrigatoriamente com:

```php
new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES   => false,   // sem isto, o prepare é emulado no cliente
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_STRINGIFY_FETCHES  => false,
]);
```

Quando algo dinâmico for inevitável (ordenação, coluna de filtro), valide contra
uma **allowlist** de nomes conhecidos — nunca interpole o que veio do cliente.

### 7.3 Leitura sem limite é achado

- **Nunca** um `SELECT` sem `WHERE` **e** sem `LIMIT`. Toda listagem é paginada ou
  filtrada; o filtro vai para o banco, não para a memória.
- **Nunca** `SELECT *`. Liste as colunas — é o que protege o código de uma coluna
  nova sensível entrar de carona na resposta.
- **Sem N+1.** Uma consulta dentro de um laço vira uma consulta em lote
  (`WHERE id IN (...)`) + mapa em memória.
- Índice para toda coluna usada em `WHERE`, `JOIN` e `ORDER BY` de rota quente.
  Criação de índice é migration, nunca no boot da aplicação.

### 7.4 Transações e integridade

- Operação que escreve em mais de uma tabela roda dentro de uma transação. Valide
  o plano inteiro **antes** de escrever qualquer coisa.
- Chaves estrangeiras declaradas no banco (InnoDB), não só na aplicação.
- Exclusão de registro com histórico é **soft delete** (`excluido_em`), com o
  filtro aplicado nas leituras.
- `utf8mb4` no banco, nas tabelas e na conexão. `utf8` do MySQL não é UTF-8.

### 7.5 Migrations versionadas

Sem ORM com migração automática, o disciplinamento é manual e precisa ser estrito:

- Um arquivo `.sql` por mudança, numerado e imutável: `migrations/0007_cria_tabela_customer.sql`.
- Uma tabela `schema_migrations` registra o que já rodou.
- Um script (`php bin/migrate.php`) aplica o que falta, em ordem, dentro de
  transação, e é **idempotente** — ele roda a cada deploy.
- **Migration aplicada nunca é editada.** Corrija com uma nova.
- Toda migration destrutiva (drop/rename/alter que perde dado) precisa de backup
  verificado antes e de uma nota no PR.

### 7.6 Nomes de coluna em português

Se o banco usa nomes em português (`usuario`, `senha`, `email`), o mapeamento vive
**apenas no repositório**: o resto do código usa os nomes em inglês da entidade.
Sem ORM, esse mapeamento é explícito — e é mais uma razão para não usar `SELECT *`.

```php
private function toEntity(array $row): Customer
{
    return Customer::with(
        id:        (int) $row['id'],
        name:      $row['nome'],
        phone:     $row['telefone'],
        createdAt: new \DateTimeImmutable($row['criado_em']),
    );
}
```
---

## 8. Nomenclatura, idioma e estilo

### 8.1 Idioma

| Tipo de informação | Idioma |
|---|---|
| Lógica, variáveis, funções, classes, entidades | **Inglês** |
| Dados exibidos ao usuário | **Português** |
| Mensagens de erro que chegam ao cliente | **Português** |
| Comentários técnicos | **Português** |
| Nomes de tabela/coluna (se o banco for em português) | **Português**, só no banco |

### 8.2 Convenções de escrita

| Elemento | Padrão | Exemplo |
|---|---|---|
| Variáveis, funções, métodos | `camelCase` | `customerName`, `findById()` |
| Classes, entidades, casos de uso | `PascalCase` | `CreateCustomerUseCase`, `InternalNote` |
| Constantes globais | `UPPER_SNAKE_CASE` | `DEFAULT_PAGE_SIZE` |
| Arquivos de código PHP (PSR-4) | `PascalCase.php` | `CustomerRepositoryPdo.php` |
| Arquivos de JS/CSS/assets | `kebab-case` | `customer-card.js`, `design-tokens.css` |
| Repositórios | sufixo da tecnologia | `CustomerRepositoryPdo.php` |
| Rotas | sufixo `Route` | `CreateCustomerRoute.php` |
| Testes | sufixo `Test` | `CreateCustomerUseCaseTest.php` |

- Variáveis, funções e métodos começam com minúscula; classes e entidades com
  maiúscula.
- Sem abreviação que prejudique a leitura.
- Sem nome genérico: `data`, `item`, `obj`, `aux`, `temp`, `teste` — a menos que o
  contexto imediato torne o significado óbvio.
- PHP: `declare(strict_types=1);` no topo de **todo** arquivo. Tipos declarados em
  parâmetros, retornos e propriedades.

### 8.3 Comentários

Comentário explica **por que**, não **o que**. Escreva-o em português, para quem
vai manter o código:

```php
// ❌ Soma dois valores
$total = $a + $b;

// ✅ Mantém compatibilidade com clientes antigos que ainda não têm origem normalizada.
$originId = $customer->originId ?? self::FALLBACK_ORIGIN_ID;
```

Vale comentar: regra de negócio não óbvia, decisão técnica com alternativa
descartada, integração externa, armadilha conhecida. Não vale comentar código
óbvio — nem deixar código comentado (o histórico do Git guarda).

### 8.4 Clean Code — o mínimo

- Funções pequenas, com uma responsabilidade.
- Sem duplicação: a terceira ocorrência vira função.
- Preferir o simples ao engenhoso.
- Sem código morto, sem import não usado, sem branch inalcançável.

---

## 9. Configuração, constantes e segredos

### 9.1 Segredos

- **Nenhum segredo no repositório.** Nem chave, nem token, nem senha, nem
  "temporariamente".
- **Nenhum fallback literal ao lado da variável de ambiente.** `getenv('JWT_SECRET')
  ?: 'segredo123'` é um segredo commitado com passo extra. Se a variável faltar, **a
  aplicação falha ao subir**, alto e claro.
- `.env` no `.gitignore` desde o primeiro commit, com um `.env.example` (só nomes,
  sem valores) versionado.
- Segredo que já foi commitado uma vez precisa de **rotação**, não de remoção.
  Apagar do código não apaga do histórico nem dos clones.
- Em PHP: `.env` **fora** do document root, lido no bootstrap. Nunca
  `public/config.php` com credencial.

```php
// src/Shared/Config/Env.php
public static function required(string $key): string
{
    $value = getenv($key);
    if ($value === false || $value === '') {
        // Falha no boot é melhor do que subir com segredo default.
        throw new \RuntimeException("Variável de ambiente obrigatória ausente: {$key}");
    }
    return $value;
}
```

### 9.2 Constantes

Sem string mágica e sem número solto. Valor reutilizado vira constante nomeada,
agrupada por contexto:

```php
final class AuthConstants
{
    public const TOKEN_EXPIRATION_SECONDS = 300;
    public const BCRYPT_COST              = 12;
    public const MAX_LOGIN_ATTEMPTS       = 5;
}
```

O que costuma virar constante: autenticação, permissões, configuração de
integração, mensagens padrão, status do sistema, valores fixos de regra de negócio.

### 9.3 Documentação de biblioteca

Toda dependência adicionada é documentada em `docs/bibliotecas.md`:

```md
## firebase/php-jwt
- Uso: assinatura e verificação dos tokens de sessão.
- Local: src/Infra/Crypto/JwtTokenVerifier.php
- Observação: algoritmo fixado em HS256 na verificação (evita algorithm confusion).
- Documentação: https://github.com/firebase/php-jwt
```

Sem framework, cada dependência é uma decisão consciente — e o `composer.lock`
**é versionado**.

---

## 10. Testes

### 10.1 A lei de ferro

```
NENHUM CÓDIGO DE PRODUÇÃO SEM UM TESTE FALHANDO ANTES
```

Escreveu o código antes do teste? Apague e recomece. Sem exceção:

- Não guarde "como referência".
- Não "adapte" enquanto escreve o teste.
- Apagar significa apagar.

**Exceções** (combine com um humano antes): protótipo descartável, código gerado,
arquivo de configuração.

### 10.2 RED → GREEN → REFACTOR

**RED — escreva o teste que falha.** Um comportamento, nome claro, código real
(mock só quando inevitável).

**Verifique o RED — obrigatório, nunca pule.** Rode e confirme que:
- o teste **falha** (não dá erro de sintaxe/import);
- a mensagem de falha é a esperada;
- falha porque o comportamento não existe, não por typo.

> Se o teste passa de primeira, ele está testando comportamento que já existia.
> Conserte o teste. Se você não viu o teste falhar, você não sabe se ele testa
> alguma coisa.

**GREEN — o código mínimo que faz passar.** Nada de opções, parâmetros e ganchos
"para o futuro" (YAGNI).

**Verifique o GREEN.** O teste passa, os outros continuam passando, e a saída está
limpa (sem warning, sem erro).

**REFACTOR — só depois do verde.** Remova duplicação, melhore nomes, extraia
helpers. **Nunca adicione comportamento** no refactor.

### 10.3 Por que a ordem importa

| Desculpa | Realidade |
|---|---|
| "Escrevo os testes depois para verificar" | Teste escrito depois passa de primeira. Passar de primeira não prova nada. |
| "Já testei manualmente todos os casos" | Teste manual é ad-hoc: sem registro, sem repetição, esquecido sob pressão. |
| "Apagar X horas de trabalho é desperdício" | Custo afundado. O desperdício é manter código em que você não confia. |
| "Teste depois atinge o mesmo objetivo" | Teste depois responde "o que isso faz?". Teste antes responde "o que isso deveria fazer?" |
| "TDD é dogmático, quero ser pragmático" | TDD **é** pragmático: acha o bug antes do commit, documenta o comportamento e libera o refactor. |
| "É simples demais para testar" | Código simples quebra. O teste leva 30 segundos. |
| "Teste difícil = design ruim" | Verdade — e o recado é do teste: difícil de testar é difícil de usar. |

### 10.4 Antipadrões de teste

1. **Testar o mock em vez do comportamento.** Se a asserção prova que o mock
   existe, apague a asserção ou remova o mock.
2. **Método só-para-teste em classe de produção.** Vai para os utilitários de
   teste. Um `destroy()` que só o teste chama é perigoso em produção.
3. **Mockar sem entender a dependência.** Antes de mockar, pergunte quais efeitos
   colaterais o método real tem e se o teste depende deles. Mock alto demais faz o
   teste passar pelo motivo errado. Na dúvida: rode com a implementação real
   primeiro, veja o que é necessário, e só então mocke no nível mais baixo.
4. **Mock incompleto.** Espelhe a estrutura **completa** da resposta real, não só
   os campos que este teste usa — o código a jusante lê os outros.
5. **Teste como etapa posterior.** "Implementação pronta, falta testar" não é
   pronto.

**Sinais de alerta:** setup do mock maior que o teste; teste quebra quando o mock
muda; você não sabe explicar por que aquele mock existe; "vou mockar só por
segurança".

### 10.5 Convenções

- Testes espelham a estrutura de `src/`, um arquivo por unidade.
- Descrições em **português**, descrevendo comportamento:
  `testRejeitaNotaVaziaComValidationError`.
- Um `makeSut()` (ou `setUp`) monta a unidade sob teste com dublês simples dos
  gateways — as interfaces do domínio existem justamente para isso.
- Cobertura obrigatória por caso de uso: **caminho feliz**, **cada validação**,
  **cada regra de autorização** (dono, não-dono, nível insuficiente) e **o efeito
  que não pode acontecer** quando o acesso é negado.
- Bug corrigido entra com o teste que o reproduz. Sem exceção.

### 10.6 Na prática — PHP (PHPUnit)

```php
<?php declare(strict_types=1);

namespace Tests\UseCases\Customer;

use PHPUnit\Framework\TestCase;

final class CreateCustomerUseCaseTest extends TestCase
{
    private function makeSut(): array
    {
        $gateway = $this->createMock(CustomerGateway::class);
        $sut = CreateCustomerUseCase::create($gateway, new NullDispatcher(), new NullLogger());
        return [$sut, $gateway];
    }

    public function testPersisteOCustomerERetornaODtoDeSaida(): void
    {
        [$sut, $gateway] = $this->makeSut();
        $gateway->expects($this->once())->method('save')->willReturnArgument(0);

        $output = $sut->execute(new CreateCustomerInput(name: 'Ana', phone: '12999999999'));

        $this->assertSame('Ana', $output->name);
    }

    public function testRejeitaNomeVazioComValidationError(): void
    {
        [$sut] = $this->makeSut();
        $this->expectException(ValidationError::class);
        $sut->execute(new CreateCustomerInput(name: '', phone: '12999999999'));
    }
}
```

Portões antes de considerar pronto:

```bash
composer test          # phpunit
composer stan          # phpstan --level=8 (o equivalente ao "compilador rigoroso")
php -l <arquivo>       # lint de sintaxe
```

---

## 11. Depuração sistemática

```
NENHUMA CORREÇÃO SEM INVESTIGAÇÃO DE CAUSA RAIZ ANTES
```

Correção de sintoma é falha. Use este processo **especialmente** quando houver
pressa: sistemático é mais rápido que chutar.

### Fase 1 — Investigar a causa raiz

1. **Leia a mensagem de erro inteira.** Stack trace completo, número de linha,
   código do erro. Ela frequentemente contém a solução.
2. **Reproduza de forma consistente.** Quais passos exatos? Acontece sempre? Se
   não reproduz, colete mais dados — não adivinhe.
3. **Verifique o que mudou.** `git diff`, commits recentes, dependência nova,
   configuração, diferença de ambiente.
4. **Instrumente as fronteiras** (quando há vários componentes): registre o que
   entra e o que sai de cada camada, rode uma vez, e descubra **onde** quebra antes
   de investigar **por que**.
5. **Rastreie o dado para trás.** Onde o valor ruim nasceu? Quem chamou com ele?
   Suba até a origem e corrija lá — não no sintoma.

### Fase 2 — Analisar o padrão

Ache um caso parecido que **funciona** no próprio projeto. Leia a implementação de
referência inteira (não passe o olho). Liste **todas** as diferenças, por menores
que sejam — "isso não pode importar" é onde o bug mora.

### Fase 3 — Hipótese e teste

Uma hipótese por vez, escrita: "acho que X é a causa porque Y". Teste com a
**menor** mudança possível. Não funcionou? Formule uma **nova** hipótese — não
empilhe correções.

### Fase 4 — Corrigir e proteger

Escreva o teste que reproduz o bug (RED), corrija (GREEN) e deixe o teste como
regressão. Se a mesma classe de bug pode voltar em outro ponto, corrija a classe.

---

## 12. Frontend

Com JavaScript vanilla, HTML e CSS puros, a disciplina precisa vir do padrão — não
existe framework para impô-la.

### 12.1 Organização

```
public/
├── index.html
├── assets/
│   ├── css/
│   │   ├── tokens.css        ← variáveis: cores, tipografia, espaçamento, sombra
│   │   ├── base.css          ← reset + elementos
│   │   └── components/       ← um arquivo por componente
│   └── js/
│       ├── core/             ← api.js, router.js, dom.js, state.js, format.js
│       ├── components/       ← componentes reutilizáveis (botão, modal, tabela)
│       └── features/<feature>/  ← telas e a lógica daquela feature
```

Use **ES Modules** (`<script type="module">`): `import`/`export` explícitos, sem
variável global, sem ordem de `<script>` importando.

### 12.2 Chamadas ao backend em um único lugar

Nenhum `fetch` espalhado por componente. Um cliente central concentra base URL,
cabeçalhos, token, tratamento de erro e parse:

```js
// core/api.js
const BASE_URL = document.querySelector('meta[name="api-base"]').content;

export async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    signal,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A mensagem em português vem do backend (§4). O front NÃO inventa texto de erro.
    throw new ApiError(payload.message ?? 'Erro inesperado. Tente novamente.', response.status);
  }
  return payload;
}
```

### 12.3 Segurança do frontend

- **XSS é a falha número um aqui.** Padrão: `textContent`. `innerHTML` só com
  string montada de literais do próprio código — **nunca** concatenando dado do
  usuário ou da API. Se precisar de HTML dinâmico, escape explicitamente ou monte
  os nós com `document.createElement`.
- Nunca `eval`, `new Function`, `element.setAttribute('on*', ...)` ou
  `javascript:` em href.
- Validação no cliente é **UX**, não segurança. Toda regra vale de novo no servidor.
- Token de sessão: preferir cookie `HttpOnly` (JS não lê) a `localStorage` — o que
  o JS lê, um XSS lê.
- Nada de segredo no bundle: chave de API, credencial ou regra de preço no
  JavaScript é público.
- Defina um `Content-Security-Policy` desde o começo — é barato no projeto novo e
  caro depois.

### 12.4 Estilo e tokens

Todo valor visual recorrente vira **custom property** em `tokens.css`; componente
não carrega hex solto.

```css
:root {
  --color-primary: #304363;
  --color-surface: #ffffff;
  --radius-default: 8px;
  --space-card: 16px;
}
[data-theme="dark"] { --color-surface: #14181f; }
```

```html
<!-- ❌ --> <div style="background:#304363;padding:16px;border-radius:8px">
<!-- ✅ --> <div class="card card--primary">
```

### 12.5 Responsabilidades

- **Página**: compõe componentes, ajusta layout, dispara o carregamento. Sem regra
  de negócio, sem estilização específica embutida.
- **Componente**: recebe dados, renderiza, emite eventos. Não busca dados sozinho.
- **Módulo de feature**: fala com `core/api.js`, guarda o estado daquela tela e
  entrega os dados prontos ao componente.
- Sem estado global mutável espalhado: um módulo de estado por feature, exportando
  funções — não um objeto compartilhado que qualquer arquivo escreve.
---

## 13. Git, branches, commits e PR

### 13.1 GitFlow

| Branch | Finalidade |
|---|---|
| `development` | Integração do desenvolvimento. **Base de toda feature.** |
| `main` | Homologação / testes |
| `release` | Produção |
| `feature-*` | Nova funcionalidade |
| `bugfix-*` | Correção |

### 13.2 Duas regras que já custaram incidente

> **Nunca use `/` (nem `\`) em nome de branch — use hífen.**
> `feature-exportar-relatorio`, `bugfix-erro-status`. O Git guarda refs como arquivos:
> `refs/heads/bugfix` (arquivo) e `refs/heads/bugfix/algo` (que exige `bugfix` como
> diretório) **não coexistem**. Basta alguém criar uma branch chamada `bugfix` uma
> vez para todo `bugfix/*` passar a ser rejeitado no push, deixando o repositório
> local meio-trocado. A regra do hífen vale para todos os namespaces, para que isso
> nunca reabra.

> **Sempre crie branch com `--no-track`:**
> ```bash
> git switch -c feature-nome --no-track origin/development
> git push -u origin feature-nome     # o -u define o upstream correto
> ```
> `git checkout -b nome origin/development` **herda `origin/development` como
> upstream**, e clientes gráficos empurram para o upstream configurado em vez de
> uma branch de mesmo nome. Resultado: os commits caem direto na branch base, sem
> PR, sem revisão, e disparam o deploy dela. Os sintomas enganam — a branch nunca
> aparece no remoto e o cliente diz que não há diferença (correto: a base tem os
> mesmos commits). `git branch -vv` mostra o upstream antes do push.

Complementos:
- Nome de branch claro e específico. Nada de `ajustes`, `teste`, `correcao`, `fix`.
- Nunca `git pull`/`merge` sem alinhar com quem toca no repositório.
- Antes de começar qualquer trabalho: sincronize a base e confirme que **o build
  está verde**. Começar sobre base quebrada mistura o seu erro com o de outro.

### 13.3 Commits

Conventional Commits com descrição **em português**, no presente:

```
tipo(escopo): descrição curta no imperativo

feat(customer): expõe as etiquetas do cliente nas leituras
fix(api): encerra o servidor graciosamente em SIGTERM
perf(build): reordena as camadas do build e tira os testes da imagem
docs(api): referência das etiquetas de cliente para o frontend
refactor(customer): unifica a regra de acesso por objeto ao cliente
chore(deps): fixa a versão do gerenciador de pacotes
```

Tipos: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`.
Um commit = uma ideia. Se o título precisa de "e", são dois commits.

### 13.4 Estimativa e quebra de tarefa

| Pontos | Tempo | Orientação |
|:--:|:--:|---|
| 1 | ½ dia | Pequena e bem definida |
| 2 | 1 dia | Simples, baixo risco |
| 3 | 1–2 dias | Moderada, alguma regra de negócio |
| 5 | 3 dias | Complexa, integração ou múltiplas etapas |
| 8 | 1 semana | Grande, alto esforço ou risco técnico |
| 8+ | — | **Quebrar a tarefa** |

Tarefa acima de 8 pontos é quebrada. Tarefa grande impede estimativa realista,
revisão de código, teste, entrega incremental e leitura de risco.

---

## 14. Auditoria contínua e ledger de achados

O que faz a qualidade parar de regredir não é a auditoria — é o **registro do que
foi encontrado e o que aconteceu depois**. Três artefatos, com contrato estrito
para que qualquer pessoa (ou agente) leia sem interpretar prosa.

| Arquivo | Papel | Mutabilidade |
|---|---|---|
| `docs/audits/open-findings.md` | Ledger de todos os achados **Critical** e **High** e o status atual | Mutável — linhas mudam de status, novas são anexadas |
| `docs/audits/audit-metrics.jsonl` | Uma linha por execução de auditoria: custo, duração, contagens | Append-only — nunca edite linha existente |
| `docs/audits/AAAA-MM-DD-*.md` | Relatórios completos com evidência | **Imutáveis** — nunca editados depois de salvos |

### 14.1 Contrato do ledger

Colunas: `ID | Severidade | CVSS | Achado | Local | Origem | Status | Responsável | Aberto | Fechado`

- `ID`: `OF-NNN`, sequencial, **nunca reutilizado nem renumerado**.
- `Severidade`: só `CRITICAL` ou `HIGH` (Medium/Low ficam no relatório de origem).
- `CVSS`: v3.1 para achados de segurança; `—` para qualidade.
- `Status`: `open` | `in-progress` | `fixed` | `verified` | `accepted-risk` | `duplicate`.
- Quem escreve o quê:
  - **Auditores** anexam linhas novas e podem virar `fixed → verified` (ou de volta
    para `open`) conforme o código mostra. **Nunca corrigem código.**
  - **Quem corrige** vira `open → in-progress → fixed` e preenche o responsável.
  - `accepted-risk` exige uma linha de justificativa nas notas.
- Achado duplicado tem **uma** linha, listando todas as origens.

### 14.2 Como o ledger entra no dia a dia

**Antes de começar qualquer trabalho, leia o ledger.** Se a sua mudança toca um
local listado: corrija o achado e atualize a linha; no mínimo, **não piore**.

Na seção de notas do ledger, registre a conformidade de cada superfície nova:
"a rota X nasce protegida no nível Y (OF-001), lança erro de domínio em vez de
definir status na mão (OF-012) e não introduz leitura sem limite (OF-013)". Isso é
o que permite, meses depois, saber se um achado cresceu ou ficou parado.

### 14.3 Métricas

Uma linha JSON por execução, anexada ao fim de `audit-metrics.jsonl`:

```json
{"date":"2026-09-04","agent":"quality-auditor","model":"opus","scope":"diff","branch":"feature-x","duration_ms":0,"output_tokens":0,"tool_uses":0,"critical":0,"high":1,"medium":3,"low":2,"marker":"HIGH_ONLY","report":"docs/audits/2026-09-04_feature-x_0c-1h-3m-2l_diff.md"}
```

`duration_ms`/`output_tokens`/`tool_uses`: use o dado real quando existir, `null`
quando não souber — **nunca chute**. Serve para análise de tendência: custo por
execução, taxa de achados, calibragem de falso-positivo.

---

## 15. Camada de agentes de IA

O sistema tem quatro peças: **um documento de contexto** que todo agente lê, **três
agentes especializados**, **duas skills de método** e **hooks** que impedem comando
destrutivo. As definições completas, prontas para colar, estão no §18.

### 15.1 O documento de contexto (`CLAUDE.md`)

Fica na raiz e é lido em toda sessão. Deve conter **o que não se descobre lendo o
código**:

- Comandos do projeto e **por que** cada passo não-óbvio do build existe.
- Arquitetura e fronteiras de camada.
- As armadilhas específicas do repositório (o "isto parece opcional e não é").
- Como logar, como tratar erro, como proteger rota.
- Um ponteiro para o ledger de achados abertos.
- As convenções de idioma e de branch.

> **Regra de manutenção:** quando uma regra muda (ex.: o tratamento de erro passou a
> ser centralizado), atualize **todos** os documentos que a descrevem no mesmo PR.
> Documento desatualizado ensina o agente a reintroduzir o defeito: a definição de um
> agente que ainda descreve o tratamento de erro antigo continua mandando fazer do jeito
> errado depois da correção.

### 15.2 Os três agentes

| Agente | Papel | Quando |
|---|---|---|
| `feature-architect` | Implementa a feature ponta a ponta: testes falhando primeiro, depois domínio → caso de uso → repositório → rota → composition root | Toda feature nova |
| `quality-auditor` | Auditoria de qualidade, performance, correção e convenção. **Nunca altera código.** | Antes de push/PR (gatilho automático), antes de release, saúde semanal |
| `security-auditor` | SAST + revisão arquitetural de segurança, achados pontuados em CVSS v3.1. **Nunca altera nem executa código.** | Antes de release; após mudança em auth/permissão/webhook/integração; após publicar endpoint |

Regras que fazem esse trio funcionar:

1. **Auditor não corrige; corretor não audita.** Separar os papéis é o que evita o
   agente "achar" e "consertar" a mesma coisa sem evidência.
2. **Escrever o relatório é a única operação de escrita permitida ao auditor.**
3. **Temperatura baixa nos auditores** (0.1) e média no implementador (0.2–0.3).
4. **O implementador constrói para passar na auditoria.** As dimensões dos
   auditores são o critério de aceite dele, não uma surpresa no fim (§17).
5. **Todo achado cita `arquivo:linha` + trecho de código.** Sem evidência não é
   achado. O que não é comprovável estaticamente é marcado como "requer verificação
   dinâmica".
6. **Severidade honesta.** Nada de inflar Low para parecer minucioso, nem suavizar
   Critical.
7. **Relatório termina com um marcador em linha própria:** `CRITICAL_FOUND`,
   `HIGH_ONLY` ou `CLEAN` — é o que permite automatizar o portão.

### 15.3 Escopo: `full` vs `diff`

- `scope: full` — a base inteira. Antes de release e na revisão periódica.
- `scope: diff` — só o conjunto de mudanças (`git diff --name-only <base>...HEAD` +
  não-commitado), **mais o raio de alcance**: o composition root que registra a
  rota alterada, a interface do repositório alterado, o registro do handler
  alterado. O que for notado fora do escopo vai para uma seção final
  "Fora de escopo — notado", nunca é descartado em silêncio.
- Dimensões de acesso e autenticação **voltam a `full`** se o diff tocar o guard de
  rota, geração/verificação de token, sessão ou o front controller — mudança ali
  tem efeito em todo o repositório.

### 15.4 As skills

- **`systematic-debugging`** — as quatro fases do §11. Nenhuma correção antes da
  Fase 1.
- **`design-system-css`** — tokens, dois temas, variantes por classe, refluxo e
  acessibilidade, em CSS puro.

Elas existem para serem invocadas **antes** de escrever código ou propor correção —
é o que impede o atalho sob pressão. O ciclo RED-GREEN-REFACTOR não virou skill: a
fronteira de onde o TDD é estrito é decisão de projeto e vive no ADR-004.

### 15.5 Hooks e permissões

Um hook `PreToolUse` bloqueia comandos destrutivos **antes** das permissões, e
vence todas elas. A lista mora num arquivo de texto editável (uma linha = um
padrão, `#` comenta):

```
# Envio ao remoto — o push é sempre humano
git push

# Reescrita de histórico / perda de dados
git reset --hard
git clean\s+.*-{1,2}\w*f
git stash clear
git stash drop
git filter-branch
git reflog expire
git update-ref\s+.*-d

# Banco — operações destrutivas
DROP\s+DATABASE
DROP\s+TABLE
TRUNCATE\s+TABLE
mysql .*<.*dump          # restaurar por cima do banco errado
php bin/migrate.php --fresh
```

E as permissões da sessão negam o que nunca deve ser lido ou executado:

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./**/.env)",
      "Bash(git push:*)",
      "Bash(php bin/migrate.php --fresh:*)"
    ],
    "ask": ["Bash(rm -rf *)", "Bash(curl *)"]
  }
}
```

> **Cuidado com padrão largo demais.** `rm -rf` bloqueado inteiro derruba usos
> legítimos do build. Prefira padrões específicos.

### 15.6 Fluxos

```
Feature nova
1. Sessão principal   — plano e testes falhando, domínio → caso de uso → repositório → rota → módulo
2. quality-auditor    — scope: diff
3. security-auditor   — scope: diff se tocou auth/permissão/webhook/endpoint público

Correção de bug
1. systematic-debugging      — causa raiz (Fases 1–3 antes de qualquer correção)
2. Teste que reproduz o bug  — vermelho antes da correção (ADR-004)
3. Implementar a correção

Antes do push / PR
1. quality-auditor scope: diff — revisar CRITICAL e HIGH
2. Corrigir os bloqueadores
3. Push

Release
1. quality-auditor  scope: full
2. security-auditor scope: full
3. CRITICAL bloqueia o release
```
---

## 16. Deploy e infraestrutura

Regras vindas de incidentes reais. Todas passaram por revisão e por teste sem
serem detectadas — só apareceram no deploy.

### 16.1 Ambientes

- **Um app de deploy por branch** (`main` = homologação, `release` = produção), cada
  um com as próprias variáveis. Um log de deploy conta o que **uma** execução fez —
  nunca deduza a topologia dele, e sempre diga **de qual** ambiente você fala.
- Versões **iguais** em dev e produção: a mesma major do PHP, a mesma major do
  MySQL, a mesma versão do Composer. Divergência de versão de ferramenta é a classe
  de bug que passa em todo teste e só quebra no build.
- `composer.lock` versionado, e produção instala com
  `composer install --no-dev --optimize-autoloader` — nunca `update`.

### 16.2 Build e publicação

- **Dependências antes do código.** Copie o manifesto, instale, e só então copie o
  código-fonte. Invertido, cada commit reinstala tudo.
- Não empacote teste, `.git`, `.env` nem ferramenta de desenvolvimento na imagem
  publicada.
- Em PHP: `opcache` ligado em produção, `opcache.validate_timestamps=0` e **reset
  do opcache no deploy** — sem isso, o código novo pode não entrar.
- Recarregue o servidor de forma graciosa (`nginx -s reload`, `systemctl reload
  php-fpm`), para não cortar requisição em voo.

### 16.3 Migração e seed rodam a cada deploy

Portanto: **idempotentes**. E o seed nunca cria usuário administrativo com senha
fixa: um seed que reescreve senha e permissão de admin a cada deploy é uma porta dos
fundos que se auto-restaura. Se precisar de um primeiro usuário, gere senha aleatória e
force a troca no primeiro acesso.

### 16.4 Banco

- Antes de qualquer migration destrutiva: backup **verificado** e uma foto do
  "antes" (contagem e amostra de linhas).
- Para testar migration de verdade, restaure uma cópia de produção localmente.
- Serviço de banco e de cache **não ficam expostos em IP público**. Se precisar de
  acesso remoto, use rede privada ou túnel, sempre com TLS.

### 16.5 Segredo em log de deploy

Log de deploy costuma imprimir variáveis de build em texto claro. Trate log de
deploy como material sensível: não cole em ticket, chat ou issue, e mantenha a
pasta de investigações **fora do Git**.

---

## 17. Checklists

### 17.1 Definition of Done — qualidade

- [ ] Fronteiras de camada respeitadas (`domain` sem banco/HTTP/cache; `usecases` sem `infra`).
- [ ] Sem regra de negócio em rota ou repositório.
- [ ] Nenhum detalhe de banco em mensagem exibida ao usuário.
- [ ] Sem valor mágico: nível de permissão vem do enum; status, do domínio; número/string reutilizado é constante nomeada.
- [ ] Toda escrita em cache tem TTL.
- [ ] Sem N+1: nenhuma consulta dentro de laço.
- [ ] Sem leitura ilimitada: todo `SELECT` tem `WHERE` e/ou paginação; nenhum `SELECT *`.
- [ ] Handler de evento nunca lança — corpo em try/catch, só log.
- [ ] Sem tipo `mixed`/`any` de conveniência; DTOs de entrada e saída explícitos.
- [ ] Nenhum caso de uso chamando outro caso de uso.
- [ ] Erros lançados são subclasses de domínio, com mensagem em português.
- [ ] Nomenclatura e idioma conforme §8.
- [ ] Sem código morto e sem `echo`/`var_dump`/`console.log` em fluxo instrumentado.
- [ ] Log estruturado pelo logger **injetado**.

### 17.2 Definition of Done — segurança

- [ ] Toda rota registrada com guard, no nível mínimo adequado; rota pública justificada por escrito.
- [ ] Nível de permissão condiz com a operação (destrutiva/administrativa fora do nível mais baixo).
- [ ] IDOR coberto: toda leitura/alteração por id verifica posse/equipe/nível vindo do **token**.
- [ ] Sem mass assignment: corpo desestruturado campo a campo.
- [ ] Sem segredo commitado e sem fallback literal ao lado da variável de ambiente.
- [ ] Senha com hash forte; código de recuperação criptográfico, com validade curta e limite de tentativas.
- [ ] Sessão com TTL; logout invalida no servidor; troca de senha invalida as sessões.
- [ ] SQL sempre parametrizado; nome dinâmico só por allowlist.
- [ ] Nenhum dado sensível em resposta ou log (token, credencial, metadado do banco).
- [ ] Saída no HTML escapada; `innerHTML` sem dado do usuário.
- [ ] Webhook/endpoint público valida assinatura ou segredo compartilhado e resiste a replay.
- [ ] Rate limit nos endpoints de autenticação e nos públicos.

### 17.3 Checklist de Pull Request

- [ ] Branch criada a partir da base correta, com `--no-track`, e o nome usa hífen.
- [ ] Ledger de achados consultado; nenhuma linha piorada, e as tocadas foram atualizadas.
- [ ] Testes escritos **antes** e a suíte está verde.
- [ ] Análise estática sem erro.
- [ ] Responsabilidades separadas; sem regra de negócio fora de lugar.
- [ ] Mensagens ao usuário em português, claras, sem detalhe técnico.
- [ ] Biblioteca nova documentada.
- [ ] Este documento atualizado, se um padrão mudou.
- [ ] Tarefa atualizada no board.

### 17.4 Checklist de criação de tarefa

- [ ] Título claro.
- [ ] Descrição explica o problema ou a necessidade.
- [ ] Tem critério de aceite.
- [ ] Story points definidos e **≤ 8** (acima disso, quebrar).
- [ ] Dependências técnicas informadas.
- [ ] Escopo delimitado e compreensível.

---

## 18. Anexos prontos para colar

### Anexo A — `CLAUDE.md` do repositório novo

```markdown
# CLAUDE.md

Guia para agentes que trabalham neste repositório. **Os padrões completos estão em
`PADROES.md` — leia-o antes de escrever código.**

## Projeto
[Nome] — backend em PHP sem framework (PSR-4 via Composer), MySQL,
frontend em JavaScript vanilla + HTML/CSS puros.

## Comandos
- `composer install` — dependências.
- `php -S localhost:8000 -t public` — servidor de desenvolvimento.
- `composer test` — PHPUnit.
- `composer stan` — análise estática (PHPStan level 8).
- `php bin/migrate.php` — aplica as migrations pendentes (idempotente; roda no deploy).

Variáveis obrigatórias (`.env`, fora do document root): `DB_DSN`, `DB_USER`,
`DB_PASS`, `JWT_SECRET`, `APP_ENV`. A aplicação falha ao subir se faltar alguma —
não existe valor default.

## Arquitetura
Clean Architecture: `src/Domain` (livre de framework) ← `src/UseCases` ←
`src/Infra`; `src/Modules/<Feature>Module.php` é o composition root; `public/index.php`
é o único arquivo no document root. Detalhes em `PADROES.md` §2.

## Regras que mais aparecem em revisão
- Rota registrada **sempre** via `guard(...)` com nível mínimo (`PADROES.md` §5.1).
- Status HTTP vem da classe de erro lançada; nunca defina status na rota (§4.2).
- Log pelo `Logger` **injetado** por construtor; nunca `echo`/`var_dump` (§6).
- SQL sempre parametrizado; sem `SELECT *`; sem leitura sem `LIMIT` (§7).
- Antes de começar: leia `docs/audits/open-findings.md` (§14).

## Convenções
Código e identificadores em inglês; mensagens ao usuário, erros e comentários em
português. Branch com hífen, criada com `--no-track` a partir de `development`.
```

### Anexo B — `.claude/agents/quality-auditor.md`

```markdown
---
name: quality-auditor
description: Auditoria técnica de qualidade, performance, correção e conformidade de convenção. Nunca altera código-fonte — salva o relatório em docs/audits/.
model: opus
temperature: 0.1
---

Você é o Auditor de Qualidade Técnica deste projeto. Sua missão é auditar a base de
código e produzir um relatório priorizado.

**Nunca altere código-fonte.** Escrever o arquivo de relatório é a única escrita
permitida.

## Escopo
`scope: full` (base inteira) ou `scope: diff` (mudanças + raio de alcance: o módulo
que registra a rota alterada, a interface do repositório alterado, o registro do
handler alterado). Em `diff`, anexe `_diff` ao nome do relatório e registre a base
no cabeçalho. O que for notado fora do escopo vai numa seção final
"Fora de escopo — notado".

## Dimensões

### CRITICAL
- **Violação de fronteira de camada.**
  `grep -rniE "PDO|mysqli|\\\$_(GET|POST|SERVER|SESSION)" src/Domain/`
  `grep -rn "use App\\\\Infra" src/UseCases/`
- **Regra de negócio em rota ou repositório.**
  `grep -rn "if\|switch\|throw" src/Infra/Http/Routes/`
- **Erro com detalhe técnico exposto ao usuário.**
  `grep -rniE "SQLSTATE|constraint|getMessage\(\)" src/ | grep -v Log`
- **Valor mágico.** Nível de permissão numérico, string de status solta.
  `grep -rnE "level *[><=]+ *[0-9]" src/`
- **Segredo com fallback literal.**
  `grep -rnE "getenv\(.+\) *\?: *['\"]" src/`

### HIGH
- Escrita em cache sem TTL.
- N+1: consulta dentro de laço — `grep -rn "foreach" -A5 src/Infra/Repository/ | grep -n "prepare\|query"`
- Leitura sem limite: `grep -rniE "select \*|from [a-z_]+ *(;|\")" src/Infra/Repository/`
- Handler de evento sem try/catch: `grep -rn "function handle" -A3 src/Infra/EventHandlers/`
- SQL concatenado: `grep -rnE "(query|prepare)\(.*\\\$" src/`

### MEDIUM
- Tipagem frouxa: arquivo sem `declare(strict_types=1)`, parâmetro/retorno sem tipo.
- Caso de uso chamando outro caso de uso.
- Corpo da requisição repassado inteiro (`$_POST`, `$request->body()` sem campo).
- Sessão não invalidada no logout.

### LOW
- Código morto, código comentado, import não usado.
- `echo`/`var_dump`/`print_r` em `src/Domain` ou `src/UseCases`.
- Método público de repositório que não existe na interface do gateway.

## Convenções (PADROES.md §8)
Nomenclatura, idioma (identificador em inglês, mensagem em português), nome de
arquivo, nome de branch. Nome de coluna em português no banco é **correto** — não
sinalize.

## Como conduzir
1. `composer stan` e `composer test` primeiro — erro de tipo e teste vermelho vêm antes de tudo.
2. Leia `CLAUDE.md` e `PADROES.md`.
3. Rode os comandos de cada dimensão e **leia o código ao redor de cada ocorrência**
   — nunca reporte um resultado de grep sem ler.
4. Cruze com `docs/audits/open-findings.md`: achado já catalogado referencia a linha
   existente, não vira ID novo.
5. Salve o relatório.

## Relatório
Sumário executivo com contagem por severidade e estimativa de correção; depois, por
severidade: **Local** (`arquivo:linha`), **Problema**, **Impacto**, **Correção**
(com código antes/depois). Seção final de convenções citando a seção do PADROES.md.

Salve em `docs/audits/AAAA-MM-DD_<branch>_<Xc-Yh-Zm-Nl>.md` e imprima o
caminho. Termine com **exatamente um** marcador na última linha:
`CRITICAL_FOUND`, `HIGH_ONLY` ou `CLEAN`.

## Critérios de sucesso
✓ Todo CRITICAL/HIGH com `arquivo:linha` ✓ Severidade justificada ✓ Toda questão
com correção concreta ✓ Nenhum código alterado ✓ Relatório salvo e caminho impresso
```

### Anexo C — `.claude/agents/security-auditor.md`

```markdown
---
name: security-auditor
description: SAST e revisão arquitetural de segurança — controle de acesso, autenticação, injeção, exposição de dados. Mentalidade adversarial Zero-Trust, achados pontuados em CVSS v3.1. Nunca altera nem executa código — salva o relatório em docs/audits/.
model: opus
temperature: 0.1
---

Você é o Agente de Auditoria de Segurança: engenheiro sênior de AppSec com prática
de Red Team, arquitetura defensiva e modelagem de ameaças. Conhece OWASP Top 10,
CWE e arquiteturas Zero-Trust.

**Mentalidade — adversarial e Zero-Trust.** Toda entrada é maliciosa, toda
dependência é potencialmente comprometida, a rede interna é hostil. Para cada
endpoint pergunte: "o que acontece se eu chamar sem token, com o id de outro
usuário, ou com um payload forjado?"

**Restrições rígidas:**
- **Nunca altere código.** O relatório é a única escrita.
- **Nunca execute a aplicação.** Sem subir servidor, sem migration, sem requisição
  contra endpoint vivo. Só análise estática.
- **Toda afirmação com evidência:** `arquivo:linha` + trecho. O que não for
  comprovável estaticamente é marcado "requer verificação dinâmica".

## Dimensões (CVSS v3.1: Crítico 9.0–10, Alto 7.0–8.9, Médio 4.0–6.9, Baixo 0.1–3.9)

### A. Controle de acesso quebrado (A01; CWE-862/863/284)
- **Cobertura de proteção de rota — a checagem de maior rendimento.** Liste **toda**
  rota registrada em cada `src/Modules/*Module.php` e confronte com os `guard(...)`.
  Rota que trata dado pessoal sem guard é **Crítico**.
  `grep -rn "guard(" src/Modules/` · `grep -rn "Route::create" src/Modules/`
- **Adequação do nível:** operação destrutiva/administrativa alcançável no nível mais baixo.
- **IDOR:** todo caso de uso que busca por id verifica posse/equipe/nível, não só existência.
  `grep -rn "findById\|findBy" src/UseCases/`
- **Mass assignment:** `grep -rnE "\\\$_(POST|GET)\b|body\(\)" src/Infra/Http/Routes/`

### B. Autenticação e sessão (A07; CWE-287/384/613)
- Segredo commitado ou fallback literal: `grep -rnE "getenv\(.+\) *\?:" src/`
- JWT: algoritmo fixado na verificação, validade, revogação real no logout.
- Hash de senha (custo), código de recuperação (`rand`/`mt_rand` é achado), limite
  de tentativas, enumeração de usuário por mensagem distinta.
  `grep -rn "password_hash\|password_verify\|mt_rand\|rand(" src/`
- Cookie de sessão: `HttpOnly`, `Secure`, `SameSite`; `session_regenerate_id` no login.

### C. Injeção (A03; CWE-89/78/79)
- SQL concatenado: `grep -rnE "(query|exec|prepare)\(.*(\\\$|\.)" src/`
- Comando de SO: `grep -rn "exec(\|shell_exec\|system(\|passthru\|popen" src/`
- XSS no frontend: `grep -rn "innerHTML\|outerHTML\|document.write\|eval(" public/assets/js/`
- XSS no servidor: saída sem `htmlspecialchars` em template.
- Inclusão de arquivo com entrada do usuário: `grep -rnE "(include|require)(_once)? *\(?\\\$" src/ public/`

### D. Exposição de dado sensível (A02/A04; CWE-200/209/532)
- Metadado do banco em mensagem ao usuário; token/credencial em resposta ou log.
- `display_errors` ligado em produção.
- Segredo em arquivo não-fonte: `.env*`, configuração de CI, seed, scripts de deploy.

### E. Superfície não autenticada
- Webhook e rota pública: validam assinatura/segredo? há proteção contra replay?
  Um payload forjado cria registro, injeta mensagem ou dispara envio?
- Upload de arquivo: tipo validado pelo conteúdo, destino fora do document root,
  nome gerado pelo servidor.

### F. Endurecimento da plataforma (A05; CWE-16/770)
- Rate limit, cabeçalhos de segurança (CSP, HSTS, X-Content-Type-Options), política
  de CORS (`*` com credencial é achado), limite de tamanho de corpo.
- `composer audit` (só lê o lock) e dependências sem manutenção.

## Como conduzir
1. Leia `CLAUDE.md` e `PADROES.md`.
2. **Mapeie a superfície de ataque primeiro:** tabela com toda rota — método,
   caminho, protegida?, nível, observação. Ela ancora a dimensão A e vai no relatório.
3. Aplique A–F; leia cada arquivo sinalizado.
4. Pontue: vetor CVSS v3.1 + nota, CWE, categoria OWASP 2021. Sem inflar, sem suavizar.
5. Escreva o relatório em Markdown, detalhado.

## Relatório
Sumário executivo (o que um atacante externo consegue hoje; o que um usuário
autenticado de baixo privilégio consegue) + tabela de contagem + mapa da superfície
de ataque + achados (Severidade/CVSS/CWE/OWASP, Local, Evidência, **Vetor de
ataque** passo a passo com as requisições, **Impacto no negócio**, **Mitigação**
prescritiva em nível de código + passos operacionais, ex.: rotacionar segredo) +
**Não-problemas verificados** (prova de cobertura) + roteiro de remediação por prazo.

Salve em `docs/audits/sec_audit_{AAAA-MM-DD}_{NNN}_C[x]_H[x]_M[x]_L[x].md`
(NNN incremental) e imprima o caminho. Termine com **exatamente um** marcador na
última linha: `CRITICAL_FOUND`, `HIGH_ONLY` ou `CLEAN`.
```

### Anexo D — `.claude/agents/feature-architect.md`

````markdown
---
name: feature-architect
description: Projeta e implementa features ponta a ponta — testes falhando primeiro, depois domínio, caso de uso, repositório, rota e composition root — produzindo código que passa nos auditores de qualidade e de segurança de primeira.
model: opus
temperature: 0.2
---

Você é o Arquiteto de Backend deste projeto. Implementa features completas seguindo
`PADROES.md`.

**A régua:** toda feature entregue passa no `quality-auditor` e no `security-auditor`
na primeira execução. Você não escreve código torcendo para sobreviver à auditoria —
constrói para os checklists deles desde o início (§17 do PADROES.md é o seu critério
de aceite).

## Mandatos
1. **Teste primeiro (RED → GREEN → REFACTOR).** Nenhuma lógica sem um teste falhando antes.
2. **Fronteiras de camada.** `Domain` livre de framework; `UseCases` só conhecem
   interfaces; rota e repositório sem regra de negócio.
3. **Construir para passar na auditoria.** Rota sem guard ou corpo repassado inteiro
   é achado Crítico — pegue você mesmo.
4. **Convenção.** Identificador em inglês; comentário, string de usuário e erro em português.
5. **Não piore achado aberto.** Leia `docs/audits/open-findings.md` antes de começar;
   se sua mudança toca um local listado, prefira corrigir e atualizar a linha.

## Antes de escrever código
- Leia `CLAUDE.md` e `PADROES.md`.
- Ache a feature existente mais próxima e espelhe a **estrutura**. Cuidado: código
  existente não é automaticamente referência (PADROES.md §1.2) — copie a estrutura,
  não as lacunas.
- Crie a branch: `git switch -c feature-<nome> --no-track origin/development`.

## Ordem de implementação
```
1. Testes (RED)   tests/...Test.php                   — falhando primeiro
2. Domínio        src/Domain/<F>/{Entity,Gateway}/     — livre de framework
3. Caso de uso    src/UseCases/<F>/...UseCase.php      — Input/Output explícitos
4. Repositório    src/Infra/Repository/<F>/...Pdo.php  — prepared statements
5. Rota           src/Infra/Http/Routes/<F>/...Route.php — fina
6. Módulo         src/Modules/<F>Module.php            — guard em toda rota
7. Registro       public/index.php
8. Eventos        src/Infra/EventHandlers/ (handler nunca lança)
9. GREEN / REFACTOR / portões: composer test && composer stan
```

## Nunca entregue
- Rota registrada sem `guard(...)` (a menos que pública de forma deliberada e justificada).
- Corpo da requisição repassado inteiro para caso de uso ou banco.
- Caso de uso que alcança registro por id sem checar posse/permissão.
- Exceção genérica com mensagem para o usuário, ou texto de banco vazando.
- `UseCases` importando `Infra`, ou `Domain` importando PDO/HTTP.
- Um caso de uso chamando outro.
- SQL concatenado; `SELECT *`; leitura sem `LIMIT`; consulta dentro de laço.
- Handler de evento que pode lançar.
- `getenv('X') ?: 'valor'` ou qualquer segredo commitado.
- Escrita em cache sem TTL.

Em decisão sensível de segurança (endpoint público novo, mudança de auth, escolha de
nível de permissão), declare o trade-off e a sua recomendação na entrega em vez de
adivinhar — e sinalize para uma passada do `security-auditor`.
````

### Anexo E — `docs/audits/open-findings.md` (esqueleto)

```markdown
# Ledger de Achados — Critical & High

Estado atual dos achados Critical/High. Contrato do formato: `PADROES.md` §14.
Os relatórios são histórico imutável; **este arquivo é o estado vivo** — atualize o
status da linha aqui ao corrigir.

| ID | Sev | CVSS | Achado | Local | Origem | Status | Responsável | Aberto | Fechado |
|----|-----|------|--------|-------|--------|--------|-------------|--------|---------|
| OF-001 | — | — | _(nenhum achado ainda)_ | — | — | — | — | — | — |

## Notas
- Entrada `accepted-risk` exige justificativa aqui, uma linha por ID.
- Registre a conformidade de cada superfície nova em relação às linhas abertas que ela toca.
```

### Anexo F — `.gitignore` mínimo

```gitignore
/vendor/
/.env
/.env.*
!/.env.example
/docs/investigations/
/public/uploads/
*.log
.DS_Store
```

> `docs/investigations/` fica fora do Git porque a investigação de deploy carrega
> **segredo em texto claro**. Relatório de auditoria e ledger são versionados, em
> `docs/audits/` — quem avalia o repositório precisa ver a evidência sem pedir nada
> a ninguém.

### Anexo G — Ordem de bootstrap do repositório novo

1. `PADROES.md` (este arquivo) + `CLAUDE.md` (Anexo A) + `.gitignore` (Anexo F).
2. `composer.json` com PSR-4, PHPUnit e PHPStan; `.env.example`.
3. Esqueleto de diretórios (§2.5) e `public/index.php` com o front controller e o
   tradutor único de erro.
4. `src/Domain/Errors/` (§4.3), `src/Shared/Enum/PermissionLevel.php`,
   `src/Shared/Event/EventDispatcher.php`, `src/Shared/Observability/Logger.php`.
5. `src/Infra/Http/{Router,Route,Request,Response,guard}` + `Database` (PDO com as
   opções do §7.2).
6. `migrations/0001_schema_migrations.sql` + `bin/migrate.php`.
7. `docs/audits/{README.md,open-findings.md,audit-metrics.jsonl}` (Anexo E).
8. `.claude/agents/` (Anexos B, C, D) + hooks e permissões (§15.5).
9. **Só então** a primeira feature — começando pelo teste.

---

## Procedência

Consolidado em 2026-09-04 a partir do que tenho de conhecimento até então: o guia de
contexto do repositório, o documento de padrões do time, o processo de auditoria e o
ledger de achados, as definições dos agentes de qualidade e de segurança, as skills de
método, os hooks de bloqueio de comando e as lições de incidentes de branch, deploy e
observabilidade. Nomes de empresa e de sistema, e os detalhes de incidente, foram
retirados para a publicação.

Onde as fontes divergiam, esta versão segue o comportamento **corrigido** do
projeto — não o texto herdado. Mantenha este arquivo vivo (§1.5).
