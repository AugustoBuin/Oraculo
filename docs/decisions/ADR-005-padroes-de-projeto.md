# ADR-005 — Padrões de projeto adotados e recusados

**Data:** 04/09/2026 · **Status:** aceito
**Aplica:** `backend/PADROES.md` §1.3 e §3

---

## Contexto

O `PADROES.md` §3.1 lista quatro padrões obrigatórios — Strategy, Observer + Command,
Adapter e Chain of Responsibility — e §3.2 lista três proibidos. Mas o §1.3 impõe o critério
que decide de verdade:

> *"Só aplique um design pattern que remova algo concreto: um `if` que ia crescer, um
> acoplamento que ia travar o teste, ou um estado global que ia vazar entre casos. Padrão
> decorativo sai na revisão."*

Este ADR aplica esse teste, um por um, a este projeto. **Adotar um padrão obrigatório sem
que ele elimine algo seria violar o §1.3 em nome do §3.1.**

---

## Decisão

### ✅ Chain of Responsibility — o padrão âncora

**Elimina:** um `public/index.php` procedural com condicionais aninhadas, e a duplicação da
checagem de permissão em cada rota.

Aparece em **dois** lugares genuínos, o que é raro num projeto deste tamanho:

**1. Pipeline HTTP** — `TraceId → SecurityHeaders → JsonBody → Session → Authenticate →
Authorize → Csrf → RateLimit → Route`. Cada elo é uma classe com uma responsabilidade,
testável isoladamente. É o mecanismo que faz o `guard(...)` do §5.1 existir: os elos
`Authenticate` e `Authorize` são instalados **no registro da rota**, dentro do composition
root, não dentro do corpo dela.

**2. Cadeia de validação da carta** — nome → jogo existe → **edição pertence ao jogo** →
**raridade pertence ao jogo** → imagem válida → duplicidade. A ordem é significativa: não se
valida a edição antes de saber que o jogo existe. Sem a cadeia, isso seria um método de 80
linhas com seis blocos condicionais que cresce a cada campo novo.

### ✅ Strategy — com duas implementações reais

**Elimina:** o `if ($enviouArquivo) { … } else { … }` do tratamento de imagem, que cresceria
a cada origem nova.

O §3.1 impõe o teto: *"Com apenas uma implementação, use uma função pura."* Aqui há
**duas**, porque a decisão de produto foi aceitar upload **e** URL (ADR-008):

| Estratégia | Responsabilidade |
|---|---|
| `UploadedFileImageSource` | Valida o tipo pelo **conteúdo** (`finfo`), verifica o tamanho, gera o nome no servidor, grava fora do document root |
| `RemoteUrlImageSource` | Valida o esquema contra a allowlist `http`/`https`, normaliza a URL |

As duas satisfazem a mesma porta: *"transforme esta entrada numa referência de imagem
utilizável, ou falhe com uma mensagem em português"*.

### ✅ Adapter — praticamente de graça

**Elimina:** dependência direta de PDO espalhada pelo domínio e pelos casos de uso.

Já vem embutido no par porta/adaptador que a Clean Architecture obriga: a interface
`CardGateway` vive em `Domain`, e `CardRepositoryPdo` a implementa em `Infra`. Não custa
nada extra — é consequência do ADR-002, não trabalho adicional.

### ✅ Observer + Command — pela trilha de auditoria

**Gatilho do §3.1:** *"Quando acontece X, também precisa acontecer Y."*

Aqui existe exatamente um X real: **quando uma carta é criada, alterada, excluída ou
restaurada, é preciso registrar quem fez e o quê.**

**Elimina:** um caso de uso chamando outro (proibido pelo §2.2) ou, pior, cada caso de uso
de carta carregando a responsabilidade de escrever auditoria — acoplando duas preocupações
que mudam por motivos diferentes.

Escopo mínimo e deliberado:

- `EventDispatcher` de ~40 linhas em `Shared/Event/`.
- Quatro eventos: `CardCreated`, `CardUpdated`, `CardDeleted`, `CardRestored`.
- **Um** handler: `WriteCardAuditHandler`, em `Infra/EventHandlers/`.
- Registro em um único lugar, ligado pelo composition root.

> **A regra dura que vem junto (§2.4): o handler nunca lança.** Corpo inteiro em try/catch,
> falha apenas registrada em log. Se a auditoria falhar, quem acabou de salvar a carta não
> pode receber erro — a operação já foi persistida.

---

## ❌ Recusados, com o motivo

### Strategy para "regras por Card Game"

**Considerado e descartado.** Cada jogo tem seu conjunto de edições e de raridades — parece
o caso clássico de Strategy por tenant.

**Não é.** Isso é **dado, não comportamento**: resolve com as tabelas `editions` e
`rarities` e um `JOIN`. Uma `MagicRulesStrategy` seria a decoração exata que o §1.3 proíbe —
e teria um efeito colateral pior: adicionar o LigaLorcana voltaria a exigir deploy, matando
a tese do produto (PRD §1.1).

### Specification para os filtros de cartas

Uma allowlist de colunas ordenáveis + montagem de `WHERE` com parâmetros é mais simples,
mais legível e mais segura. Um objeto `Specification` componível aqui esconde a consulta sem
eliminar nada.

### Container de injeção de dependência

O composition root (`src/Modules/<F>Module.php`) já faz a injeção à mão, explicitamente. Um
container esconde a dependência que o §2.2 faz questão de deixar visível na assinatura — e
o §3.2 proíbe Service Locator exatamente por esse motivo.

### CQRS, Event Sourcing, Repository genérico

Nenhum elimina nada neste escopo. `CardGateway` com métodos nomeados pelo que o domínio
precisa é melhor que um repositório genérico com `find(array $criteria)` — que aceita
qualquer coisa e não documenta nada.

### Os três do §3.2 — Active Record, Service Locator, Singleton com estado

Proibidos pelo padrão e mantidos proibidos aqui. Uma nota sobre a linha do singleton: a
conexão PDO e o contexto de `traceId` **podem** ser únicos por requisição, porque em PHP uma
requisição é um processo e nada sobrevive a ela. Isso não é o singleton proibido.

---

## Consequências

- Quatro padrões, cada um com uma justificativa em uma frase sobre o que elimina.
- **O Observer é o primeiro corte se o dia 06 atrasar** (PRD §10). Nesse cenário, a trilha
  de auditoria sai inteira — não migra para dentro dos casos de uso, porque aí o padrão
  teria sido substituído pelo acoplamento que ele existe para evitar.

## Gatilho de revisão

- **Promover Strategy para regras de jogo** se surgir comportamento — não dado — específico
  de um TCG (ex.: validação de numeração de carta que só o Pokémon tem).
- **Ampliar o Observer** quando surgir o segundo handler para o mesmo evento (notificação,
  invalidação de cache, indexação de busca).
