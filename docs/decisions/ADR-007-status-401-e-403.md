# ADR-007 — `401` para sessão ausente, `403` para nível insuficiente

**Data:** 04/09/2026 · **Status:** aceito
**Diverge de:** `backend/PADROES.md` §4.2 · **Alinha com:** `frontend/PADROES-ENGENHARIA.md` §8.4

---

## Contexto

Os dois documentos de referência se contradizem neste ponto, e a contradição precisa ser
resolvida antes da primeira rota ser escrita — depois, custa uma varredura no frontend
inteiro.

**`backend/PADROES.md` §4.2** coloca as duas situações no mesmo status:

| Classe | Status | Quando |
|---|---|---|
| `UnauthorizedError` / `ForbiddenError` | **403** | Sem token, ou sem permissão |

**`frontend/PADROES-ENGENHARIA.md` §8.4** pressupõe o contrário:

> *"Expiração tratada como caminho normal, não como erro inesperado: **401 tem fluxo
> próprio**."*
> *"Uma falha de renovação encerra a sessão: limpe token, dados em memória, cache de dados e
> identidade de analytics, e leve ao login."*

O frontend não consegue implementar esse fluxo se as duas situações chegam como `403`: ele
precisaria inspecionar o texto da mensagem para decidir entre "leve ao login" e "mostre
'você não tem permissão'" — e decidir por texto de mensagem é exatamente o tipo de
acoplamento frágil que o §7.2 do mesmo documento existe para evitar.

## Opções consideradas

**A. Seguir o §4.2 literalmente: tudo `403`.** Consistente com o documento de backend, e
quebra o fluxo prescrito pelo documento de frontend. Empurra a decisão para o texto da
mensagem.

**B. Tudo `403`, com um campo `code` no corpo.** Preserva o status único e dá ao cliente um
discriminador estruturado. Mas inventa um vocabulário paralelo ao que o HTTP já define, e
qualquer ferramenta intermediária (proxy, log, monitoramento) continua vendo só `403`.

**C. `401` para sessão ausente ou expirada, `403` para nível insuficiente.**

## Decisão

**Opção C.**

| Classe | Status | Significado | O que o frontend faz |
|---|---|---|---|
| `UnauthorizedError` | `401` | Não há sessão, ou a sessão expirou | Limpa o estado, leva ao login, avisa que a sessão expirou |
| `ForbiddenError` | `403` | Sessão válida; o nível não alcança a operação. Também usado para CSRF inválido | Mostra "sem permissão" **na tela atual**, sem deslogar |

É também o que a semântica do HTTP define: `401 Unauthorized` significa "não autenticado"
(por isso acompanha `WWW-Authenticate`), e `403 Forbidden` significa "autenticado, e ainda
assim não pode".

### O que **não** muda

O §5.2 do `PADROES.md` continua valendo integralmente: **recurso que existe mas que o
solicitante não pode ver responde `404`, não `403`.** Devolver `403` ali confirma a
existência do registro e transforma a resposta num oráculo. Isso está no
`api-contract.md` §2 e é conferido na auditoria de segurança.

### CSRF inválido é `403`, não `401`

Um token CSRF ausente ou divergente não significa sessão inválida — a sessão pode estar
perfeitamente válida. Tratar como `401` deslogaria o usuário por um problema que se resolve
rebuscando o token, e transformaria um erro recuperável em perda de trabalho.

## Consequências

- O cliente HTTP central do frontend (`shared/api/client.js`) trata `401` como caminho
  normal, com fluxo próprio, e `403` como erro de tela — conforme
  `PADROES-ENGENHARIA.md` §8.4.
- `GET /api/auth/session` respondendo `401` **não é erro**: é a resposta esperada para quem
  ainda não logou, e é assim que a aplicação decide entre a tela de login e o portal.
- **O `PADROES.md` §4.2 precisa ser corrigido.** O §1.5 dele mesmo diz que o documento é
  vivo e que padrão novo é promovido para lá. A tabela de status deveria separar
  `UnauthorizedError` (401) de `ForbiddenError` (403) — este ADR é o registro da lacuna, e a
  correção no documento de origem fica como pendência para quem o mantém.

## Gatilho de revisão

Nenhum previsto. Esta é a semântica padrão do HTTP; reverter exigiria uma razão externa
(um proxy corporativo que trate `401` de forma incompatível, por exemplo).
