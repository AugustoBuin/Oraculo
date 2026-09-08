# Oráculo

> Portal de gestão de catálogo multi-TCG.

Na comunidade de Magic: The Gathering, o **Oracle** é o registro canônico de cada carta — o
texto oficial que diz o que ela realmente faz, acima do que está impresso nela. É a fonte da
verdade do catálogo.

É exatamente o que este portal é: a área administrativa onde o catálogo de cartas de vários
card games é criado, corrigido e governado.

PHP 8.3 e JavaScript de navegador, **sem uma única dependência de terceiros** — nenhum
framework, nenhuma biblioteca, nenhum CDN, nem no backend nem no frontend (ADR-001).

---

## Como rodar

Único pré-requisito: **Docker**.

```bash
docker compose up
```

Abra **http://localhost:8080** e entre com uma das credenciais abaixo. Não há passo manual
nenhum: o boot cria o banco, aplica as migrations e roda o seed, e as três operações são
idempotentes — subir de novo não duplica nada nem reescreve senha de usuário existente.

O MySQL não é publicado para fora da rede do compose. As variáveis do desenvolvimento local
estão no `docker-compose.yml` e não são segredo; em qualquer outro ambiente elas vêm de um
`.env` fora do document root (ver `.env.example`), e a aplicação **falha ao subir** nomeando
a variável ausente — não existe valor default no código.

## Credenciais

Senha dos três: `oraculo123`

| Perfil | E-mail | Nível | O que faz |
|---|---|---|---|
| Administração | `admin@oraculo.local` | `ADMIN` | Tudo, mais a administração de edições e raridades |
| Cadastro | `editor@oraculo.local` | `EDITOR` | Cadastra, edita e exclui cartas |
| Consulta | `consulta@oraculo.local` | `VIEWER` | Só consulta — não vê botão de criar, editar nem excluir |

> **Senha fixa só existe em `APP_ENV=local`.** Em qualquer outro ambiente o seed cria um
> único administrador com senha aleatória, exibida uma vez na saída do boot e nunca gravada.
> Um seed que redefine senha e permissão de administrador a cada deploy é uma porta dos
> fundos com aparência de conveniência.

A permissão é hierárquica e **decidida no servidor, em toda rota**. O que o frontend faz é
esconder o que o perfil não pode fazer — pedir pela URL devolve a mesma recusa.

## As cinco decisões de produto

Justificativas completas em [`docs/PRD.md`](docs/PRD.md) §6. Em resumo:

**1. A cascata se estende à Raridade.** O desafio pede "Raridade da Carta" sem dizer o tipo
de campo. Texto livre permitiria cadastrar uma carta de Magic como *Secret Rare*, que só
existe em Yu-Gi-Oh!. Raridade é específica de cada TCG, então ela carrega por requisição
igual à edição, e reseta junto quando o jogo muda. O princípio é **impedir o erro em vez de
corrigi-lo depois**: dado sujo em catálogo não é notado no cadastro, é notado meses adiante,
quando um relatório não bate.

**2. Exclusão reversível, com confirmação nomeada.** O modal escreve o nome da carta —
*"Excluir Black Lotus de Alpha?"* — porque confirmação genérica é lida no automático depois
da décima vez. E, principalmente: **a proteção real não é a confirmação, é a
reversibilidade.** Depois de excluir, um aviso oferece **Desfazer por 10 segundos**, e por
baixo a exclusão é lógica. Erro humano é inevitável; o que se projeta é quanto ele custa.

**3. Galeria como visão padrão, tabela como alternativa.** Carta é objeto visual: quem opera
um catálogo reconhece pela arte antes de ler o nome. A tabela continua existindo para quem
trabalha em volume e precisa comparar campos lado a lado, e a escolha fica lembrada.

**4. Imagem por upload, com URL como alternativa.** Pedir a URL de uma imagem a alguém não
técnico é transferir trabalho de engenharia para o usuário. O caminho padrão é escolher o
arquivo e ver a pré-visualização imediata; o campo de endereço permanece para quem já tem o
link do CDN.

**5. Aviso de duplicidade em vez de bloqueio.** O sistema avisa quando já existe carta com o
mesmo nome na mesma edição, mas não impede: a mesma carta tem múltiplas impressões na mesma
edição, e bloquear seria modelar o domínio errado.

## Roteiro de teste manual

Renderização de DOM fica fora do teste automatizado por decisão registrada
([ADR-004](docs/decisions/ADR-004-tdd-seletivo-e-runner-autoral.md)); este roteiro é a
verificação que ocupa o lugar dela. **Percorra com o console do navegador aberto — ele deve
permanecer limpo do início ao fim.**

Entre como **Administração**.

1. **Os cinco estados do catálogo.** *Carregando*: recarregue a página. *Sucesso*: a galeria
   paginada. *Vazio*: busque `zzzz` — o texto diz o que fazer em seguida. *Erro*: ligue o
   modo offline do DevTools e recarregue; o estado traz **Tentar novamente**, que funciona ao
   voltar a rede. *Sem permissão*: aparece no passo 9.
2. **Busca e filtros.** Digite parte de um nome e encadeie Jogo → Edição → Raridade. Os
   filtros vão para a URL: recarregue e o estado volta idêntico. Edição e raridade só
   habilitam depois do jogo.
3. **As duas visões.** Alterne **Galeria** e **Tabela**; recarregue e a escolha é lembrada.
   Em tela estreita, a tabela rola no próprio eixo — a página não.
4. **A cascata (RF-25).** Em **Nova carta**, escolha um jogo e veja Edição habilitar. Agora
   troque rápido: Magic → Pokémon → Yu-Gi-Oh!, sem esperar. A lista final tem de ser a do
   **último** jogo escolhido — as requisições em voo são canceladas. Trocar o jogo reseta
   edição e raridade.
5. **Imagem.** Escolha um arquivo e veja a pré-visualização aparecer antes de o upload
   terminar. Depois troque para **Usar endereço** e cole uma URL `https` de imagem. Um `.jpg`
   que na verdade é outro tipo é recusado pelo conteúdo, não pela extensão; SVG é recusado.
6. **Aviso de duplicidade.** Cadastre uma carta com nome já existente na mesma edição: o
   aviso aparece com a carta existente, e reenviar confirma o cadastro.
7. **Exclusão e desfazer.** Exclua uma carta: o modal escreve o nome dela. Confirme e clique
   em **Desfazer** dentro de 10 segundos — a carta volta à listagem.
8. **Histórico.** Abra uma carta já editada e veja quem alterou o quê, com valores
   apresentáveis.
9. **Os três perfis.** Saia e entre como **Cadastro**: some o item *Catálogos*. Entre como
   **Consulta**: somem *Nova carta* e *Excluir*. Ainda como Consulta, digite
   `http://localhost:8080/catalogos` na barra de endereços — vem "sem permissão", não uma
   tela quebrada.
10. **Catálogos (só Administração).** Desative uma edição em uso: o aviso diz que as cartas
    que já a usam continuam como estão. O item fica esmaecido **e** com a etiqueta
    "Desativada". Reative em seguida.
11. **Os dois temas.** O botão do cabeçalho cicla *sistema → claro → escuro*. Confira as duas
    aparências e recarregue: a preferência é lembrada.
12. **Só pelo teclado.** Volte ao topo e pressione Tab: o primeiro foco é **Pular para o
    conteúdo**, e Enter leva o foco ao conteúdo. Percorra o roteiro inteiro sem tocar no
    mouse — o foco é sempre visível, o modal prende o foco enquanto está aberto, e Esc fecha
    devolvendo o foco ao botão que o abriu.

## Verificação automatizada

```bash
docker compose exec app php backend/bin/validate.php
```

A cadeia completa: marcador de conflito, `php -l`, fronteiras de camada e testes.

Os testes do frontend rodam no navegador, em **http://localhost:8080/tests** — runner
autoral, pelo mesmo motivo que não há framework. O placar precisa estar verde.

A cobertura não é uniforme, e isso é deliberado: domínio, casos de uso, permissão, validação
e a camada de dados têm TDD estrito; renderização de DOM e repositórios PDO têm o roteiro
manual acima. O critério e o porquê estão no ADR-004.

## O que ficou fora, e por quê

Cortar com justificativa é parte da entrega.

| Fora | Motivo |
|---|---|
| **Gestão de jogos** pela interface | Criar um jogo sem raridades deixaria o sistema num estado pior do que não ter o botão: o primeiro cadastro de carta naquele jogo travaria, sem raridade para escolher. Abrir um TCG novo é operação estrutural e rara, melhor atendida por uma migration que traga o catálogo completo. Edições e raridades, essas sim, se administram pela tela. |
| Cadastro público de usuários e recuperação de senha | É um portal interno com acesso concedido. Recuperação de senha bem feita — token criptográfico, validade curta, limite de tentativas, canal de e-mail — é uma feature inteira, não um campo. |
| CRUD de usuários pela interface | Os três papéis vêm do seed e cobrem a demonstração do RBAC. |
| Importação em massa (CSV) | Alto valor real, alto custo: validação linha a linha, relatório de erro parcial e desfazer de lote. Fica como evolução declarada. |
| Variações da mesma carta (foil, promo, alternate art) | Exigiria uma tabela de variações e mudaria a tela inteira. O desafio pede a carta, não a impressão. |
| Internacionalização da interface | O produto é interno e em português. Os **dados** já são bilíngues (nome EN/PT), que é o que o desafio pede. |
| Testes automatizados de interface | Custo desproporcional na janela de cinco dias. O roteiro acima cobre a verificação. |

## Documentação

| Documento | Conteúdo |
|---|---|
| [PRD](docs/PRD.md) | Visão, personas, requisitos e decisões de UX |
| [Contrato da API](docs/api-contract.md) | Endpoints, envelopes e códigos de erro |
| [Schema do banco](docs/database-schema.md) | Tabelas, índices e massa inicial |
| [Guia de engenharia](docs/ENGENHARIA.md) | Como rodar, fronteiras e convenções |
| [Decisões (ADRs)](docs/decisions/) | Por que não foi feito do jeito óbvio |
| [Design](docs/design.md) | Tokens, escalas e a tabela de contraste dos dois temas |
| [Auditorias](docs/audits/) | Achados abertos e relatórios datados |
| [Backlog do backend](docs/backlog-backend.md) · [do frontend](docs/backlog-frontend.md) | Tarefas com critérios de aceite |
