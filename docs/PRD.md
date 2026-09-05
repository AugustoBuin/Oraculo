# PRD — Oráculo

**Versão:** 1.0 · **Data:** 04/09/2026 · **Autor:** Augusto Henrique Buin
**Contexto:** desafio técnico — Desenvolvedor(a) Full Stack com foco em Front-end · LigaMagic
**Janela de entrega:** 04/09 a 08/09 (construção) · 09/09 a 10/09 (aprimoramento e testes)

---

## 1. Visão

> **Oráculo** é o núcleo de gestão de catálogo de uma plataforma multi-TCG:
> um portal administrativo onde pessoas com diferentes níveis de familiaridade técnica
> cadastram, corrigem e organizam cartas de vários card games — sem conseguir criar dado
> inválido, e sem que um erro humano custe caro.

### 1.1 O posicionamento e por que ele importa

O desafio pede um `<select>` com três jogos. A LigaMagic opera hoje **treze portais**
(LigaMagic, LigaPokemon, LigaYugioh, LigaOnePiece, LigaDigimon, LigaFAB, LigaVanguard,
LigaLorcana, LigaStarWars, LigaDragonBall, LigaGundam, LigaRiftbound e LigaSorcery) sobre
a mesma base de código multi-tenant.

O campo "Card Game" do desafio já é, estruturalmente, um **discriminador de tenant**.
Modelar isso corretamente custa a diferença entre um `ENUM('magic','pokemon','yugioh')` e
uma tabela `games` — praticamente nada — e muda o produto: **adicionar o LigaLorcana passa
a ser um `INSERT`, não um deploy.**

**O limite explícito:** a modelagem sugere a capacidade; o escopo entregue continua sendo
o que foi pedido. Nada de troca de tenant em runtime, white-label, subdomínios ou
permissão por tenant. Um CRUD impecável vale mais que meia arquitetura genial
(`PADROES.md` §1.3 — padrão que não elimina nada é decoração).

---

## 2. Usuários

O desafio define a persona: *"pessoas responsáveis pela gestão das cartas, com diferentes
níveis de familiaridade com a tecnologia"*. Isso não é um detalhe de contexto — é o
requisito de produto central, e está na origem da maior parte das decisões de UX abaixo.

| Perfil | Quem é | O que precisa | Nível |
|---|---|---|---|
| **Consulta** | Atendimento, comercial, alguém que só precisa conferir um dado | Encontrar uma carta rápido e ver os dados corretos. Não deve conseguir alterar nada — nem por acidente. | `VIEWER` |
| **Cadastro** | Quem opera o catálogo no dia a dia, volume alto, pressa | Cadastrar e corrigir cartas sem pensar em estrutura de dados, e desfazer quando errar. | `EDITOR` |
| **Administração** | Quem responde pelo catálogo | Tudo acima, mais abrir um jogo novo, uma edição nova ou uma raridade nova sem depender de deploy. | `ADMIN` |

> **Por que o papel de consulta existe.** É a resposta direta ao "diferentes níveis de
> familiaridade com a tecnologia". A forma mais eficaz de proteger quem tem menos
> familiaridade não é uma interface mais simples — é **não dar a ela um botão que ela não
> precisa apertar**.

---

## 3. Escopo

### 3.1 Dentro do escopo

| # | Entrega |
|---|---|
| E1 | Autenticação por login e senha, com sessão de servidor revogável |
| E2 | Autorização por três níveis hierárquicos, validada no servidor em toda rota |
| E3 | CRUD de cartas: listar, incluir, editar, excluir — com exclusão reversível |
| E4 | Cascata **Jogo → Edição → Raridade** com carregamento assíncrono, loading e reset |
| E5 | Imagem da carta por upload com pré-visualização, ou por URL |
| E6 | Busca e filtros na listagem, com paginação |
| E7 | Duas visões da listagem: galeria (padrão) e tabela |
| E8 | Gestão de jogos, edições e raridades pelo `ADMIN` |
| E9 | Trilha de auditoria: quem criou, alterou, excluiu ou restaurou cada carta |
| E10 | Tema claro e escuro completos |
| E11 | Ambiente reprodutível com `docker compose up`, schema e seed |
| E12 | Testes unitários com runner autoral |
| E13 | README de entrega com credenciais e decisões de produto justificadas |

### 3.2 Fora do escopo — e por quê

Cortar com justificativa é parte da entrega. O anúncio pede alguém que saiba
*"equilibrar qualidade, prazo e complexidade"*; a lista abaixo é essa habilidade por escrito.

| Fora | Motivo |
|---|---|
| Cadastro público de usuários e recuperação de senha | É um portal interno com acesso concedido. Recuperação de senha bem feita (token criptográfico, validade curta, limite de tentativas, canal de e-mail) é uma feature inteira, não um campo. |
| CRUD de usuários pela interface | Os três papéis vêm do seed e cobrem a demonstração do RBAC. A tela de usuários não acrescenta nada ao que já está sendo avaliado. |
| Importação em massa (CSV/planilha) | Alto valor real, alto custo. Precisa de validação linha a linha, relatório de erro parcial e desfazer de lote. Fica como evolução declarada. |
| Variações da mesma carta (foil, promo, alternate art) | Modelagem correta exigiria uma tabela de variações e mudaria a tela inteira. O desafio pede a carta, não a impressão. |
| Internacionalização da interface | O produto é interno e em português. Os **dados** já são bilíngues (nome EN/PT), que é o que o desafio pede. |
| Testes automatizados de interface | Custo desproporcional na janela de 5 dias. Roteiro de teste manual documentado no README cobre a verificação. |
| Multi-tenant em runtime (subdomínio, white-label) | A modelagem suporta; a feature não entra. Ver §1.1. |

---

## 4. Requisitos funcionais

### 4.1 Autenticação e sessão

| ID | Requisito |
|---|---|
| RF-01 | O usuário acessa o portal com e-mail e senha. |
| RF-02 | Credencial inválida devolve **a mesma mensagem** para "usuário inexistente" e "senha errada" (impede enumeração de usuários). |
| RF-03 | Após 5 tentativas falhas para o mesmo par (e-mail, IP) em 15 minutos, novas tentativas são recusadas por 15 minutos. |
| RF-04 | A sessão vive no servidor, tem prazo de validade e é encerrada no servidor no logout. |
| RF-05 | Trocar a senha de um usuário encerra **todas** as sessões dele. |
| RF-06 | Toda rota, exceto o login, exige sessão válida e o nível mínimo declarado no registro da rota. |
| RF-07 | Toda operação que altera estado exige token anti-CSRF válido. |
| RF-08 | Sessão expirada durante o uso leva o usuário à tela de login com aviso claro, preservando a intenção quando possível. |

### 4.2 Cartas

| ID | Requisito |
|---|---|
| RF-10 | Listar cartas com paginação, mostrando imagem, nome, jogo, edição e raridade. |
| RF-11 | Buscar cartas por nome em inglês ou em português. |
| RF-12 | Filtrar cartas por jogo, edição e raridade — os filtros se encadeiam entre si. |
| RF-13 | Alternar entre visão galeria (padrão) e visão tabela; a preferência é lembrada no navegador. |
| RF-14 | Incluir carta com: nome EN (obrigatório), nome PT (opcional), jogo, edição, raridade e imagem. |
| RF-15 | Editar qualquer campo de uma carta existente. |
| RF-16 | Excluir uma carta. A exclusão é reversível por um período curto e a carta some das listagens imediatamente. |
| RF-17 | Restaurar uma carta excluída por engano. |
| RF-18 | Consultar o histórico de alterações de uma carta: quem, o quê e quando. |

### 4.3 A cascata — o requisito detalhado do desafio

| ID | Requisito |
|---|---|
| RF-20 | O campo **Edição** inicia **desabilitado**. |
| RF-21 | Ao selecionar um Card Game, o campo Edição dispara uma requisição buscando as edições daquele jogo. |
| RF-22 | Enquanto a requisição está em andamento, o campo exibe estado de **carregando** e permanece desabilitado. |
| RF-23 | Concluída a requisição, o `<select>` de edições é populado com o resultado e habilitado. |
| RF-24 | Ao trocar o Card Game, a lista de edições é **recarregada** e a seleção anterior é **resetada**. |
| RF-25 | Trocas rápidas e sucessivas de Card Game nunca podem resultar na lista errada: toda requisição em voo é cancelada quando outra começa. |
| RF-26 | Falha na busca de edições exibe estado de erro com ação de "tentar novamente", sem travar o formulário. |
| RF-27 | O campo **Raridade** segue exatamente o mesmo comportamento de RF-20 a RF-26, encadeado ao Card Game. |

> **RF-25 é o requisito invisível.** O desafio pede "recarregar e resetar"; sem cancelamento
> de requisição, trocar Magic → Pokémon → Yu-Gi-Oh! em sequência rápida pode fazer a resposta
> atrasada do Magic sobrescrever a lista correta. É o bug que o item 2.d está caçando.

### 4.4 Imagem

| ID | Requisito |
|---|---|
| RF-30 | A imagem pode ser enviada por upload, com pré-visualização imediata antes de salvar. |
| RF-31 | Alternativamente, a imagem pode ser informada por URL, também com pré-visualização. |
| RF-32 | O upload valida **tipo pelo conteúdo do arquivo** (não pela extensão) e tamanho máximo, no cliente e novamente no servidor. |
| RF-33 | URL informada aceita apenas os esquemas `http` e `https`. |
| RF-34 | Carta sem imagem exibe um espaço reservado legível, nunca um ícone de imagem quebrada. |

### 4.5 Catálogos (`ADMIN`)

| ID | Requisito |
|---|---|
| RF-40 | Listar, incluir, editar e desativar jogos. |
| RF-41 | Listar, incluir, editar e desativar edições de um jogo. |
| RF-42 | Listar, incluir, editar e desativar raridades de um jogo. |
| RF-43 | Um item de catálogo em uso por alguma carta não pode ser excluído — apenas desativado. Desativado, ele deixa de aparecer para novos cadastros mas continua exibido nas cartas que já o usam. |

---

## 5. Regras de negócio

| ID | Regra |
|---|---|
| RN-01 | Uma edição pertence a exatamente um jogo. Uma carta só pode receber edição do jogo selecionado. |
| RN-02 | Uma raridade pertence a exatamente um jogo. Uma carta só pode receber raridade do jogo selecionado. |
| RN-03 | Nome em inglês é obrigatório; nome em português é opcional (o desafio diz explicitamente "pode existir ou não"). |
| RN-04 | **Não existe unicidade de nome por edição.** Em card games reais, a mesma carta tem múltiplas impressões na mesma edição (terrenos básicos em Magic são o caso clássico). Em vez de bloquear, o sistema **avisa** que já existe carta de mesmo nome naquela edição e pede confirmação. |
| RN-05 | Exclusão de carta é lógica (soft delete). Cartas excluídas não aparecem em nenhuma listagem nem contagem, mas o histórico é preservado. |
| RN-06 | Toda criação, alteração, exclusão e restauração de carta gera um registro de auditoria com autor, ação e horário. |
| RN-07 | Os níveis de permissão são hierárquicos: quem é `ADMIN` pode tudo que o `EDITOR` pode, que pode tudo que o `VIEWER` pode. |
| RN-08 | A identidade do solicitante vem **sempre** da sessão, nunca do corpo da requisição. |

---

## 6. Decisões de UX e Produto

O desafio exige pelo menos duas decisões descritas e justificadas no README. Estas são as
cinco tomadas; as duas primeiras são as que vão em destaque.

### ⭐ Decisão 1 — A cascata se estende à Raridade

**O que:** o campo Raridade se comporta exatamente como o campo Edição — inicia
desabilitado, carrega por requisição ao selecionar o jogo e reseta quando o jogo muda.

**Por quê:** o desafio pede apenas "Raridade da Carta", sem especificar o tipo de campo.
Um campo de texto livre permitiria cadastrar uma carta de Magic como *Secret Rare* — uma
raridade que só existe em Yu-Gi-Oh!. Raridade **é específica de cada TCG**: Magic tem
*Mítica*, Yu-Gi-Oh! tem *Super Rara*, Pokémon tem *Rara Holo*.

O princípio é **impedir o erro em vez de corrigi-lo depois**. Dado sujo em catálogo não é
notado no cadastro; é notado meses adiante, quando um relatório não bate. E, do ponto de
vista de custo, isso reaproveita exatamente o mecanismo já construído para as edições.

### ⭐ Decisão 2 — Exclusão reversível, com confirmação nomeada

**O que:** excluir pede confirmação em um modal que **escreve o nome da carta**, e depois da
exclusão um aviso oferece **Desfazer** por alguns segundos. Por baixo, a exclusão é lógica.

**Por quê:** o desafio diz que o portal será usado por pessoas com diferentes níveis de
familiaridade com a tecnologia. Confirmação genérica ("Tem certeza?") é lida no automático
por qualquer pessoa depois da décima vez; um modal que diz *"Excluir **Black Lotus** de
Alpha?"* obriga a reconhecer o objeto. E, principalmente: **a proteção real não é a
confirmação, é a reversibilidade.** Erro humano é inevitável; o que se projeta é quanto ele
custa.

### Decisão 3 — Galeria como visão padrão, tabela como alternativa

Carta é objeto visual: quem opera um catálogo de cartas reconhece pela arte antes de ler o
nome. Uma tabela de linhas de texto obriga a leitura onde o reconhecimento seria instantâneo.
A tabela continua existindo, porque quem trabalha em volume precisa comparar campos lado a
lado — a escolha fica com o usuário e é lembrada.

### Decisão 4 — Imagem por upload, com URL como alternativa

Pedir a URL de uma imagem a alguém não técnico é transferir trabalho de engenharia para o
usuário: ele teria que hospedar o arquivo em algum lugar e saber extrair o endereço. O
caminho padrão é arrastar o arquivo e ver a pré-visualização. O campo de URL permanece para
quem já tem o link do CDN — atende os dois perfis sem penalizar nenhum.

### Decisão 5 — Aviso de duplicidade em vez de bloqueio

O sistema avisa quando já existe carta com o mesmo nome na mesma edição, mas **não impede**.
Bloquear seria modelar o domínio errado: a mesma carta tem múltiplas impressões na mesma
edição. Avisar cobre o caso real (cadastro duplicado por engano) sem inviabilizar o caso
legítimo.

---

## 7. Requisitos não funcionais

| ID | Requisito | Verificação |
|---|---|---|
| RNF-01 | Zero dependências de terceiros no código entregue — nenhum framework, biblioteca, CDN ou pacote, no backend ou no frontend. | Busca por `react|vue|jquery|bootstrap|tailwind|vendor/|node_modules/` no repositório volta vazia. |
| RNF-02 | O ambiente sobe com um único comando, com schema e massa de dados aplicados. | `docker compose up` seguido de login bem-sucedido, sem nenhum passo manual. |
| RNF-03 | Nenhum erro no console do navegador nem no log do PHP em qualquer fluxo. | Percorrer o roteiro de testes manuais do README com o console aberto. |
| RNF-04 | Interface desenhada primeiro para a tela pequena; nenhuma rolagem horizontal na página. | Inspeção em 360px, 768px e 1440px. |
| RNF-05 | Contraste mínimo de 4,5:1 em todo texto, **nos dois temas**, medido. | Tabela de contraste registrada em `docs/design.md`. |
| RNF-06 | Tudo que se faz com o mouse se faz com o teclado; foco sempre visível; modal com foco preso e `Esc` fechando. | Navegação completa por teclado. |
| RNF-07 | Nenhuma requisição, listener ou timer sobrevive à tela que o criou. | Revisão das funções de limpeza; inspeção de memória após navegação repetida. |
| RNF-08 | Nenhum dado externo vira HTML; `Content-Security-Policy` sem `unsafe-inline` e sem `unsafe-eval`. | Cabeçalho conferido; busca por `innerHTML` revisada caso a caso. |
| RNF-09 | Todo `SELECT` com colunas explícitas e limite; nenhuma consulta dentro de laço. | Auditoria de qualidade sobre `src/Infra/Repository/`. |
| RNF-10 | Código escrito para rodar em **PHP 8.1+**, executado em PHP 8.3. | `php -l` na versão alvo; nenhuma sintaxe exclusiva de 8.2+. |

---

## 8. Rastreabilidade — desafio → requisito

Cada linha do enunciado precisa apontar para algo entregue. Esta tabela é o que garante que
nenhuma foi esquecida.

| Item do desafio | Coberto por |
|---|---|
| Área administrativa com login e senha | RF-01 a RF-08 |
| Listar cartas | RF-10, RF-11, RF-12, RF-13 |
| Incluir cartas | RF-14 |
| Editar cartas | RF-15 |
| Excluir cartas | RF-16, RF-17 |
| Nome da carta em inglês | RF-14, RN-03 |
| Nome da carta em português (pode existir ou não) | RF-14, RN-03 |
| Card Game em `<select>` com as três opções | RF-14, seed de `games` |
| Edição inicia desabilitada | RF-20 |
| Edição dispara fetch ao selecionar o jogo | RF-21 |
| Edição mostra loading | RF-22 |
| Edição popula o `<select>` com o resultado | RF-23 |
| Trocar o jogo recarrega e reseta a edição | RF-24, RF-25 |
| JSON de edições conforme especificado | Seed de `editions`, reproduzido literalmente |
| Imagem da carta | RF-30 a RF-34 |
| Raridade da carta | RF-27, RF-42 |
| Backend em PHP sem framework | RNF-01, ADR-001 |
| Banco MySQL | `docs/database-schema.md` |
| Front em HTML5/CSS3/JS vanilla, sem bibliotecas | RNF-01 |
| README com passo a passo de inicialização | RNF-02 |
| README com credenciais de teste | Seed de `users` |
| README com 2+ decisões de UX/Produto | §6 |
| Schema e massa de dados inicial | `docs/database-schema.md` |
| CRUD e autenticação sem erros de execução | RNF-03, roteiro de testes manuais |

---

## 9. Definition of Done da entrega

- [ ] Um avaliador clona, roda `docker compose up`, abre o navegador e loga com as
      credenciais do README — sem nenhum passo manual adicional.
- [ ] Os 26 itens da tabela de rastreabilidade (§8) verificados um a um.
- [ ] Nenhum erro no console do navegador nem no log do PHP em nenhum fluxo.
- [ ] Busca por biblioteca proibida no repositório volta vazia.
- [ ] `php bin/validate.php` verde: sem marcador de conflito, `php -l` limpo, fronteiras
      de camada respeitadas, testes passando.
- [ ] Auditoria de qualidade e de segurança sem achado `CRITICAL`.
- [ ] README completo: como rodar, credenciais dos três perfis, decisões de produto
      justificadas, roteiro de teste manual e o que ficou fora com o motivo.
- [ ] Histórico de commits legível, com Conventional Commits em português.

---

## 10. Cronograma e ordem de corte

| Dia | Entrega | Primeiro item a cair se atrasar |
|---|---|---|
| **04/09** | Planejamento, ADRs, Docker, schema, seed, esqueleto das camadas, autoloader, micro-runner | — |
| **05/09** | Sessão em MySQL, login, CSRF, rate limit, RBAC, guard, pipeline de middleware | — |
| **06/09** | CRUD de cartas, catálogos, Strategy de imagem, auditoria, testes | Trilha de auditoria (E9) |
| **07/09** | Tokens e temas, shell, login, listagem com busca e filtros | Visão tabela (E7) |
| **08/09** | Cascata tripla, exclusão reversível, estados, acessibilidade | Admin de catálogos pela UI (E8) |
| **09–10/09** | Responsivo, contraste medido, auditorias, README, revisão final | — |

**A regra de corte:** se o dia 08 chegar ao fim sem a cascata Jogo → Edição → Raridade
impecável, corta-se qualquer outra coisa. É o requisito que o desafio detalhou em quatro
subitens, e é o que reprova.

---

## 11. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Escopo maior do que a janela de 5 dias | Alta | Alto | Ordem de corte definida em §10, revisada ao fim de cada dia. |
| Arquitetura em camadas consumir tempo demais para o tamanho do problema | Média | Alto | Camadas mantidas, apparatus podado (ADR-002). Fundação inteira concentrada no dia 04. |
| Avaliador interpretar qualquer dependência como violação | Média | **Crítico** | Zero dependências, inclusive Composer (ADR-001). Verificação explícita na Definition of Done. |
| Cascata com race condition passar despercebida | Média | **Crítico** | RF-25 com teste manual explícito de troca rápida no roteiro do README. |
| Contraste do tema escuro reprovar | Média | Médio | Tokens medidos antes do primeiro componente, não depois. |
| Upload quebrar em ambiente do avaliador (permissão de volume) | Baixa | Alto | Caminho por URL sempre disponível como alternativa; seed usa URLs, não arquivos. |
