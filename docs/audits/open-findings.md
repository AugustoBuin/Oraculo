# Ledger de Achados — Critical & High

Estado **vivo** dos achados de severidade `CRITICAL` e `HIGH`. Os relatórios completos são
histórico imutável; este arquivo é o que se atualiza ao corrigir.
Contrato do formato: `backend/PADROES.md` §14.1.

> **Leia este arquivo antes de começar qualquer trabalho.** Se a sua mudança toca um local
> listado aqui: corrija o achado e atualize a linha. No mínimo, **não piore**.

| ID | Sev | CVSS | Achado | Local | Origem | Status | Responsável | Aberto | Fechado |
|----|-----|------|--------|-------|--------|--------|-------------|--------|---------|
| OF-001 | — | — | _(nenhum achado ainda — projeto em fase de fundação)_ | — | — | — | — | — | — |

## Convenções

- `ID`: `OF-NNN`, sequencial, **nunca reutilizado nem renumerado**.
- `Severidade`: apenas `CRITICAL` ou `HIGH`. `MEDIUM` e `LOW` ficam no relatório de origem.
- `Status`: `open` · `in-progress` · `fixed` · `verified` · `accepted-risk` · `duplicate`.
- Achado duplicado tem **uma** linha, listando todas as origens.
- `accepted-risk` exige uma linha de justificativa nas notas abaixo.

## Notas

_(Registrar aqui a conformidade de cada superfície nova em relação às linhas abertas que ela
toca — ex.: "a rota X nasce protegida no nível Y, lança erro de domínio em vez de definir
status na mão, e não introduz leitura sem limite".)_

## Auditorias planejadas

| Quando | Escopo |
|---|---|
| Ao fim do Épico 1 (autenticação) | `diff` — dimensões de acesso e autenticação voltam a `full`, pois o diff toca guard, sessão e front controller |
| Ao fim do Épico 3 (cartas) | `diff` |
| 09/09, antes da entrega | `full` — qualidade **e** segurança. `CRITICAL` bloqueia a entrega |
