# Defesa em profundidade

## O princípio

Depois de corrigir um bug causado por dado inválido, validar **num** ponto parece
suficiente. Mas aquele ponto pode ser contornado por outro caminho de código, por uma
refatoração, ou por um dublê de teste.

> Valide em **cada** camada por onde o dado passa. Torne o bug estruturalmente impossível.

Validação única: *"corrigimos o bug"*.
Camadas: *"o bug ficou impossível"*.

Cada camada pega um caso diferente: a entrada pega o óbvio; a regra de negócio pega o caso
de borda; a guarda de ambiente pega o perigo específico de contexto; a instrumentação
salva quando as três falharem.

> **Cuidado com o excesso.** Camada não é `if` repetido em todo lugar: é validação **na
> fronteira certa**, cada uma com uma razão diferente para existir. Se você não sabe dizer
> que caso aquela camada pega e as outras não, ela é ruído.

---

## As quatro camadas, no vocabulário deste projeto

### Camada 1 — a borda de entrada

Recusar o obviamente inválido onde o dado externo chega: a rota. Campo a campo, com DTO
explícito — nunca o corpo inteiro (`ENGENHARIA.md` §4.3).

```php
// backend/src/Infra/Http/Routes/Card/CreateCardRoute.php
$body = $request->body();

$input = new CreateCardInput(
    nameEn: $this->reader->requireString($body, 'nameEn'),
    editionId: $this->reader->requireInt($body, 'editionId'),
    // o id do autor vem da SESSÃO, nunca do corpo
    authorId: $request->user()->id(),
);
```

### Camada 2 — a regra de negócio

A cadeia de validação e a entidade de domínio. É aqui que mora a regra que sobrevive a
qualquer borda: *raridade tem de pertencer ao mesmo jogo da edição*.

```php
// backend/src/Domain/Card/…
if ($rarity->gameId() !== $edition->gameId()) {
    throw new ValidationError('A raridade não pertence ao jogo da edição.');
}
```

Esta camada está **sob TDD estrito** (ADR-004): cada elo tem teste, e cada regra de
autorização tem o teste do efeito que **não** pode acontecer.

### Camada 3 — a guarda de ambiente

Impedir a operação perigosa no contexto errado. Exemplos reais daqui:

```php
// O seed só cria os três usuários de demonstração em APP_ENV=local.
// Em qualquer outro ambiente: um administrador só, senha de random_bytes,
// exibida uma vez, e SÓ se ainda não houver nenhum usuário.
if (Env::get('APP_ENV') !== 'local') { /* … */ }
```

```php
// A imagem enviada é gravada FORA do document root, com nome gerado pelo
// servidor e tipo conferido pelo CONTEÚDO — nunca pela extensão.
```

### Camada 4 — instrumentação

Contexto para a perícia quando as outras três falharem: log estruturado com o id de
correlação (`TraceId`), sem dado sensível.

```php
$this->logger->warning('upload recusado', [
    'traceId' => $traceId,
    'reason' => 'tipo real diferente do declarado',
    'declared' => $declaredType,
    // nunca: conteúdo do arquivo, token, senha
]);
```

---

## Como aplicar

Ao achar a causa raiz de um bug:

1. **Rastreie o caminho do dado** — onde o valor ruim nasce, por onde passa, onde é usado.
2. **Mapeie os pontos de passagem** — liste cada fronteira.
3. **Acrescente a validação em cada camada** que tenha uma razão própria para existir.
4. **Teste cada camada** — tente burlar a camada 1 e verifique que a 2 pega. Este é o teste
   que a maioria esquece.

---

## Exemplo real deste projeto: a URL de imagem

**Risco:** a carta aceita URL de imagem externa. Uma URL `javascript:` ou `data:` vira XSS;
uma URL `file:` ou de rede interna vira SSRF se o servidor for buscá-la.

| Camada | Onde | O que pega |
|---|---|---|
| 1 | `frontend/src/shared/dom/safe-url.js` | recusa esquema fora da allowlist antes de virar `href`/`src` — e **registra** a recusa |
| 2 | validação de domínio da carta | recusa no servidor, onde o cliente não alcança |
| 3 | política de armazenamento | o arquivo enviado vai para fora do document root, com tipo conferido pelo conteúdo |
| 4 | `Content-Security-Policy` no Apache | `img-src` restrito, `object-src 'none'`, `base-uri 'none'` — a última linha, no navegador |

Nenhuma dessas camadas torna a outra dispensável: a 1 é conveniência (mensagem imediata), a
2 é a barreira de verdade, a 3 limita o estrago de um arquivo malicioso aceito, e a 4 vale
mesmo que as três anteriores tenham um furo.

**A camada 1 sozinha seria teatro** — o cliente não autoriza nada (ADR-007). **A camada 2
sozinha seria suficiente para a segurança**, mas deixaria o usuário descobrir o erro só
depois de enviar o formulário.

---

## A conclusão

As camadas não são redundância burocrática: cada uma existe porque **um caminho diferente
chega até ali**. Caminho de código que contorna a borda, dublê que substitui a regra,
diferença de ambiente, e o dia em que alguém acrescentar uma rota nova.

**Não pare na primeira validação — mas saiba dizer o que cada camada pega.**
