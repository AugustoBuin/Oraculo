# Ledger de Achados — Critical & High

Estado **vivo** dos achados de severidade `CRITICAL` e `HIGH`. Os relatórios completos são
histórico imutável; este arquivo é o que se atualiza ao corrigir.
Contrato do formato: `backend/PADROES.md` §14.1.

> **Leia este arquivo antes de começar qualquer trabalho.** Se a sua mudança toca um local
> listado aqui: corrija o achado e atualize a linha. No mínimo, **não piore**.

| ID | Sev | CVSS | Achado | Local | Origem | Status | Responsável | Aberto | Fechado |
|----|-----|------|--------|-------|--------|--------|-------------|--------|---------|
| OF-001 | HIGH | 6,5 | Parâmetro de consulta ou cookie em forma de array (`?page[]=1`) vira `ErrorException` e responde 500 em qualquer rota `/api/*`, **sem autenticação** — o erro nasce em `fromGlobals()`, antes do pipeline, e cada requisição grava uma linha de log com stack completa | `backend/src/Infra/Http/Request.php:89`, `backend/src/Infra/Http/Request.php:91` | `2026-09-09-auditoria-final-qualidade-backend.md`; `2026-09-09-auditoria-final-seguranca.md` | open | | 2026-09-09 | |
| OF-002 | HIGH | — | Cinco leituras remotas sem cancelamento; em `catalogs-page` um escopo nasce depois do `dispose` e dispara duas requisições sobre a tela já morta (RNF-07, `PADROES-ENGENHARIA.md` §12.4) | `frontend/src/pages/catalogs/catalogs-page.js:89-106`; `frontend/src/pages/cards/cards-filters.js:122-152`; `frontend/src/features/cards/components/card-form.js:343-376`; `frontend/src/features/catalogs/components/catalog-panel.js:47-51`; `frontend/src/features/catalogs/api/catalogs-api.js:95-96` | `2026-09-09-auditoria-final-qualidade-frontend.md` | open | | 2026-09-09 | |
| OF-003 | HIGH | — | Na galeria — a visão padrão da listagem — abrir uma carta é ação exclusiva de mouse: o cartão não é focável e a grade só escuta `click` (RNF-06, e o aceite de F-050 que diz "a aplicação inteira é operável só pelo teclado") | `frontend/src/features/cards/components/card-tile.js:117-123`; `frontend/src/features/cards/components/card-gallery.js:30-55` | `2026-09-09-auditoria-final-qualidade-frontend.md` | open | | 2026-09-09 | |

## Convenções

- `ID`: `OF-NNN`, sequencial, **nunca reutilizado nem renumerado**.
- `Severidade`: apenas `CRITICAL` ou `HIGH`. `MEDIUM` e `LOW` ficam no relatório de origem.
- `Status`: `open` · `in-progress` · `fixed` · `verified` · `accepted-risk` · `duplicate`.
- Achado duplicado tem **uma** linha, listando todas as origens.
- `accepted-risk` exige uma linha de justificativa nas notas abaixo.

## Notas

**OF-001 entra como `HIGH` com CVSS de `MEDIUM`, e isso é deliberado.** As duas auditorias
mediram o mesmo defeito com réguas diferentes: na régua de qualidade, uma requisição
plausível respondendo 500 numa API entregue é grave; na CVSS v3.1 a confidencialidade fica
intacta — o cliente só vê a mensagem genérica — e a aritmética dá 6,5
(`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L`, CWE-779). Não é divergência entre os
auditores. Uma linha só, as duas origens, e a nota preenchida pela auditoria de segurança,
que é a que a coluna existe para receber.

O ângulo que só a segurança enxergou, e que sustenta a permanência no ledger: dezenas de
bytes de entrada produzem kilobytes de stack, sem `logging.options.max-size` no
`docker-compose.yml`, afogando o único registro de quem tentou autenticar
(`AuthenticateUserUseCase.php:83-86`).

**Não verificado no navegador, em nenhuma das três auditorias:** a extensão do Chrome não
estava conectada em 09/09. Ficam por observar em execução — não por leitura — o runner
autoral do frontend (`http://localhost:8080/tests`), a CSP em vigor numa tela real e o
console limpo em todos os fluxos. Os três são critério de aceite de F-051.

## Auditorias planejadas

| Quando | Escopo |
|---|---|
| Ao fim do Épico 1 (autenticação) | `diff` — dimensões de acesso e autenticação voltam a `full`, pois o diff toca guard, sessão e front controller |
| Ao fim do Épico 3 (cartas) | `diff` |
| 09/09, antes da entrega | `full` — qualidade **e** segurança. `CRITICAL` bloqueia a entrega |

**Realizada em 09/09**, no commit `88f76ce`, em três relatórios: qualidade de backend
(0C · 1H · 6M · 8L), qualidade de frontend (0C · 2H · 4M · 7L) e segurança
(0C · 0H · 3M · 2L, marcador `CLEAN`). **Nenhum `CRITICAL`: a entrega não está bloqueada.**
