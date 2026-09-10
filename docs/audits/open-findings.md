# Ledger de Achados — Critical & High

Estado **vivo** dos achados de severidade `CRITICAL` e `HIGH`. Os relatórios completos são
histórico imutável; este arquivo é o que se atualiza ao corrigir.
Contrato do formato: `backend/PADROES.md` §14.1.

> **Leia este arquivo antes de começar qualquer trabalho.** Se a sua mudança toca um local
> listado aqui: corrija o achado e atualize a linha. No mínimo, **não piore**.

| ID | Sev | CVSS | Achado | Local | Origem | Status | Responsável | Aberto | Fechado |
|----|-----|------|--------|-------|--------|--------|-------------|--------|---------|
| OF-001 | HIGH | 6,5 | Parâmetro de consulta ou cookie em forma de array (`?page[]=1`) vira `ErrorException` e responde 500 em qualquer rota `/api/*`, **sem autenticação** — o erro nasce em `fromGlobals()`, antes do pipeline, e cada requisição grava uma linha de log com stack completa | `backend/src/Infra/Http/Request.php:89`, `backend/src/Infra/Http/Request.php:91` | `2026-09-09-auditoria-final-qualidade-backend.md`; `2026-09-09-auditoria-final-seguranca.md` | fixed | | 2026-09-09 | 2026-09-09 |
| OF-002 | HIGH | — | Cinco leituras remotas sem cancelamento; em `catalogs-page` um escopo nasce depois do `dispose` e dispara duas requisições sobre a tela já morta (RNF-07, `PADROES-ENGENHARIA.md` §12.4) | `frontend/src/pages/catalogs/catalogs-page.js:89-106`; `frontend/src/pages/cards/cards-filters.js:122-152`; `frontend/src/features/cards/components/card-form.js:343-376`; `frontend/src/features/catalogs/components/catalog-panel.js:47-51`; `frontend/src/features/catalogs/api/catalogs-api.js:95-96` | `2026-09-09-auditoria-final-qualidade-frontend.md` | open | | 2026-09-09 | |
| OF-003 | HIGH | — | **Verificado na tela em 09/09.** Na galeria — a visão padrão da listagem — abrir uma carta é ação exclusiva de mouse: o cartão não é focável e a grade só escuta `click`. Tabulando a partir da busca, o foco vai do `Excluir` de uma carta direto ao `Excluir` da seguinte, sem parada intermediária: **a única ação alcançável por teclado em cada carta é a destrutiva** (RNF-06, e o aceite de F-050 que diz "a aplicação inteira é operável só pelo teclado") | `frontend/src/features/cards/components/card-tile.js:117-123`; `frontend/src/features/cards/components/card-gallery.js:30-55` | `2026-09-09-auditoria-final-qualidade-frontend.md` | fixed | | 2026-09-09 | 2026-09-09 |

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

**Verificado na tela em 09/09**, depois das auditorias, com a extensão do Chrome já
conectada: runner autoral do frontend em `214 passou, 0 falhou`; console **sem nenhuma
mensagem** na galeria recarregada, na tabela e na tela de carta; CSP sem violação alguma —
as imagens das cartas carregam, e imagem barrada registraria `Refused to load the image`;
sem rolagem horizontal em 360, 500, 752 e 1424px; e `/cartas/:id`, a tela que nunca tinha
passado por inspeção, em coluna única no estreito, com pré-visualização e botões cabendo.

Zoom de página em 200% (RNF-04) também passou: viewport efetivo de ~493x366, nav em duas
linhas, filtros e galeria refluindo para duas colunas, nada cortado e nenhuma rolagem
horizontal. Largura abaixo de 500px e zoom não se alcançam pelo canal de automação — os
360px e o zoom saíram da barra de dispositivo do DevTools e do controle do navegador,
ligados à mão.

**Com isso, todo critério mensurável de F-050 e F-051 está verificado em execução, menos
um: a operação só por teclado, que é o OF-003 e está reprovada.**

**OF-003 corrigido em 09/09**, com o padrão que a visão tabela já usava: `tabindex` no
cartão e um `keydown` na grade tratando `Enter` e `Espaço`, com saída antecipada para o
botão de excluir — que é nativo, traduz as duas teclas em `click` sozinho, e sem a saída
seria contado duas vezes. O `tabindex` acompanha `onOpen`: parada de tabulação que não abre
nada é ruído para quem navega sem mouse. Nenhum estilo novo — o anel vem da regra global de
`:focus-visible`, então cartão e linha de tabela ficam iguais quando focados.

Coberto por `frontend/tests/suites/card-gallery.test.js`, escrito antes da correção: 4
vermelhos viraram verdes, e a suíte foi de 214 para 224. Verificado na tela, a 200% de
zoom: a ordem de tabulação agora é busca → Jogo → Ordenar por → **cartão 1** → Excluir 1 →
**cartão 2**, e `Enter` no cartão focado abre a carta. Fica `fixed`, não `verified` — mover
para `verified` é da auditoria, não de quem corrigiu.

**OF-001 corrigido em 09/09.** `fromGlobals()` deixa de converter `$_GET` e `$_COOKIE` à
força e passa a **descartar** o que não for escalar, no mesmo idioma que `headersFromServer`
já usava logo abaixo. Descartar em vez de lançar é a parte deliberada: ali é fora do
`ErrorBoundary`, e uma exceção sairia sem os cabeçalhos de segurança do pipeline. Parâmetro
descartado é parâmetro ausente, e ausente toda rota já sabe tratar.

Reproduzido antes e depois, que é o que fecha o achado. Sem sessão: `/api/cards?page[]=1`,
`/api/games?a[]=1` e o cookie em forma de array respondiam **500** e agora respondem **401**,
igual à requisição bem formada — a decisão volta a ser do guard, dentro do pipeline. Com
sessão, `?page[]=1` responde **200** com `"pagination":{"page":1}`: o parâmetro some e a rota
usa o padrão dela. Coberto por três testes em `RequestTest`, escritos antes da correção; a
suíte do backend foi de 217 para 220.

Some com isso o vetor de inundação de log que a auditoria de segurança levantou: não há mais
pilha gravada por requisição anônima.

## Auditorias planejadas

| Quando | Escopo |
|---|---|
| Ao fim do Épico 1 (autenticação) | `diff` — dimensões de acesso e autenticação voltam a `full`, pois o diff toca guard, sessão e front controller |
| Ao fim do Épico 3 (cartas) | `diff` |
| 09/09, antes da entrega | `full` — qualidade **e** segurança. `CRITICAL` bloqueia a entrega |

**Realizada em 09/09**, no commit `88f76ce`, em três relatórios: qualidade de backend
(0C · 1H · 6M · 8L), qualidade de frontend (0C · 2H · 4M · 7L) e segurança
(0C · 0H · 3M · 2L, marcador `CLEAN`). **Nenhum `CRITICAL`: a entrega não está bloqueada.**
