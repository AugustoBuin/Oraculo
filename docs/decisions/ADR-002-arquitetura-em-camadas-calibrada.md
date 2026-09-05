# ADR-002 — Clean Architecture com a espinha inteira e o apparatus podado

**Data:** 04/09/2026 · **Status:** aceito
**Diverge de:** `backend/PADROES.md` §6 e §14 (reduzidos), §2 (integral)

---

## Contexto

O `PADROES.md` descreve a arquitetura de um sistema em produção, com time, deploy contínuo
e histórico de incidentes: quatro camadas, dispatcher de eventos, observabilidade com canais
e Debug Mode por canal expirável, `traceId`, ledger de achados, métricas de auditoria em
JSONL append-only e três agentes especializados.

Este projeto é uma entrega de **cinco dias úteis, feita por uma pessoa**, com escopo de um
portal administrativo: 5 features (User/Session, Game, Edition, Rarity, Card) e 24 rotas.

O próprio documento oferece o critério para calibrar isso, no §1.3:

> *"Só aplique um design pattern que remova algo concreto. Padrão decorativo sai na revisão."*

Aplicar 100% do apparatus num projeto deste tamanho ativaria exatamente o antipadrão que o
documento condena.

## Opções consideradas

**A. Aplicar o `PADROES.md` integralmente.** Coerente com o documento, mas gasta dias em
infraestrutura que não elimina nada neste escopo — e o cronograma não tem esses dias.

**B. Arquitetura procedural simples.** `public/index.php` com um roteador e handlers diretos
sobre PDO. Rápido, e é o que a maioria das entregas de desafio em PHP puro faz. Justamente
por isso, não diferencia nada — e joga fora a única chance de mostrar o que o candidato sabe
fazer com arquitetura.

**C. Manter a espinha, podar o apparatus.**

## Decisão

**Opção C.** A separação é entre **o que estrutura o código** (mantido integral) e **o que
opera o sistema em produção** (reduzido ao útil aqui).

### Mantido integral — a espinha

| Peça | Por que se paga com 5 features |
|---|---|
| As 4 camadas e a regra de dependência (§2.1) | É o que torna o domínio testável sem banco. Com 5 features e uma cadeia de validação real, se paga já no dia 2. |
| Anatomia do caso de uso: construtor privado + `create()` + Input/Output DTO (§2.2) | Custa ~10 linhas por caso de uso e elimina mass assignment **por construção**. |
| Rota fina, sem regra de negócio (§2.3) | Barato de manter, e é o que sustenta a rota fina de verdade. |
| Guard no registro da rota (§5.1) | O núcleo do RBAC. É o item que o próprio documento marca como de maior valor. |
| Hierarquia de erro + tradutor único (§4.2) | Entrega diretamente o requisito do enunciado: "todos os endpoints operando sem erros". |
| Repositório implementando a porta do domínio (§7.1) | Já traz o Adapter de graça e mantém SQL longe da regra. |
| Migrations versionadas + `schema_migrations` (§7.5) | O enunciado pede schema e seed; isso é a forma disciplinada de entregar. |
| PDO com `ERRMODE_EXCEPTION`, `EMULATE_PREPARES=false` (§7.2) | Quatro linhas de configuração que decidem se o prepared statement é real. |
| `traceId` + logger injetado por construtor (§6) | O `traceId` é gerado no front controller; o logger entra por construtor. Custo próximo de zero, e é o que liga a linha de log à requisição. |

### Reduzido — o apparatus

| Peça | O que fica | Por que |
|---|---|---|
| Observabilidade (§6) | `traceId` + logger injetado + sink em `stderr`, coletado pelo Docker | Sink em tabela `system_log` gravado em lote, canais múltiplos e Debug Mode por canal com expiração automática resolvem problemas de operação contínua que este projeto não tem |
| Ledger de achados (§14) | `docs/audits/open-findings.md` com o contrato de colunas do §14.1 | O `audit-metrics.jsonl` append-only serve para análise de tendência ao longo de meses |
| Eventos de domínio (§2.4) | Dispatcher mínimo (~40 linhas), 4 eventos de carta, 1 handler | Ver ADR-005: entra porque a trilha de auditoria justifica, não porque o documento manda |
| Agentes de IA (§15) | Existem localmente, fora do repositório | Ver ADR-009 |

### O verificador de fronteiras

O `PADROES-ENGENHARIA.md` (Anexo B) propõe um `check-boundaries.mjs` em Node. Aqui ele é
reescrito em **PHP** (`bin/check-boundaries.php`), cobrindo as duas fronteiras — as camadas
do PHP e o isolamento entre features do JS — com uma ferramenta só, que já está no contêiner.

Motivo: adicionar Node ao ambiente de um projeto que se apresenta como "zero dependência"
pede uma explicação que a reescrita torna desnecessária.

## Consequências

- O dia 04 inteiro é fundação: esqueleto de camadas, autoloader, router, middleware,
  ErrorHandler, PDO, migrations, seed, micro-runner e verificador de fronteiras. Nenhuma
  feature. **Isso é intencional** — o custo de retrofit da fundação no dia 3 seria maior.
- Um leitor que conhece o `PADROES.md` vai notar as ausências. Elas estão aqui documentadas,
  com o motivo — que é a diferença entre poda e esquecimento.

## Gatilho de revisão

Promover o apparatus reduzido quando qualquer um destes for verdade: o projeto ganhar um
segundo desenvolvedor; entrar em operação contínua com deploy real; passar de ~15 features.
