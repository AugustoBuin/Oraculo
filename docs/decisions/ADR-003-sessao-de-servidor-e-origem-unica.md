# ADR-003 — Sessão de servidor em MySQL, servida da mesma origem

**Data:** 04/09/2026 · **Status:** aceito
**Aplica:** `backend/PADROES.md` §5.4 · `frontend/PADROES-ENGENHARIA.md` §8.4

---

## Contexto

Duas exigências, uma de produto e uma de experiência de desenvolvimento:

1. A sessão precisa ser **simples, segura e acessível de qualquer lugar** — o usuário loga
   de qualquer máquina ou navegador, e a sessão não pode estar presa a um processo.
2. **CORS é uma fonte recorrente de problema** nos projetos anteriores da equipe e não pode
   sê-lo aqui.

E duas restrições do `PADROES.md` §5.4, que precisam ser cumpridas literalmente:

> *"Logout invalida a sessão no servidor, não só o cookie. Troca de senha invalida todas as
> sessões do usuário."*
> *"Token de longa duração sem mecanismo de revogação é achado de segurança."*

## Opções consideradas

### Para a sessão

**A. JWT em cookie ou header.** Sem estado no servidor, escala trivialmente. Mas revogação
exige uma blocklist consultada a cada requisição — ou seja, estado no servidor de novo, com
passos extras. E "token de longa duração sem revogação" é achado do próprio §5.4. Reprova.

**B. Sessão nativa do PHP em arquivo.** É o padrão, custa zero. Mas a sessão vive no disco de
um contêiner: some no restart, não escala para múltiplas instâncias e, principalmente,
**encerrar a sessão de outro dispositivo é praticamente impossível** — o que quebra as duas
regras do §5.4.

**C. Sessão em Redis.** Foi o que a equipe usou no SSO anterior e funciona. Aqui adiciona um
serviço inteiro ao `docker-compose` para guardar algumas linhas — e o enunciado pede MySQL,
que já está lá.

**D. Sessão nativa do PHP com handler customizado em MySQL.**

### Para o CORS

**E. Configurar CORS corretamente.** Origem explícita (nunca `*`),
`Access-Control-Allow-Credentials: true`, `SameSite=None; Secure`, preflight tratado em toda
mutação. Funciona — e são seis pontos onde um erro em qualquer um quebra silenciosamente.

**F. Não ter cross-origin.**

## Decisão

**Opção D + Opção F.**

### A sessão vive no MySQL

Sobre a tabela `sessions`, com id e token gerados por `random_bytes`.

> **Revisão de 05/09/2026 — como isto foi implementado, e por que mudou.**
>
> A versão original deste ADR previa implementar a interface nativa
> `SessionHandlerInterface`. Na implementação, o desenho não fechou: essa interface trata o
> conteúdo da sessão como um **blob opaco** (`payload`), e este projeto precisa de
> `user_id` numa coluna indexada — é o que torna `deleteAllForUser` um `DELETE` em vez de
> uma varredura impossível, e essa operação é a razão principal de a sessão estar no banco.
>
> Cumprir as duas coisas obrigaria o handler a desserializar e inspecionar o payload que
> ele deveria tratar como opaco, ou a escrever `user_id` por fora da interface. As duas
> saídas são o mesmo defeito: uma abstração que só funciona se quem a usa violar o contrato
> dela.
>
> A sessão passou a ser explícita — entidade `Session` no domínio, `SessionGateway` como
> porta, `SessionRepositoryPdo` na borda. Isso **entrega mais** do que a versão anterior,
> não menos: expiração e renovação viram regra de domínio testável com relógio congelado,
> `session_regenerate_id` deixa de ser necessário porque cada login gera um id novo por
> construção, e não há dependência da serialização nem do ciclo de vida de `session_start()`.
>
> A migration `0010` removeu a coluna `payload`, que existia só para o desenho anterior.
> A `0003` não foi editada: migration aplicada nunca é.

O que isso entrega:

| Requisito | Como |
|---|---|
| "Acessível de qualquer lugar" | A sessão está no banco, não no disco de um contêiner. Sobrevive a restart e escalaria para N instâncias sem tocar em código — a propriedade que o Redis dava no SSO, pelo custo de uma tabela |
| Logout invalida no servidor (§5.4) | `DELETE FROM sessions WHERE id = ?` |
| Troca de senha invalida todas as sessões (§5.4) | `DELETE FROM sessions WHERE user_id = ?` — o índice `idx_sessions_user` existe para isso |
| Revogação real | É a própria natureza da sessão de servidor |
| TTL explícito | Coluna `expires_at` + coleta com `LIMIT` |

Configuração do cookie, conforme §5.4: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, e
`session_regenerate_id(true)` no login (fixação de sessão).

> Confirmado por requisição direta em 04/09/2026: a própria LigaMagic serve o cookie
> `LIGASID` com `path=/; secure; HttpOnly; SameSite=Lax`. A configuração aqui é idêntica à
> que eles usam em produção.

### O CORS deixa de existir

O Apache serve o frontend em `/` e roteia `/api/*` para `backend/public/index.php`. Frontend
e API compartilham a origem.

Consequência direta: o cookie é *first-party*. Não há `SameSite=None`, não há
`Access-Control-Allow-Credentials`, não há preflight. **O problema não é resolvido — ele
deixa de existir.**

Isso não significa ausência de política: o middleware `SecurityHeaders` continua aplicando
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e a CSP. E como não há origem
externa consumindo a API, `Access-Control-Allow-Origin` simplesmente não é emitido — o que é
mais restritivo do que qualquer configuração de CORS seria.

### CSRF continua obrigatório

Autenticação por cookie significa **credencial ambiente**: o navegador envia o cookie mesmo
numa requisição originada de outro site. `SameSite=Lax` mitiga, não elimina. Por isso, toda
rota de escrita exige `X-CSRF-Token` (§5.4). O token é emitido no login, guardado **em
memória** no cliente — nunca em `localStorage` (`PADROES-ENGENHARIA.md` §8.4) — e rebuscado
por `GET /api/auth/session` quando a aplicação recarrega.

## Consequências

- Uma consulta ao banco por requisição para ler a sessão. Irrelevante nesta escala, e o
  `PRIMARY KEY` da tabela é a chave de acesso.
- A coleta de sessões vencidas precisa existir: roda com `LIMIT` junto da limpeza de
  `login_attempts`, nunca varrendo a tabela inteira (§7.3).
- Frontend e backend não podem ser hospedados em domínios diferentes sem revisitar este ADR.
  Em compensação, a arquitetura de um contêiner é exatamente o que o `docker compose up` do
  enunciado pede.

## Gatilho de revisão

Revisitar se surgir consumidor externo da API (aplicativo móvel, integração de parceiro).
Nesse caso a resposta **não** é afrouxar o CORS: é expor um segundo contrato com
autenticação por token de curta validade e escopo próprio, mantendo a sessão de cookie para
o portal.
