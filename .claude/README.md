# Camada de agentes, skills e hooks — Oráculo

Índice do ferramental de IA do projeto. O contrato completo está em `backend/PADROES.md` §15
e `frontend/PADROES-ENGENHARIA.md` §17. Esta pasta é versionada, e o uso de IA é declarado
em `docs/PROCESSO.md` (ADR-009).

## Agentes

| Agente | Papel | Quando |
|---|---|---|
| `backend-quality-auditor` | Qualidade, performance, correção e convenção do PHP | Antes de merge em `development`, antes da entrega, após mudança em `Guard`/`ErrorHandler`/sessão |
| `frontend-quality-auditor` | Qualidade, performance, acessibilidade e convenção do JS/CSS | Idem, e após mudança em `shared/api/`, `shared/router/` ou nos estilos |
| `security-auditor` | SAST + revisão arquitetural do repositório inteiro (PHP, JS, Apache/PHP/Docker), CVSS v3.1 | Antes da entrega; após mudança em auth/sessão/permissão/upload; após publicar endpoint |

**Não há agente implementador.** O projeto está em acabamento, não em construção de feature:
quem escreve código é a sessão principal, seguindo `docs/backlog-*.md`. A skill de método
(`systematic-debugging`) vale para essa sessão.

As três regras que fazem o conjunto funcionar (`PADROES.md` §15.2):

1. **Auditor não corrige; corretor não audita.** Separar os papéis é o que evita o agente
   "achar" e "consertar" a mesma coisa sem evidência.
2. **Escrever relatório, métrica e ledger é a única escrita permitida ao auditor.**
3. **Todo achado cita `arquivo:linha` + trecho.** Sem evidência não é achado. O que não é
   comprovável estaticamente é marcado "requer verificação dinâmica".

## Skills

| Skill | Papel | Quando |
|---|---|---|
| `systematic-debugging` | As quatro fases até a causa raiz. Nenhuma correção antes da Fase 1 | Todo bug, teste vermelho ou comportamento inesperado |
| `design-system-css` | Tokens, dois temas, variantes por classe, refluxo e acessibilidade em CSS puro | Ao criar ou alterar componente visual |
| `impeccable` | Julgamento de design, de terceiro: `critique`, `colorize`, `quieter`, `polish`, `audit` | Revisão visual — paleta, bordas, sombras, acabamento |

### `impeccable` — instalada só em markdown

Origem: `pbakaus/impeccable`, v4.3.1, commit `67d018f` (10/09/2026), Apache 2.0 — `LICENSE`
e `NOTICE.md` vão junto. Veio **só** `SKILL.md` e `reference/`. Ficaram de fora, de
propósito:

- `scripts/` — o executável que a skill baixa no primeiro uso e os scripts de navegador;
- `hooks/` — rodavam esse executável a cada `Edit`/`Write` (5s) e a cada fim de turno (30s),
  inclusive em edição de PHP;
- `agents/`.

Consequências, todas previstas pela própria skill:

- O passo 1 do Setup (`scripts/impeccable context`) falha, e vale o fallback que ela
  documenta: avisar e ler o contexto do projeto direto. `live`, `hooks`, `pin` e `doctor`
  ficam inertes.
- `npx` e `npm` estão negados em `settings.json`. As referências sugerem
  `npx impeccable ...` — **não rodar**, e não afrouxar a negação para isso.
- **`PRODUCT.md` é `docs/PRD.md`; `DESIGN.md` é `docs/design.md`.** Não criar `PRODUCT.md`,
  `DESIGN.md` nem `.impeccable/`: seriam uma segunda fonte de verdade ao lado da versionada,
  e ferramenta dentro do repositório (ADR-009).
- O Oráculo é modo **Operate**: escaneabilidade e consistência acima de expressão.

Onde o projeto vence a skill — ela mesma diz "o brief vence":

- **Tipografia:** a pilha do sistema é requisito (RNF-01, ADR-001). Nada de fonte remota nem
  arquivo de fonte de terceiro, mesmo que `typeset` peça.
- **Contraste medido, não estimado:** cor nova entra com a medida nos dois temas e com a
  tabela do `docs/design.md` §3 atualizada no mesmo commit (RNF-05).
- **CSP intocável:** `live-setup` pediria liberar `localhost:8400` — nunca (F-051).
- Em conflito com `design-system-css`, vale a `design-system-css`: ela é a regra deste
  código; a `impeccable` é o olhar de design.

Para atualizar: clonar de novo e copiar só `SKILL.md`, `reference/`, `LICENSE` e `NOTICE.md`.

## Escopos

- `scope: full` — a base inteira. Antes da entrega e na revisão periódica.
- `scope: diff` — só o conjunto de mudanças (`git diff --name-only <base>...HEAD` +
  não-commitado), **mais o raio de alcance**: o módulo que registra a rota alterada, a
  página que compõe o componente alterado, a suíte que o cobre. O que for notado fora do
  escopo vai para "Fora de escopo — notado", nunca some em silêncio.
- Dimensões de acesso e sessão **voltam a `full`** se o diff tocar `Guard`, middleware,
  `public/index.php`, `shared/api/client.js` ou `docker/app/` — mudança ali tem efeito no
  repositório inteiro.

## Fluxos

```
Correção de bug
1. systematic-debugging     — causa raiz (Fases 1–3 antes de qualquer correção)
2. Teste que reproduz o bug — vermelho antes da correção (obrigatório, ADR-004)
3. Implementar a correção
4. docker compose exec app php backend/bin/validate.php

Antes de merge em development
1. quality-auditor do lado tocado — scope: diff
2. security-auditor — scope: diff, se tocou auth/permissão/sessão/upload
3. Corrigir CRITICAL e HIGH
4. Merge com --no-ff

Entrega (F-051)
1. backend-quality-auditor  — scope: full
2. frontend-quality-auditor — scope: full
3. security-auditor         — scope: full
4. CRITICAL bloqueia a entrega
```

## Onde vai cada artefato

| Artefato | Caminho | Mutabilidade |
|---|---|---|
| Ledger de `CRITICAL`/`HIGH` | `docs/audits/open-findings.md` | mutável — linhas mudam de status (**versionado**) |
| Métricas de execução | `docs/audits/audit-metrics.jsonl` | append-only (**versionado**) |
| Relatório de qualidade | `docs/audits/` | imutável, **versionado** |
| Relatório de segurança | `docs/audits/` | imutável, **versionado** |
| Relatório da entrega | `docs/audits/AAAA-MM-DD-auditoria-final-*.md` | imutável, **versionado** — exigência do F-051 |

Todo relatório é versionado em `docs/audits/`, junto do ledger (`ENGENHARIA.md` §8): quem
avalia esta entrega precisa ver a evidência sem depender de IA e sem arquivo fora do Git.
Relatório salvo não se edita — o que muda de status é o ledger.

## Hooks e permissões

`hooks/block-commands.js` é um `PreToolUse` que bloqueia comando destrutivo **antes** das
permissões e vence todas elas. A lista editável é `hooks/blocked-commands.txt` — uma linha,
um padrão; `#` comenta. Ele está ligado em `settings.json`.

> **Mudou `settings.json` ou `settings.local.json`?** A configuração só é lida **ao iniciar a sessão**. Encerre
> e reabra o Claude Code, senão o hook novo não vale nesta sessão.

O **portão de pré-push** (`.git/hooks/pre-push`) é do Git, não desta camada: roda
`backend/bin/validate.php` dentro do contêiner e barra o envio se a cadeia ficar vermelha.
Contêiner parado falha com instrução — não há PHP no host. **O portão nunca chama um
agente:** quem avalia esta entrega precisa verificar o código por comando, sem IA. Auditor
é ferramenta do autor, local e opcional.

## Configuração dos agentes

- `model: opus` nos três auditores — auditoria é leitura densa e julgamento de severidade.
- `tools` explícito e restrito: `Read, Grep, Glob, Bash, Write`. `Write` existe para o
  relatório, a métrica e o ledger, **não** para código.
- Nada de `temperature` no frontmatter: o Claude Code não lê essa chave. O que substitui o
  "0.1 dos auditores" do padrão é a instrução escrita — evidência obrigatória e severidade
  honesta.

## Documentos de referência

- `docs/ENGENHARIA.md` — o resumo normativo, versionado, para pessoa ou agente.
- `docs/decisions/` — **por que não foi feito do jeito óbvio**. Onde houver conflito com os
  padrões, **o ADR vence**.
- `backend/PADROES.md` e `frontend/PADROES-ENGENHARIA.md` — a régua completa, versionada
  depois de anonimizada (ADR-011).
- `docs/api-contract.md` §9 — o mapa de rotas oficial, para cruzar com o código.
