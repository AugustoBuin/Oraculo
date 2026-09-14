# CLAUDE.md

> O contexto normativo do projeto vive em `docs/ENGENHARIA.md`, escrito para qualquer
> pessoa ou agente que mantenha o repositório. Este arquivo só aponta a ordem de leitura
> (ADR-009).

**Leia, nesta ordem, antes de escrever qualquer código:**

1. `docs/ENGENHARIA.md` — como rodar, fronteiras de camada, as dez regras de revisão e as
   armadilhas deste repositório.
2. `backend/PADROES.md` e `frontend/PADROES-ENGENHARIA.md` — a régua completa.
3. `docs/decisions/` — **por que não foi feito do jeito óbvio.** Vários ADRs registram
   divergências deliberadas dos dois documentos acima. Onde houver conflito, **o ADR vence**.
4. `docs/audits/open-findings.md` — achados abertos. Não piore nenhuma linha.

**Para implementar uma tarefa:** `docs/backlog-backend.md` (tarefas `B-`) e
`docs/backlog-frontend.md` (tarefas `F-`) trazem objetivo, entregáveis,
critérios de aceite e testes obrigatórios de cada uma. O contrato de API está em
`docs/api-contract.md` e o schema em `docs/database-schema.md`.

**As cinco coisas que mais reprovam aqui:**
- Adicionar qualquer dependência de terceiros (ADR-001).
- Registrar rota sem `guard(...)`.
- Definir status HTTP fora do `ErrorHandler`.
- Repassar o corpo da requisição inteiro para um caso de uso ou para o banco.
- Escrever implementação antes do teste, nas camadas sob TDD estrito (ADR-004).
