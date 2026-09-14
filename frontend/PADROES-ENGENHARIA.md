# Padrões de Engenharia — Base Universal

**Versão:** 1.0 · **Escopo:** qualquer linguagem, qualquer framework — inclusive nenhum.

Este documento descreve **o que precisa ser verdade** em um projeto de software e **por quê**.
Ele foi destilado de um sistema em produção (arquitetura em camadas, portão de qualidade
automatizado no push, auditoria periódica, design system com contraste medido), mas todas as
regras foram reescritas sem citar biblioteca, framework ou linguagem: valem igualmente para um
front-end escrito à mão em **JavaScript + HTML + CSS puros**, para um app com framework ou para
um serviço de back-end.

Onde a construção "à mão" exige uma decisão concreta que um framework normalmente tomaria por
você, há um bloco marcado:

> **⚙️ Sem framework** — como aplicar a regra com HTML, CSS e JS puros.

---

## Sumário

| #   | Seção                                                                       | Trata de                                        |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | [Princípios inegociáveis](#1-princípios-inegociáveis)                       | As cinco regras que sustentam o resto           |
| 2   | [Organização e arquitetura](#2-organização-e-arquitetura)                   | Camadas, fronteiras, pastas                     |
| 3   | [Nomenclatura e idioma](#3-nomenclatura-e-idioma)                           | Como nomear e em que língua                     |
| 4   | [Clean code e constantes](#4-clean-code-e-constantes)                       | Funções, duplicação, valores mágicos            |
| 5   | [Camada de dados](#5-camada-de-dados)                                       | Cliente HTTP único, contratos, cache            |
| 6   | [Estado](#6-estado)                                                         | Estado de servidor vs. estado de interface      |
| 7   | [Erros e mensagens](#7-erros-e-mensagens)                                   | Usuário vs. desenvolvedor                       |
| 8   | [Segurança](#8-segurança)                                                   | XSS, segredos, sessão, permissão, dependências  |
| 9   | [Acessibilidade](#9-acessibilidade)                                         | Semântica, teclado, foco, contraste             |
| 10  | [Design system e estilização](#10-design-system-e-estilização)              | Tokens, escala, tema, densidade                 |
| 11  | [Movimento](#11-movimento)                                                  | Quando animar, por quanto tempo, e o piso legal |
| 12  | [Performance](#12-performance)                                              | Orçamento, render, rede, memória                |
| 13  | [Testes](#13-testes)                                                        | TDD, o que mockar, o que nunca mockar           |
| 14  | [Git e fluxo de trabalho](#14-git-e-fluxo-de-trabalho)                      | Branches, commits, tarefas                      |
| 15  | [Portão de qualidade automatizado](#15-portão-de-qualidade-automatizado)    | O gate que roda sozinho no push                 |
| 16  | [Revisão de código](#16-revisão-de-código)                                  | Dimensões e severidades                         |
| 17  | [Auditoria periódica](#17-auditoria-periódica)                              | O que procurar e como reportar                  |
| 18  | [Documentação viva](#18-documentação-viva)                                  | O que documentar e onde                         |
| 19  | [Checklists](#19-checklists)                                                | Definition of Done, PR, tarefa, componente      |
| 20  | [Anexos](#20-anexos)                                                        | Estrutura de pastas, gate sem framework, tokens |

---

## 1. Princípios inegociáveis

Cinco regras. Tudo o mais neste documento é consequência delas.

1. **A dependência aponta para dentro.** Código compartilhado nunca conhece código específico.
   O genérico não pode saber quem o usa. (§2)
2. **Nada de valor mágico.** Toda string, número ou cor que carrega significado de negócio tem
   nome e mora em um só lugar. (§4, §10)
3. **O servidor é a autoridade.** O cliente exibe, formata e facilita — nunca decide o que é
   permitido. Checagem no cliente é conveniência visual, jamais barreira. (§8)
4. **Teste antes do código.** Escreve-se o teste que falha, depois o código que o faz passar.
   Sem exceção para "é só um ajuste". (§13)
5. **O portão de qualidade é automático.** Se a regra depende de alguém lembrar, ela não existe.
   Verificação estática, testes e auditoria rodam sozinhos e bloqueiam o push. (§15)

**Critério final de qualidade.** Uma entrega está bem feita quando: resolve o problema proposto;
não cria acoplamento desnecessário; segue a arquitetura; é fácil de revisar; é fácil de testar;
é compreensível para outra pessoa da equipe; e não gera retrabalho previsível.

---

## 2. Organização e arquitetura

### 2.1 As três camadas

O projeto se organiza em três camadas, com uma regra de dependência estrita:

| Camada             | Contém                                                                   | Pode importar de          |
| ------------------ | ------------------------------------------------------------------------ | ------------------------- |
| **Compartilhada**  | Utilitários, cliente HTTP, componentes genéricos, config, tipos, estilos  | Só da própria camada      |
| **Funcionalidade** | Um domínio isolado do produto (clientes, usuários, agenda…)                  | Compartilhada + ela mesma |
| **Aplicação**      | Rotas/páginas: compõem funcionalidades e camada compartilhada             | Todas                     |

Duas proibições fazem a arquitetura existir de fato:

- **Isolamento entre funcionalidades.** A funcionalidade A **nunca** importa da funcionalidade B.
  Se as duas precisam da mesma coisa, essa coisa sobe para a camada compartilhada.
- **Pureza do compartilhado.** A camada compartilhada **nunca** importa de funcionalidades nem de
  páginas. É isso que a mantém reutilizável e impede dependência circular.

Quando duas funcionalidades "precisam mesmo" conversar, a resposta é sempre uma destas três:
subir o código comum para a camada compartilhada; deixar a página coordenar as duas; ou publicar
um evento e deixar quem se interessa escutar. Nunca um `import` cruzado.

> **⚙️ Sem framework** — a fronteira precisa de um verificador, senão vira sugestão. Um script de
> ~30 linhas lê os arquivos de `src/`, extrai os caminhos de `import … from "…"` com regex e falha
> se: um arquivo de `shared/` importar de `features/` ou `pages/`; ou um arquivo de `features/a/`
> importar de `features/b/`. Rode junto da verificação estática (§15 e Anexo B).

### 2.2 A responsabilidade da página

A página **compõe**. Ela não concentra regra de negócio, não faz estilização própria e não
manipula dados. Responsabilidades legítimas: montar os componentes na ordem certa, disparar o
carregamento inicial e ajustar o layout geral.

Uma página que passa de algumas dezenas de linhas quase sempre está guardando algo que pertence a
um componente, a um módulo de dados ou a um utilitário.

### 2.3 Componentes globais e específicos

- **Globais** (camada compartilhada): botão, campo, modal genérico, cartão, tabela, indicador de
  carregamento, notificação, layout. Não conhecem nenhum domínio.
- **Específicos** (dentro da funcionalidade): cartão de cliente, modal de transferência, filtro de
  atendimento. Conhecem o domínio e vivem junto dele.

Um componente global que precisa de um `if` sobre regra de negócio deixou de ser global. Extraia a
decisão para quem chama (propriedade ou callback) e devolva o componente à neutralidade.

### 2.4 A pasta de uma funcionalidade

Toda funcionalidade tem a mesma forma interna, para que qualquer pessoa saiba onde procurar:

```
features/customers/
├── api/         # comunicação com o servidor + cache desta funcionalidade
├── components/  # UI específica do domínio
├── types/       # contratos e esquemas de validação
├── utils/       # regras puras do domínio (sem I/O, sem DOM)
└── __tests__/   # dublês de rede e utilitários de teste
```

### 2.5 Agrupamento por radical

Quando três ou mais arquivos da mesma pasta compartilham o mesmo radical de nome
(`create-customer-form`, `create-customer-form-header`, `create-customer-form-client`), eles viram uma pasta
com esse radical e um arquivo de índice que reexporta o ponto de entrada. A listagem de pastas
volta a ser legível e o limite do conjunto fica explícito.

### 2.6 Quando quebrar um arquivo

Divida quando qualquer uma for verdade:

- guarda mais de uma responsabilidade (busca dados **e** desenha **e** valida);
- tem mais de um componente exportado com vida própria;
- passou de ~300 linhas sem uma razão explicada em comentário;
- quem lê precisa rolar a tela para entender uma função inteira.

A divisão nunca muda comportamento. Se mudou, são refatoração e funcionalidade misturadas —
separe em dois commits.

### 2.7 Caminhos de importação

Configure um prefixo absoluto para a raiz do código (`@/`) e use-o sempre. `../../../` esconde
violação de camada: com caminho absoluto, a fronteira fica visível na própria linha do import.

> **⚙️ Sem framework** — use `<script type="importmap">` no HTML para apontar `@/` à raiz de
> `src/`. Com módulos ES nativos isso funciona sem nenhuma ferramenta de build.

---

## 3. Nomenclatura e idioma

### 3.1 Idioma

| Informação                            | Idioma    |
| ------------------------------------- | --------- |
| Identificadores de código             | Inglês    |
| Variáveis, funções, classes, arquivos | Inglês    |
| Texto exibido ao usuário              | Português |
| Mensagens de erro para o cliente      | Português |
| Comentários técnicos                  | Português |
| Nomes de teste                        | Português |

### 3.2 Convenções de escrita

| Elemento                | Padrão             | Exemplo                            |
| ----------------------- | ------------------ | ---------------------------------- |
| Variáveis e funções     | `camelCase`        | `customerName`, `createCustomer()`     |
| Classes e componentes   | `PascalCase`       | `CustomerCard`, `SessionStore`         |
| Constantes globais      | `UPPER_SNAKE_CASE` | `DEFAULT_PAGE_SIZE`                |
| Arquivos e pastas       | `kebab-case`       | `date-helper.js`                   |
| Classes CSS e keyframes | `kebab-case`       | `.customer-card`, `@keyframes card-in` |
| Atributos de dado no DOM| `data-kebab-case`  | `data-customer-id`                     |
| Eventos customizados    | `dominio:acao`     | `cliente:transferido`                 |

### 3.3 Regras gerais

- Variáveis, funções e métodos começam em minúscula; classes e componentes, em maiúscula.
- Sem abreviação que prejudique a leitura (`qtd`, `usr`, `tmp`).
- Sem nome genérico sem contexto: `data`, `item`, `obj`, `aux`, `teste`, `handler`.
- O nome diz **o papel**, não o primeiro consumidor. `formatCustomerDate` morre quando a agenda
  precisar dele; `formatShortDate` sobrevive.

---

## 4. Clean code e constantes

### 4.1 Código limpo

- Nomes claros para variáveis, funções, classes e arquivos.
- Funções pequenas, com responsabilidade única.
- Sem duplicação: a terceira ocorrência do mesmo trecho vira função.
- Sem comentário que explique código confuso — reescreva o código.
- Solução simples vence solução engenhosa.
- Responsabilidades separadas nos arquivos e camadas certos.

### 4.2 Comentários

Comentários explicam **por quê**, nunca **o quê**. São escritos em português e existem para: regra
de negócio não óbvia, decisão técnica com alternativa descartada, integração externa e ponto de
atenção para manutenção futura.

```js
// Ruim — repete o que o código já diz
// Soma dois números
const total = valorA + valorB;

// Bom — explica a decisão que o código não consegue contar
// Mantém compatibilidade com clientes antigos que ainda não têm origem normalizada.
const originId = customer.originId ?? FALLBACK_ORIGIN_ID;
```

Comentário sobre performance ou bug evitado traz o número medido, não o adjetivo: "recompilava as
658 fontes a cada deploy — 5,2 min" vale mais do que "estava lento".

### 4.3 Constantes

Todo valor que representa um conceito de negócio é constante nomeada, agrupada por contexto em um
módulo de configuração: autenticação, permissões, mensagens padrão, status do sistema, limites,
configuração de integrações e rotas de API.

```js
export const AUTH_TOKEN_EXPIRATION_SECONDS = 300;
export const DEFAULT_PAGE_SIZE = 20;

export const API_ENDPOINTS = {
  auth: { login: "/auth/login", refresh: "/auth/refresh" },
  customers: { list: "/customers", byId: (id) => `/customers/${id}` },
};
```

**Proibido:** comparar contra literal espalhado (`if (user.role === "ADMIN")`,
`if (status === "finalizado")`), URL de API escrita direto na chamada, número fixo sem explicação.
Cada um é achado CRÍTICO em auditoria (§17).

### 4.4 Configuração de ambiente

Toda configuração que muda entre ambientes vem de variável de ambiente, é **validada em um único
módulo** e consumida só a partir dele. Valor ausente ou malformado falha cedo, com mensagem clara,
e não em produção no meio de uma requisição.

Regras: um arquivo de exemplo versionado (`.env.example`) documentando cada variável; o arquivo
real **nunca** versionado; nenhum segredo do lado do cliente (§8.2).

> **⚙️ Sem framework** — gere um `config.js` no build a partir das variáveis de ambiente, ou sirva
> um `/config.json` lido uma vez na inicialização. Valide com uma função de guarda escrita à mão
> que lança erro nomeando a variável faltante. O que importa é o **ponto único**, não a ferramenta.

---

## 5. Camada de dados

### 5.1 Um cliente, um lugar

Toda comunicação com o servidor passa por **um** módulo cliente. Nenhuma chamada de rede crua
dentro de componente ou página. O cliente centraliza:

- montagem da URL a partir do endpoint nomeado + parâmetros;
- cabeçalhos padrão e credenciais;
- serialização e desserialização;
- **timeout** e cancelamento;
- tradução de erro de transporte em erro de aplicação tipado;
- notificação de erro ao usuário (com opção de silenciar em chamadas de fundo).

Esse ponto único é o que torna possível adicionar retry, telemetria, renovação de sessão ou troca
de protocolo depois — sem varrer o projeto inteiro.

```js
// shared/api-client.js — esqueleto agnóstico
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status; // permite à UI mapear para mensagem amigável
  }
}

export async function request(path, { method = "GET", body, params, signal, silent } = {}) {
  const url = buildUrl(path, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method, headers: buildHeaders(), body: serialize(body),
                                        signal: signal ?? controller.signal, credentials: "omit" });
    if (!response.ok) throw new ApiError(response.status, await safeMessage(response));
    return await safeJson(response);
  } finally {
    clearTimeout(timer);
  }
}
```

### 5.2 Contratos validados na borda

Dados que vêm de fora (servidor, `localStorage`, query string, mensagem de janela) **não são
confiáveis** — nem por segurança nem por formato. Valide na borda, uma vez, e trabalhe com o dado
já normalizado. Nunca espalhe `if (resposta && resposta.dados && resposta.dados[0])` pela UI.

Defina o contrato de cada resposta em um só lugar (esquema, validador ou tipo) e derive o resto
dele. Se o servidor mudar, um arquivo quebra — não vinte.

### 5.3 Envelope e paginação

Padronize o formato de resposta de lista em todo o sistema. Um envelope só, decidido no início:

```json
{ "data": [], "pagination": { "page": 1, "perPage": 20, "total": 0, "totalPages": 0 } }
```

Listas sempre paginadas, com tamanho de página vindo de constante (`DEFAULT_PAGE_SIZE`).

### 5.4 Cache

Toda leitura remota declara explicitamente **por quanto tempo o dado serve** e **quando é
descartado**. Não deixe isso implícito.

| Tipo de dado                      | Política                                     |
| --------------------------------- | -------------------------------------------- |
| Sessão / usuário logado           | Válido até logout ou 401                     |
| Listas de domínio                 | Curto (1–5 min), revalida ao voltar à tela    |
| Catálogos quase estáticos         | Longo (horas), invalidado por versão          |
| Contagem em tempo real            | Sem cache, ou intervalo explícito             |

Duas armadilhas recorrentes:

- **Chave de cache instável.** A chave deve ser composta de valores primitivos
  (`["customers", page, perPage, status]`), nunca de objeto recriado a cada render — objeto novo é
  chave nova é cache que nunca acerta.
- **Invalidação larga demais.** Depois de alterar um item, invalide o escopo mínimo. Derrubar todo
  o cache de um domínio a cada mutação transforma cache em enfeite.

### 5.5 Uma assinatura por dado

Vários componentes irmãos buscando o mesmo dado geram requisições repetidas e estados divergentes
na mesma tela. Suba a busca para o nível da rota e compartilhe o resultado (contexto, store ou
parâmetro). O dado tem **uma** fonte por tela.

> **⚙️ Sem framework** — um "store observável" de ~40 linhas resolve: um `Map` de chave → `{ data,
> updatedAt, subscribers }`, uma função `subscribe(key, cb)` e uma `fetchOnce(key, loader)` que
> deduplica chamadas em voo devolvendo a mesma `Promise`. É exatamente o que as bibliotecas de
> cache fazem — e cabe em um arquivo.

---

## 6. Estado

### 6.1 Dois tipos de estado

| Estado                      | Onde vive                    | Regra                                          |
| --------------------------- | ---------------------------- | ---------------------------------------------- |
| **De servidor** (dados)     | Cache da camada de dados     | Nunca copiado para estado local "para editar"   |
| **De interface** (UI)       | Componente ou store de UI    | Modal aberto, aba ativa, rascunho de formulário |

Copiar dado de servidor para estado local cria duas verdades que divergem no primeiro erro de
rede. Se precisa editar, trabalhe com um rascunho explícito e descarte-o ao confirmar.

### 6.2 Regras

- **Uma fonte de verdade** por informação. Sem sincronização manual entre dois lugares.
- Estado derivado é **calculado**, não guardado (`total = itens.length`, não um contador paralelo).
- Estado global só para o que é global de verdade: sessão, tema, notificações, preferências.
- Mutação passa pela camada de dados (§5), nunca por chamada de rede solta dentro do componente.

> **⚙️ Sem framework** — um store mínimo: `{ getState, setState, subscribe }` sobre um objeto e um
> `Set` de callbacks. Componentes se inscrevem ao montar e **se desinscrevem ao desmontar** —
> vazamento de listener é a fonte número um de bug em app feito à mão (§12.4).

---

## 7. Erros e mensagens

### 7.1 Duas audiências, duas mensagens

**Para o usuário:** português, claro, acionável e sem detalhe técnico.

```
"Não foi possível transferir o cliente. Tente novamente."
```

**Nunca** exiba ao usuário: nome de tabela ou coluna, mensagem de driver de banco, stack trace,
`undefined`, `null`, `[object Object]`, código de exceção interno.

```
✗ "Foreign key constraint failed on field ownerId"
✗ "Cannot read properties of undefined (reading 'id')"
```

**Para o desenvolvedor:** log estruturado, com contexto suficiente para reproduzir.

```js
console.error("[transferCustomer] falha ao transferir", { customerId, ownerId, status, error });
```

### 7.2 Mapa de mensagens

Mensagens de erro de usuário ficam em **um** módulo, mapeadas por status ou código. Isso garante
tom consistente, permite revisão de texto sem tocar em lógica e impede que a mensagem técnica
vaze por descuido em um `catch` esquecido.

### 7.3 Falha contida

- Toda tela tem um estado de erro desenhado — não só o caminho feliz.
- Um erro em um bloco não pode derrubar a página inteira: isole a renderização de cada região e
  degrade só o pedaço afetado.
- Falha em recurso opcional (indicador secundário, imagem, métrica) é **silenciosa** para o
  usuário e registrada para o desenvolvedor.
- Toda leitura de resposta pode falhar: desserialização de corpo malformado precisa de proteção e
  de mensagem de reserva.

### 7.4 Estados obrigatórios de toda tela

Carregando · vazio · erro · sucesso · sem permissão. Um componente que só desenha o caminho feliz
está incompleto, e isso é achado de revisão (§16).

---

## 8. Segurança

> Em front-end, **todo o código é público**. Qualquer pessoa lê o fonte, altera valores em memória
> e refaz as requisições à mão. Segurança no cliente é redução de superfície e proteção do
> usuário — a decisão de autorização é sempre do servidor.

### 8.1 O servidor é a autoridade

- Toda regra de permissão é validada no servidor, a cada requisição.
- No cliente, permissão serve **apenas** para mostrar ou esconder elemento.
- **Anti-padrão TOCTOU:** checar permissão no cliente logo antes de chamar a mutação. A permissão
  pode ter mudado entre a checagem e a chamada, e a checagem não impede quem chama direto na API.
  Retire o guarda antes da mutação; mantenha só o que controla a UI.

### 8.2 Segredos

- **Nenhum segredo no cliente.** Chave de API privada, senha, token de serviço, string de conexão:
  nada disso pode existir em código, em build, em `.env` do front ou em comentário.
- O que é público é público de verdade (URL de API, id de analytics) e fica no módulo de config.
- Arquivos de ambiente reais nunca versionados; só o `.env.example`.
- Um segredo que já foi commitado está comprometido: rotacione a credencial, não basta remover o
  arquivo (o histórico do Git guarda tudo).

### 8.3 XSS — a ameaça principal de quem monta o DOM à mão

**Regra dura: dado que veio de fora nunca vira HTML.**

| Proibido                                   | Correto                                          |
| ------------------------------------------ | ------------------------------------------------ |
| `el.innerHTML = dadoDoUsuario`             | `el.textContent = dadoDoUsuario`                 |
| `el.insertAdjacentHTML(..., dado)`         | `el.append(document.createTextNode(dado))`       |
| `eval(...)`, `new Function(...)`           | não existe caso legítimo no front                |
| `setTimeout("codigo em string")`           | `setTimeout(() => …)`                            |
| `<a href="${urlDoUsuario}">`               | valide o esquema: só `http:` e `https:`          |
| `el.setAttribute("on" + evt, ...)`         | `addEventListener`                               |
| `<img src=x onerror=...>` vindo de dado    | construa elementos, nunca string de markup        |

Regras complementares:

- **Construa elementos, não strings.** `document.createElement` + `textContent` é imune por
  construção. Se precisar de template, use `<template>` + clonagem e preencha só nós de texto e
  atributos conhecidos.
- **Nunca interpole dado em atributo perigoso:** `href`, `src`, `style`, `srcdoc`, `formaction`,
  `data:` e `javascript:` são vetores. Valide o valor contra uma lista de permitidos.
- **Escapamento é por contexto.** O que é seguro em texto não é seguro em atributo, que não é
  seguro dentro de `<script>` ou de URL. Se você precisa de escapamento manual, provavelmente
  deveria estar criando um nó em vez de concatenar.
- **Todo link externo:** `rel="noopener noreferrer"` sempre que houver `target="_blank"` — sem
  isso a página aberta consegue manipular a sua via `window.opener`.
- **Content Security Policy** é a rede de proteção quando algo escapa. Defina no servidor
  (cabeçalho `Content-Security-Policy`) com o mínimo: sem `unsafe-inline`, sem `unsafe-eval`,
  origens de script e de conexão listadas. Isso obriga script e estilo a virem de arquivo — o que
  é bom padrão de qualquer forma.

### 8.4 Sessão e autenticação

- **Token de acesso na memória**, não em `localStorage`: qualquer XSS lê `localStorage`
  instantaneamente. Se persistência entre abas for requisito, prefira cookie `HttpOnly` +
  `Secure` + `SameSite=Strict/Lax` definido pelo servidor.
- **Renovação deduplicada:** quando o token vence com várias requisições em voo, uma única
  renovação deve ser compartilhada por todas (guarde a `Promise` em voo e reaproveite). Sem isso,
  N requisições disparam N renovações que se invalidam entre si.
- **Uma falha de renovação encerra a sessão:** limpe token, dados em memória, cache de dados e
  identidade de analytics, e leve ao login. Logout parcial é vazamento entre usuários no mesmo
  navegador.
- **Expiração tratada como caminho normal**, não como erro inesperado: 401 tem fluxo próprio.
- Nunca registre token, senha ou dado pessoal em log, telemetria ou URL (query string vaza em
  histórico, referer e log de servidor).

### 8.5 Entrada, saída e integrações

- **Valide toda entrada** no cliente para dar feedback rápido — e saiba que a validação real é a
  do servidor.
- **Nunca confie em dado vindo de `postMessage`, `storage`, `hash` ou query string.** Verifique
  origem e formato antes de usar.
- **Upload:** valide tipo e tamanho antes de enviar, e trate o nome do arquivo como dado hostil ao
  exibir.
- **CORS** é configuração do servidor; se você precisou afrouxar para "funcionar", a solução está
  errada.
- **HTTPS sempre**, inclusive em ambiente de homologação. Conteúdo misto quebra a garantia inteira.

### 8.6 Dependências

- Toda dependência nova precisa de justificativa escrita (§18.3). Em projeto sem framework, o
  padrão é **não adicionar**: a maior parte das necessidades de UI cabe em algumas dezenas de
  linhas próprias, e cada pacote é superfície de ataque e dívida de atualização.
- Se usar CDN, fixe a versão exata e use **Subresource Integrity** (`integrity` + `crossorigin`).
  Sem SRI, você delegou o controle do seu site a um terceiro.
- Rode auditoria de vulnerabilidade das dependências no gate (§15).
- Prefira APIs nativas do navegador a pacotes: `Intl` para datas e números, `URL` e
  `URLSearchParams` para links, `fetch` para rede, `AbortController` para cancelamento,
  `crypto.randomUUID()` para identificadores.

### 8.7 Dados pessoais

- Não registre dado pessoal em console, telemetria ou relatório de erro.
- Não guarde dado pessoal em `localStorage` "para acelerar a tela".
- Limpe tudo o que é do usuário no logout — inclusive cache em memória e identidade de analytics.

---

## 9. Acessibilidade

Acessibilidade não é etapa final; é requisito de aceitação de cada componente.

### 9.1 Semântica primeiro

- Use o elemento certo: `button` para ação, `a` para navegação, `nav`, `main`, `section`,
  `article`, `h1`–`h6` na ordem correta.
- `div` clicável só existe quando não há alternativa — e então precisa de `role`, `tabindex="0"` e
  tratamento de `Enter`/`Espaço`. Um `button` nativo já traz tudo isso de graça.
- `label` associado a todo campo (`for`/`id`), com estado de erro anunciado
  (`aria-invalid`, `aria-describedby`).

### 9.2 Teclado

- Tudo que se faz com o mouse se faz com o teclado.
- Ordem de foco segue a ordem visual.
- Modal: foco vai para dentro ao abrir, fica preso enquanto aberto, `Esc` fecha e o foco volta
  para o elemento que abriu.
- **Nunca remova o anel de foco.** Substituir por um anel visível é permitido; suprimir não é.

### 9.3 ARIA

ARIA é remendo, não enfeite. Regras: HTML semântico antes de `role`; rótulo só quando o propósito
não é evidente pelo texto visível; mudança dinâmica importante anunciada por região viva
(`aria-live="polite"` para status, `assertive` só para erro que interrompe).

### 9.4 Contraste

- **Piso de 4,5:1** para todo texto, nos dois temas — **medido**, não estimado.
- Cinza claro "por elegância" é o erro mais caro do sistema: placeholder e metadado somem sob luz
  forte. Todo token novo de texto passa pela medição antes de entrar (§10.2).
- **Regra dos dois sinais:** status, etapa e urgência nunca dependem só de cor. Sempre cor **mais**
  rótulo, ícone ou forma. Cor sozinha exclui daltônicos e morre em impressão e sob sol.

### 9.5 Alvo e leitura

- Alvo de toque mínimo de 44px na base mobile; densidade menor só a partir do breakpoint de
  ponteiro.
- Nada de texto abaixo de 12px.
- Toda imagem informativa tem `alt` descritivo; imagem decorativa tem `alt=""`.
- A interface funciona com zoom de 200% sem perda de conteúdo.

---

## 10. Design system e estilização

### 10.1 Tokens, não valores

Nenhum valor visual repetido direto no componente. Cor, tipografia, espaçamento, raio, sombra,
duração e curva de animação são **tokens** declarados em um só lugar e consumidos por nome.

```css
/* Ruim */
.card { background: #304363; padding: 16px; border-radius: 8px; }

/* Bom */
:root {
  --color-surface: #ffffff;
  --space-card: 1rem;
  --radius-default: 0.5rem;
}
.card {
  background: var(--color-surface);
  padding: var(--space-card);
  border-radius: var(--radius-default);
}
```

> **⚙️ Sem framework** — custom properties CSS no `:root` **são** o sistema de tokens. Um
> `tokens.css` importado antes de tudo, tema por `[data-theme="dark"]` sobrescrevendo as mesmas
> variáveis, e nenhum valor cru fora dele. Sem pré-processador, sem build.

### 10.2 Cor com significado registrado

- **Uma voz de ação.** A cor de acento ocupa no máximo ~10% da tela e marca **uma** ação primária
  por contexto. Se duas coisas clicáveis estão com a cor de acento, uma está errada. A raridade é
  o mecanismo: é o que faz o usuário saber onde apertar sem ler.
- **Papéis semânticos fixos.** Cada matiz tem um significado registrado (sucesso, atenção, perigo,
  informativo, não lido, criação) e não é reaproveitado fora dele. Usar verde "porque ficou bonito"
  quebra a leitura de quem já aprendeu o código.
- **Par superfície/tinta.** Toda superfície de ação declara a cor de texto que vai sobre ela, e as
  duas trocam juntas de tema. Branco fixo não é tinta: quando a superfície clareia no tema escuro,
  o branco reprova no contraste.
- **Cor de canal ≠ cor de estado.** O verde de um canal de mensagem não é o verde de "sucesso":
  canal e resultado são coisas diferentes.

### 10.3 Escala fechada

Tipografia, espaçamento e raio vivem em escalas fechadas e curtas (ex.: 12 / 13 / 14 / 16 / 18 /
25px). **Não se inventa valor intermediário.** Se a escala não atende, a discussão é sobre mudar a
escala — não sobre um valor arbitrário naquele componente.

### 10.4 Profundidade e densidade

- Profundidade vem de tom e borda; sombra é reservada ao que flutua de verdade (modal, popover,
  menu). Cartão em repouso não tem sombra.
- Densidade é permitida; ausência de hierarquia não. Se tudo tem o mesmo peso visual, a tela virou
  planilha e o olho não encontra o que está errado antes de ler o que está certo.

### 10.5 Mobile-first e tema

- Desenhe primeiro para a tela pequena; adicione densidade nos breakpoints maiores.
- Tema claro e escuro completos, com o mesmo significado semântico nos dois. Todo token de cor
  existe nos dois temas ou não existe.
- Nenhuma regra de layout depende de largura fixa em pixel. Contêiner rola no próprio eixo; a
  página nunca rola na horizontal.

### 10.6 Do's e Don'ts

**Do**

- Usar token semântico pelo significado, nunca pela aparência.
- Acompanhar toda cor de status com rótulo, ícone ou forma.
- Ficar dentro da escala tipográfica.
- Dar a toda animação um caminho de movimento reduzido.
- Expressar profundidade com tom e borda; guardar sombra para sobreposição.

**Don't**

- Inventar tamanho intermediário ou valor arbitrário inline.
- Afrouxar um token de texto para um cinza mais claro "por estética".
- Usar cor sem rótulo como único indicador de estado.
- Aplicar gradiente em texto ou efeito decorativo pesado em ferramenta de trabalho diário.
- Remover o anel de foco.

---

## 11. Movimento

### 11.1 Animação tem papel ou não entra

Toda animação serve a um destes papéis: **orientar** (de onde veio, para onde vai), **dar
retorno** (o clique foi registrado), **dirigir atenção** (algo mudou e importa) ou **informar
progresso**. Animação que não serve a nenhum é decoração — e decoração numa ferramenta usada oito
horas por dia é custo, não charme.

### 11.2 Regras de entrada de um movimento novo

1. Serve a um dos quatro papéis.
2. **Nada acima de 400ms.** Acima disso a interface parece lenta. Única exceção: indicador de
   progresso.
3. **Infinito só para progresso.** Movimento perpétuo em paralelo a conteúdo precisa de mecanismo
   de pausa (WCAG 2.2.2); indicador de carregamento é a exceção prevista, rótulo pulsando não é.
4. Duração e curva vêm de token (§10.1), nunca escritas soltas no componente.
5. Nome do keyframe descreve **o papel**, não o primeiro consumidor: `card-in` presa à primeira
   tela morre na migração; `enter-up` sobrevive.

### 11.3 Movimento reduzido

`prefers-reduced-motion: reduce` pede **menos movimento, não menos informação**. Mudança de cor,
opacidade e sombra não é movimento — é o retorno que confirma o clique; matá-la troca um problema
de acessibilidade por outro.

A regra global correta: zera a duração de animação, restringe transições às propriedades que não
deslocam nada (cor, fundo, borda, contorno, opacidade, sombra) e faz transformação, deslocamento,
escala e altura aplicarem o valor final na hora.

Dois detalhes que parecem preciosismo e não são:

- Use `animation-duration: 1ms`, não `0`: o evento de fim de animação ainda dispara, então quem
  espera por ele não trava.
- Toda animação termina em estado **visível**. Uma que termina oculta desaparece de vez quando o
  movimento é desligado.

### 11.4 Uma camada por elemento

Um elemento é animado por **um** mecanismo. Duas camadas (transição CSS + animação por script, ou
duas bibliotecas) disputam o mesmo estilo e o resultado engasga. Defina quem manda no repouso e
quem manda no movimento — e não misture no mesmo elemento.

---

## 12. Performance

### 12.1 Orçamento explícito

Defina e verifique números, não sensações: peso do JS inicial, peso do CSS, tempo até a tela ficar
utilizável, número de requisições na primeira pintura. Sem orçamento, "está rápido" é opinião.

### 12.2 Rede

- Carregue sob demanda o que não é necessário na primeira tela (módulo, imagem, fonte).
- Imagens dimensionadas e com `loading="lazy"` fora da dobra; `width`/`height` declarados para não
  causar deslocamento de layout.
- Requisição repetida em tela é sintoma de cache mal definido (§5.4) ou assinatura duplicada
  (§5.5).
- Deduplique chamadas idênticas em voo.

### 12.3 Render

- Não faça trabalho caro no caminho de desenho: filtro, ordenação e agregação de lista grande são
  calculados uma vez e reaproveitados enquanto a entrada não muda.
- Escritas no DOM em lote; evite alternar leitura e escrita de propriedades que forçam recálculo de
  layout dentro de um laço.
- Listas grandes: delegação de eventos no contêiner (um listener, não mil) e virtualização a partir
  de algumas centenas de itens.
- Anime apenas propriedades baratas (transformação e opacidade). Animar `width`, `top` ou `height`
  força recálculo a cada quadro.

### 12.4 Memória

- Todo listener registrado é removido quando o componente sai — inclusive os de `window`,
  `document`, `IntersectionObserver`, `ResizeObserver`, timer e `EventSource`.
- Todo timer criado é cancelado.
- Toda requisição pendente é abortada quando a tela que a pediu morre.

Em aplicação sem framework, esse trio é a principal causa de degradação depois de meia hora de uso.
Adote a convenção: toda função de montagem devolve uma função de limpeza, e quem monta guarda essa
função.

---

## 13. Testes

### 13.1 TDD é obrigatório

O ciclo é **VERMELHO → VERDE → REFATORAR**:

1. **VERMELHO** — escreva o teste que descreve o comportamento esperado e confirme que ele falha
   *pelo motivo certo* (comportamento ausente, não erro de sintaxe).
2. **VERDE** — escreva o mínimo de código que faz o teste passar.
3. **REFATORAR** — limpe com os testes passando. **Nunca** adicione comportamento nesta etapa.

Não há exceção para "é só um ajuste": correção de bug começa pelo teste que reproduz o bug.

### 13.2 O que testar

| Prioridade | Alvo                                                              |
| ---------- | ----------------------------------------------------------------- |
| Alta       | Regra de negócio pura, permissão, formatação, cálculo, validação  |
| Alta       | Camada de dados: montagem de requisição e tratamento de erro      |
| Média      | Comportamento de componente: o que o usuário vê e faz             |
| Baixa      | Detalhe de implementação interna — quase sempre não deve ser testado |

Teste o **comportamento observável**, não a implementação. Teste que quebra ao renomear uma
variável interna é dívida, não proteção.

### 13.3 O que mockar

**Mocke na fronteira da rede, não os seus próprios módulos.** Substituir o cliente HTTP por um
dublê testa o dublê. Intercepte a camada de rede e devolva respostas controladas: o código real
roda, incluindo montagem de URL, cabeçalhos e tratamento de erro.

- Um registro central de dublês de resposta, alimentado por arquivo de cada funcionalidade.
- Requisição não prevista deve **falhar** o teste, nunca passar silenciosamente.
- Dublês reiniciados entre testes.
- Dado de teste declarado junto do dublê, não espalhado.

### 13.4 Qualidade do teste

- Estrutura Arranjo → Ação → Verificação, visível no corpo do teste.
- Nome em português, descrevendo o comportamento: `"exibe mensagem quando a lista está vazia"`.
- Cobre o caminho de erro e as bordas, não só o caminho feliz.
- Sem dependência de tempo real, ordem de execução ou estado deixado por outro teste.
- Teste instável é bug: conserte ou exclua — nunca ignore silenciosamente.

---

## 14. Git e fluxo de trabalho

### 14.1 Branches

| Branch        | Finalidade                                          |
| ------------- | --------------------------------------------------- |
| `release`     | Deploy oficial de produção                          |
| `main`        | Deploy de testes / homologação                      |
| `development` | Integração — base de tudo que é novo                |
| `feature/*`   | Nova funcionalidade                                 |
| `bugfix/*`    | Correção comum                                      |
| `hotfix/*`    | Correção emergencial                                |

Regras: toda funcionalidade nasce de `development`; nome de branch descreve a entrega
(`feature/criar-integracao-redis`, `hotfix/corrigir-transferencia-cliente`); nomes genéricos como
`ajustes`, `teste`, `correcao` ou `nova-feature` são recusados na revisão.

### 14.2 Commits

- Um commit = uma ideia completa. Refatoração e comportamento novo em commits separados.
- Mensagem no imperativo, dizendo o efeito: `corrige renovação de token duplicada`.
- Nada de commit "wip" na branch que vai ser revisada — reorganize antes de abrir o PR.
- Nunca commite arquivo de ambiente, credencial, `node_modules` ou artefato de build.

### 14.3 Estimativa

| Pontos | Tempo estimado   | Orientação                                       |
| :----: | :--------------: | ------------------------------------------------ |
| 1      | meio dia         | Tarefa pequena e bem definida                    |
| 2      | 1 dia            | Simples, baixo risco                             |
| 3      | 1 a 2 dias       | Moderada, com alguma regra de negócio            |
| 5      | 3 dias           | Complexa, com integração ou múltiplas etapas     |
| 8      | 1 semana         | Grande, alto esforço ou risco técnico            |
| 8+     | **quebrar**      | Dividir em entregas menores                      |

Passou de 8 pontos, quebre. Tarefa grande demais estraga estimativa, revisão, teste, entrega
incremental e identificação de risco.

---

## 15. Portão de qualidade automatizado

> Se a regra depende de alguém lembrar, ela não existe.

### 15.1 O gate de pré-push

Antes de todo `git push`, na ordem — do mais barato ao mais caro, para falhar rápido:

| # | Etapa                        | Falha bloqueia? | Por que existe                                     |
| - | ---------------------------- | :-------------: | -------------------------------------------------- |
| 0 | Árvore limpa                 | Sim             | Auditar código não commitado não faz sentido       |
| 1 | Marcadores de conflito       | Sim             | Um JSON conflitado passa no build e quebra em runtime |
| 2 | Análise estática (lint)      | Sim             | Inclui as fronteiras de camada (§2.1)              |
| 3 | Verificação de tipos/contratos | Sim           | Erro estrutural nunca chega ao servidor            |
| 4 | Testes                       | Sim             | Regressão barrada antes do repositório             |
| 5 | Auditoria de qualidade       | CRÍTICO bloqueia, ALTO avisa | Olha o que ferramenta não vê (§17)  |

Detalhes que fazem o gate funcionar na prática:

- **Instalação automática.** O caminho dos hooks é configurado por um passo de pós-instalação, para
  que ninguém precise instalar nada à mão. Em ambiente que não é um repositório (CI, imagem
  Docker), o passo é um no-op silencioso e não quebra a instalação.
- **Multiplataforma.** O hook é um invólucro fino que delega para o script real; a lógica mora em
  um só lugar, e cada sistema operacional usa o interpretador que tem.
- **Escape consciente.** Existe uma saída de emergência (`--no-verify`), e usá-la é uma decisão
  registrada — não um hábito.
- **Relatório salvo.** Cada execução da auditoria grava um relatório datado (§17.3).

### 15.2 Guarda de marcadores de conflito

Barato, instantâneo e pega uma classe de erro que a verificação de tipos não vê: um arquivo de
dados ou de documentação com marcador de conflito não quebra o build, mas quebra qualquer leitor em
runtime. O script varre os arquivos versionados e falha listando arquivo e linha. Detalhe de
implementação que evita falso positivo: só inspecione arquivos que contenham o marcador de abertura
ou de fechamento — o marcador do meio, sozinho, é sublinhado válido de título em Markdown.

### 15.3 Comandos padronizados

Um comando único que roda a cadeia inteira, e comandos individuais para uso durante o
desenvolvimento:

```
validate   = conflitos → tipos/contratos → lint → testes → build
dev        # ambiente local
build      # build de produção
lint       # análise estática
test       # suíte de testes
format     # formatação automática
audit      # auditoria sob demanda em um intervalo de commits
```

O mesmo `validate` roda no CI. Divergência entre o que roda na máquina e o que roda no servidor é
fonte garantida de "na minha máquina funciona".

### 15.4 Integração contínua

- CI executa exatamente o mesmo `validate`.
- Build quebrado no branch de integração é prioridade máxima da equipe.
- Nenhum merge com CI vermelho, sem exceção.

---

## 16. Revisão de código

### 16.1 Dimensões

| #  | Dimensão                | O que verificar                                                                    |
| -- | ----------------------- | ---------------------------------------------------------------------------------- |
| 1  | Arquitetura e isolamento | Código no lugar certo, sem import cruzado, compartilhado puro                       |
| 2  | Contratos e tipos       | Sem escape de tipagem, validação na borda, contrato bate com o servidor             |
| 3  | Testes                  | Comportamento novo tem teste, caminho de erro coberto, nomes descritivos            |
| 4  | Performance             | Sem trabalho caro no render, sem requisição repetida, sem listener vazando          |
| 5  | Estado                  | Dado de servidor no cache, UI no local certo, sem duas fontes de verdade            |
| 6  | Camada de dados         | Passa pelo cliente único, sem URL solta, erro tratado                               |
| 7  | UI e acessibilidade     | Semântica, teclado, foco, contraste, dois sinais                                    |
| 8  | Qualidade de código     | Sem código morto, nomes claros, responsabilidade única, sem valor mágico            |
| 9  | Convenções              | Nomenclatura, idioma, comentários explicando o porquê                               |
| 10 | Dependências e segurança | Nada supérfluo adicionado, sem HTML de dado externo, sem segredo, config validada    |

### 16.2 Severidades

| Severidade      | Definição                                                | Ação                      |
| --------------- | -------------------------------------------------------- | ------------------------- |
| **CRÍTICO**     | Segurança, correção ou violação de arquitetura           | Corrigir antes do merge   |
| **IMPORTANTE**  | Falta de teste, problema de performance ou acessibilidade| Corrigir antes do merge   |
| **DESEJÁVEL**   | Melhoria opcional, refatoração menor                     | Comentário não bloqueante |
| **PERGUNTA**    | Falta clareza                                            | Perguntar antes de aprovar|

### 16.3 Critérios

**Aprovar quando:** nenhum achado CRÍTICO ou IMPORTANTE; testes passando com cobertura adequada;
arquitetura respeitada; código legível e manutenível.

**Pedir mudanças quando:** existe qualquer achado CRÍTICO; falta cobertura de teste; há problema
IMPORTANTE de performance ou acessibilidade.

A revisão comenta o **código**, nunca a pessoa. Todo achado vem com localização (`arquivo:linha`),
o motivo e uma sugestão concreta de correção.

---

## 17. Auditoria periódica

A auditoria é **somente leitura**: ela varre, analisa e produz relatório priorizado — nunca altera
código. Roda automaticamente no gate de pré-push (§15) e sob demanda antes de release, antes de PR
grande e como checagem semanal do branch de integração.

**Escopo:** código de produção. Infraestrutura de teste (dublês, fixtures, dados de exemplo) é
intencional e fica fora de achados de "valor fixo".

### 17.1 Dimensões

**CRÍTICO — corrigir imediatamente**

- Valor mágico e string fixa que carrega significado (`role === "…"`, `status === "…"`, id numérico
  cravado, rota de API literal).
- Lógica de negócio duplicada — mesma checagem de permissão ou validação repetida em vários
  arquivos em vez de uma função única.
- Violação de fronteira de camada (compartilhado importando de funcionalidade; funcionalidade
  importando de outra).
- Detalhe técnico vazando para o usuário em mensagem de erro (§7.1).
- Falha de segurança: HTML montado a partir de dado externo, segredo no cliente, decisão de
  permissão tomada no cliente (§8).

**ALTO — corrigir antes do release**

- Invalidação de cache larga demais.
- Chave de cache instável (objeto no lugar de primitivos).
- Leitura remota sem política de validade explícita.
- Várias assinaturas independentes do mesmo dado na mesma tela.
- Listener, timer ou requisição sem cancelamento.

**MÉDIO — corrigir antes de fechar a funcionalidade**

- Tratamento frágil de resposta (desserialização sem proteção, ausência de mensagem de reserva).
- Escape de tipagem/validação (conversões forçadas, contrato não verificado).
- Checagem de permissão no cliente imediatamente antes de mutação (TOCTOU, §8.1).
- Cálculo caro repetido no caminho de desenho.

**BAIXO — corrigir quando passar por perto**

- Código morto: bloco comentado, ramo inalcançável, import não usado.
- Checagem de papel escrita inline em vez de usar o utilitário central.
- Nome genérico sem contexto.

### 17.2 Conformidade com as convenções

Verifique também: casing por tipo de elemento (§3.2); idioma correto por tipo de conteúdo (§3.1);
constantes globais em `UPPER_SNAKE_CASE`; nome de branch dentro do padrão (§14.1); e valores de
negócio repetidos que deveriam ser constantes (§4.3).

### 17.3 Formato do relatório

```markdown
# Relatório de Auditoria

**Data:** … | **Branch:** … | **Intervalo:** …

## Sumário executivo

| Severidade | Qtd. | Tempo estimado |
| ---------- | ---- | -------------- |
| CRÍTICO    | 0    | —              |
| ALTO       | 2    | 3h             |
| MÉDIO      | 5    | 4h             |
| BAIXO      | 8    | 1h             |

## CRÍTICO

### <Título do achado>
- **Local:** `caminho/arquivo.js:120`
- **Problema:** o que está errado e por que importa
- **Impacto:** o que quebra ou degrada se não for corrigido
- **Correção:** trecho antes / depois

## ALTO … ## MÉDIO … ## BAIXO … ## Convenções

## Recomendações
1. …
```

O relatório termina com um marcador único em linha própria, para que o gate saiba o que fazer:
`CRITICAL_FOUND` (bloqueia o push) · `HIGH_ONLY` (avisa e libera) · `CLEAN`.

**Critérios de um bom relatório:** todo achado CRÍTICO e ALTO tem `arquivo:linha`; a severidade é
justificada (sem CRÍTICO inflado); todo achado traz correção concreta; nenhuma linha de código foi
alterada.

### 17.4 Ciclo de vida dos relatórios

- Um arquivo vivo (`AUDITORIA-CONSOLIDADA.md`) é a **fonte única de verdade**: cada nova auditoria
  é incorporada nele (deduplicando achados e atualizando status), em vez de ler dez relatórios
  datados soltos.
- Um relatório datado fica na raiz da pasta **apenas** enquanto tiver achado em aberto.
- Resolvidos os achados, o relatório vai para `archive/` e as linhas correspondentes no consolidado
  viram ✅ CORRIGIDO.
- A raiz da pasta de auditoria contém, no máximo, o consolidado e os relatórios em andamento.

---

## 18. Documentação viva

### 18.1 O arquivo de contexto do projeto

Um arquivo na raiz — lido tanto por pessoas novas quanto por assistentes de IA — que responde, em
uma página: como rodar; qual a arquitetura e quais as fronteiras; onde ficam as coisas; quais os
padrões de dados, estado, erro e estilo; como testar; e como o gate de qualidade funciona.

Esse arquivo é **normativo**, não descritivo: quando o código diverge dele, um dos dois está
errado, e a divergência precisa ser resolvida — não ignorada.

### 18.2 Documentos de apoio

| Documento                   | Papel                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| Padrões (este arquivo)      | Regras de qualidade, segurança e organização                         |
| Design system               | Tokens, cores com significado, escala, componentes, do's e don'ts    |
| Movimento                   | Papéis de animação, tempos, curvas, movimento reduzido               |
| Produto                     | O que o sistema faz, para quem, com que regras de negócio            |
| Auditoria consolidada       | Achados em aberto e histórico do que já foi corrigido                |
| Registro de decisões        | Decisão técnica, alternativas descartadas e o porquê                 |

### 18.3 Documentar dependências

Toda biblioteca adicionada é documentada com: nome, motivo de uso, onde é usada, cuidados e link
oficial.

```md
## <nome>
- Motivo: por que foi necessária e o que foi descartado antes
- Local: onde é usada
- Cuidado: armadilha conhecida
- Doc: <url>
```

Em projeto sem framework, o valor desse registro é maior ainda: ele torna visível cada vez que se
escolheu depender de terceiro em vez de escrever 40 linhas próprias.

### 18.4 Registrar decisões

Decisão arquitetural relevante vira um registro curto: contexto, opções consideradas, decisão,
consequências. Quem chegar em seis meses precisa saber por que **não** foi feito do jeito óbvio.

---

## 19. Checklists

### 19.1 Definition of Done

- [ ] Comportamento coberto por teste escrito **antes** da implementação
- [ ] `validate` completo passando localmente
- [ ] Sem violação de fronteira de camada
- [ ] Sem valor mágico novo
- [ ] Estados de carregando, vazio, erro e sem permissão desenhados
- [ ] Mensagens de usuário em português, sem detalhe técnico
- [ ] Acessível por teclado, com foco visível e contraste medido
- [ ] Responsivo do menor breakpoint ao maior
- [ ] Sem listener, timer ou requisição sem cancelamento
- [ ] Documentação atualizada se algo mudou de padrão

### 19.2 Pull request

- [ ] Branch criada a partir da base correta, com nome dentro do padrão
- [ ] Nomenclatura e idioma corretos
- [ ] Responsabilidades separadas; nenhuma regra de negócio em camada errada
- [ ] Sem valor fixo desnecessário
- [ ] Erro técnico não exposto ao cliente
- [ ] Biblioteca nova documentada
- [ ] Testado localmente
- [ ] Tarefa atualizada no rastreador

### 19.3 Criação de tarefa

- [ ] Título claro
- [ ] Descrição explica o problema ou a necessidade
- [ ] Critério de aceite definido
- [ ] Estimativa em pontos definida e ≤ 8
- [ ] Dependências técnicas informadas
- [ ] Escopo limitado e compreensível

### 19.4 Componente novo

- [ ] Está na camada certa (global sem domínio / específico dentro da funcionalidade)
- [ ] Recebe dados por parâmetro; não busca dados sozinho se for global
- [ ] Usa apenas tokens do design system
- [ ] Semântica HTML correta, teclado e foco funcionando
- [ ] Estados de carregando, vazio e erro previstos
- [ ] Movimento dentro das regras (§11)
- [ ] Registra e remove seus listeners
- [ ] Tem teste de comportamento

### 19.5 Revisão de segurança (antes de subir para produção)

- [ ] Nenhum dado externo virando HTML
- [ ] Nenhum segredo no código ou no build do cliente
- [ ] Token fora de `localStorage`; sessão limpa por completo no logout
- [ ] Permissões validadas no servidor; cliente apenas exibe
- [ ] Links externos com `rel="noopener noreferrer"`
- [ ] CSP definida e sem `unsafe-inline`/`unsafe-eval`
- [ ] Dependências com versão fixada, auditadas, e com SRI se vierem de CDN
- [ ] Nenhum dado pessoal em log, telemetria ou URL

---

## 20. Anexos

### Anexo A — Estrutura de pastas para front-end sem framework

```
projeto/
├── index.html
├── .env.example
├── src/
│   ├── shared/                 # camada compartilhada — não conhece ninguém
│   │   ├── api/
│   │   │   ├── client.js       # cliente HTTP único (§5.1)
│   │   │   ├── endpoints.js    # rotas nomeadas (§4.3)
│   │   │   └── errors.js       # ApiError + mapa de mensagens (§7.2)
│   │   ├── components/         # botão, campo, modal, tabela, notificação
│   │   ├── store/              # store observável + cache (§5.5, §6)
│   │   ├── utils/              # funções puras (data, número, texto)
│   │   ├── dom/                # helpers seguros: createElement, on(), cleanup
│   │   └── config/
│   │       └── env.js          # validação de ambiente em ponto único (§4.4)
│   ├── features/               # domínios isolados — nunca se importam
│   │   └── customers/
│   │       ├── api/
│   │       ├── components/
│   │       ├── utils/
│   │       ├── types/
│   │       └── __tests__/
│   ├── pages/                  # composição por rota (§2.2)
│   └── styles/
│       ├── tokens.css          # variáveis: cor, tipografia, espaço, tempo
│       ├── base.css            # reset + elementos
│       └── utilities.css       # utilitários derivados dos tokens
├── scripts/
│   ├── check-boundaries.mjs    # Anexo B
│   ├── check-conflicts.mjs     # §15.2
│   └── setup-hooks.mjs         # configura o caminho dos hooks
└── docs/
    ├── PADROES-ENGENHARIA.md   # este arquivo
    ├── DESIGN.md
    └── auditoria/
        ├── AUDITORIA-CONSOLIDADA.md
        └── archive/
```

### Anexo B — Verificador de fronteiras sem framework

Roda no `validate` e no gate. Falha quando a regra de dependência é violada:

```js
// scripts/check-boundaries.mjs
// globSync existe no Node 22+; em versões anteriores, use uma varredura recursiva própria.
import { readFileSync, globSync } from "node:fs";

const IMPORT_RE = /(?:from|import)\s+["']([^"']+)["']/g;
const violations = [];

for (const file of globSync("src/**/*.js")) {
  const source = readFileSync(file, "utf8");
  for (const [, spec] of source.matchAll(IMPORT_RE)) {
    const from = layerOf(file);   // "shared" | "features/<nome>" | "pages"
    const to = layerOf(spec);
    if (from === "shared" && to !== "shared" && to !== null)
      violations.push(`${file}: shared não pode importar de ${to}`);
    if (from?.startsWith("features/") && to?.startsWith("features/") && from !== to)
      violations.push(`${file}: ${from} não pode importar de ${to}`);
  }
}

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log("✓ fronteiras de camada respeitadas");
```

### Anexo C — Utilitários de DOM seguros por construção

Concentre a manipulação de DOM em três funções e a maior parte do risco de XSS e de vazamento de
listener some do resto do código:

```js
// shared/dom/index.js

// Cria elemento sem nunca aceitar HTML: texto é texto, atributo é validado.
export function el(tag, { text, attrs = {}, children = [] } = {}) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = String(text);       // nunca innerHTML
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on")) throw new Error("use on(), não atributo de evento");
    if ((key === "href" || key === "src") && !isSafeUrl(value)) continue;
    node.setAttribute(key, String(value));
  }
  node.append(...children);
  return node;
}

// Só http(s): bloqueia javascript:, data:, vbscript:
export function isSafeUrl(value) {
  try {
    const { protocol } = new URL(value, location.origin);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Devolve a função de limpeza — quem monta é obrigado a guardá-la (§12.4).
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}
```

### Anexo D — Tokens de design em CSS puro

```css
/* styles/tokens.css — o design system inteiro começa aqui */
:root {
  /* Cor: papel, não aparência */
  --color-bg: #f6f1ea;
  --color-surface: #ffffff;
  --color-ink: #26201e;          /* texto primário   — contraste medido */
  --color-body: #5c504a;         /* texto corrente   — 7,77:1           */
  --color-muted: #7a6a60;        /* metadado         — 5,17:1 (piso)    */
  --color-line: #e8e0d6;
  --color-accent: #f1543f;       /* voz única de ação — máx. ~10% da tela */
  --color-on-accent: #ffffff;    /* par superfície/tinta                 */
  --color-success: #16a34a;
  --color-attention: #ca8a04;
  --color-danger: #dc2626;
  --color-info: #2563eb;

  /* Tipografia: escala fechada */
  --text-xs: 0.75rem;   /* 12px — piso absoluto */
  --text-sm: 0.8125rem; /* 13px */
  --text-md: 0.875rem;  /* 14px */
  --text-lg: 1rem;      /* 16px */
  --text-xl: 1.125rem;  /* 18px */
  --text-2xl: 1.5625rem;/* 25px */

  /* Espaço, raio, sombra */
  --space-1: 0.25rem;  --space-2: 0.5rem;  --space-3: 0.75rem;  --space-4: 1rem;
  --radius-default: 0.5rem;
  --shadow-overlay: 0 8px 24px rgb(0 0 0 / 0.12); /* só para o que flutua */

  /* Movimento */
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 320ms;        /* teto prático: nada acima de 400ms */
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
}

:root[data-theme="dark"] {
  --color-bg: #14100e;
  --color-surface: #1f1a17;
  --color-ink: #f3ece4;
  --color-body: #c9bdb2;
  --color-muted: #948880;        /* remedido no tema escuro */
  --color-line: #2a2420;
}

/* Movimento reduzido: menos movimento, não menos informação (§11.3) */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;   /* o evento de fim ainda dispara */
    animation-iteration-count: 1 !important;
    transition-property: color, background-color, border-color, outline-color, opacity, box-shadow !important;
    transition-duration: var(--duration-fast) !important;
  }
}
```

### Anexo E — Ordem de adoção em projeto novo

Implantar tudo de uma vez trava o início. Esta ordem entrega valor desde o primeiro dia:

| Fase | Quando            | O que instalar                                                                 |
| ---- | ----------------- | ------------------------------------------------------------------------------ |
| 1    | Primeiro commit   | Estrutura de pastas (§2), tokens (§10.1), config validada (§4.4), `.env.example` |
| 2    | Primeira semana   | Cliente HTTP único (§5.1), mapa de mensagens (§7.2), utilitários de DOM (Anexo C) |
| 3    | Primeira semana   | Testes + TDD (§13), `validate`, guarda de conflitos (§15.2)                     |
| 4    | Antes do 1º PR    | Verificador de fronteiras (Anexo B), hook de pré-push (§15.1), checklist de PR   |
| 5    | Antes do 1º deploy| Revisão de segurança (§19.5), CSP, orçamento de performance (§12.1)             |
| 6    | Contínuo          | Auditoria periódica (§17) e consolidado atualizado                              |

---

## Observação final

Este documento é vivo. Sempre que a equipe definir um padrão novo — biblioteca, arquitetura, fluxo
ou convenção — ele é atualizado no mesmo commit que introduz a mudança. Um padrão que só existe na
cabeça de quem o criou não é padrão; é preferência.
