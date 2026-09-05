# Registro de Decisões Arquiteturais

> *"Quem chegar em seis meses precisa saber por que **não** foi feito do jeito óbvio."*
> — `PADROES-ENGENHARIA.md` §18.4

Cada arquivo aqui registra uma decisão com **contexto, opções consideradas, decisão,
consequências e gatilho de revisão**. Decisão sem gatilho vira dogma; o gatilho é o que
permite revisitá-la sem discussão.

Vários destes ADRs registram **divergências deliberadas** dos padrões de referência
(`backend/PADROES.md` e `frontend/PADROES-ENGENHARIA.md`). Divergir é permitido; divergir
em silêncio, não.

| ADR | Decisão | Diverge do padrão? |
|---|---|---|
| [001](ADR-001-sem-dependencias-de-terceiros.md) | Zero dependências de terceiros — inclusive Composer | ✅ Sim — `PADROES.md` §2.5 |
| [002](ADR-002-arquitetura-em-camadas-calibrada.md) | Clean Architecture com a espinha inteira e o apparatus podado | ⚠️ Parcial — §6, §14 reduzidos |
| [003](ADR-003-sessao-de-servidor-e-origem-unica.md) | Sessão em MySQL + frontend e API na mesma origem | — Aplica §5.4 |
| [004](ADR-004-tdd-seletivo-e-runner-autoral.md) | TDD onde o retorno é alto; micro-runner próprio | ✅ Sim — `PADROES.md` §10.1 |
| [005](ADR-005-padroes-de-projeto.md) | Chain of Responsibility, Strategy, Adapter e Observer; o resto recusado | — Aplica §1.3 e §3 |
| [006](ADR-006-rbac-hierarquico.md) | Três níveis hierárquicos, não matriz de permissões | — Aplica §5.1 |
| [007](ADR-007-status-401-e-403.md) | `401` para sessão ausente, `403` para nível insuficiente | ✅ Sim — `PADROES.md` §4.2 |
| [008](ADR-008-imagem-upload-e-url.md) | Imagem por upload (padrão) ou URL, via Strategy | — |
| [009](ADR-009-ferramental-de-ia-fora-do-repositorio.md) | `.claude/` e `CLAUDE.md` fora do repositório entregue | — |
| [010](ADR-010-fluxo-git-reduzido.md) | GitFlow reduzido a `main`, `development` e `feature-*` | ✅ Sim — `PADROES.md` §13.1 |
| [011](ADR-011-padroes-de-referencia-fora-do-repositorio.md) | Documentos de padrões de referência fora do repositório | — |
