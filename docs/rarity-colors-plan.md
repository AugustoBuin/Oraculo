# Plano — cores de raridade

> **Estado:** aprovado em 10/09/2026 e **executado** na `feature-cores-de-raridade`, com
> backend (B-022) e frontend (F-041) completos. Da verificação na tela faltam a fonte em
> 200%, o tema claro visto na tela e o `EDITOR` pela URL. As cores foram medidas contra a
> paleta que foi para `development` em `ed0785d`. **Onde a execução divergiu do plano: §11.**

---

## 1. O que muda para quem usa

- O `ADMIN` escolhe a cor de uma raridade entre **dez materiais**, ao criar e ao editar.
- A raridade aparece num selo com a cor do material: na galeria, na tabela e na
  administração de catálogos.
- As raridades do seed já chegam pintadas, seguindo a convenção dos próprios jogos — no
  Magic, as cores do símbolo de edição: preto, prata, ouro e laranja.

---

## 2. Decisões

**2.1 A raridade guarda uma chave da paleta, não um hexadecimal.** Com chave, cada cor é um
par fundo/tinta medido nos dois temas. Com hex livre, uma cor que passa no claro reprova no
escuro, e o `ADMIN` não tem como saber. A chave deixa porta aberta para um hex validado
depois (§10).

**2.2 O selo de raridade tem forma própria: fundo do material e uma marca.** Os estados já
usam "fundo suave + tinta" (`badge-attention` e irmãos); um "Ouro" com a mesma forma seria
lido como atenção. O selo de raridade leva uma marca redonda antes do nome (`aria-hidden`) —
é a forma, e não a cor, que diz "isto é raridade". O nome está sempre escrito: cor nunca é o
único sinal.

**2.3 Tokens em par, com o contrato da ação.** `--color-rarity-gold` é o fundo e
`--color-on-rarity-gold` a tinta — o mesmo contrato de `--color-accent` e
`--color-on-accent`. A `/paleta` precisa de uma regra nova: hoje ela trataria o fundo de
raridade como tinta e o mediria contra a superfície — um par que não existe na tela. A
regra é "fundo de raridade só se mede com a própria tinta em cima". Excluí-lo das tintas não
basta, porque o par `on-X` sobre `X` só é gerado quando `X` é tinta: a medida sumiria em vez
de ser criada.

**2.4 A escrita de raridade se separa da de edição.** A `CatalogItemGateway` unificou a
escrita das duas "porque não vai divergir", e a própria entidade `Edition` já avisava:
*"raridade ganha cor e ícone"*. A cor é essa divergência. Pôr `color` no DTO compartilhado
recriaria o M-3 da auditoria — um campo que a edição carrega e ignora. Separa-se só o que
divergiu, criar e alterar; desativar continua um caso de uso só. Preço: quatro classes a
mais (dois casos de uso e duas rotas).

**2.5 Criar sem cor dá grafite; alterar sem cor dá 400.** Grafite é o selo neutro de hoje,
e raridade criada sem escolha fica com a cara de sempre. No `PUT`, que é substituição
(`api-contract.md` §4), cor ausente não pode virar grafite em silêncio — é a armadilha do
achado 3.2, que já zera a ordem.

**2.6 O seed pinta só na inserção; a migration pinta o que já existe.** O seed roda a cada
`docker compose up`. Se reescrevesse a cor no `ON DUPLICATE KEY UPDATE`, desfaria a escolha
do `ADMIN` a cada boot. A migration 0011 cria a coluna e pinta as 15 raridades do seed onde
elas já existem; num banco novo, o seed insere já com a cor.

**2.7 A listagem pública não muda.** `GET /api/games/{gameId}/rarities` continua `{id, name}`:
a cascata é um `<select>` nativo e não mostra cor. A cor sai na listagem da administração
(`?incluirInativos=1`, ao lado de `active` e `ref`) e na raridade dentro da carta.

---

## 3. Achados no caminho

Apareceram ao planejar, e os quatro estão no código que este plano mexe.

**3.1 Não existe "editar" na tela de catálogos.** O painel cria, desativa e reativa; o `PUT`
só é usado para reativar. RF-41 e RF-42 pedem "editar", e o aceite do F-040 fala do código
que "nem é oferecido" na edição — a edição nunca foi feita. Sem ela, "alterar a cor" não tem
onde acontecer. O plano acrescenta **Editar** por linha, e como o painel é um só para os
dois catálogos, as edições ganham renomear junto.

**3.2 Reativar zera a ordem.** `catalog-panel.js` reativa com
`{ name, sortOrder: 0, active: true }`, porque a listagem da administração não devolve
`sortOrder`. Uma "Mítica" reativada pula para o topo da cascata, antes de "Comum". A cor
cairia na mesma armadilha. Correção: a listagem devolve `sortOrder` e `color`, e todo `PUT`
leva o registro inteiro — com teste antes.

**3.3 Os três casos de uso de escrita de catálogo não têm teste.** Criar, alterar e
desativar; só a leitura tem (`ListCatalogUseCasesTest`). O B-021 pedia "um por caso de uso", e o ADR-004 põe caso de uso
sob TDD estrito. O plano escreve esses testes antes de mexer em qualquer linha.

**3.4 O M-3 da auditoria de backend (MEDIUM) segue aberto.** `SaveCatalogItemInput` tem dois
campos mortos e a atualização não usa DTO. A separação da decisão 2.4 fecha o achado pelos
dois lados, do jeito que a própria auditoria sugeriu.

---

## 4. A paleta: dez materiais

Os estados são as pedras do oráculo (`design.md` §2, item 7); as raridades são
**materiais** — metais e minerais. Os matizes ficam nos vãos entre os cinco estados:
perigo 28°, atenção 70°, sucesso 155°, informativo 257°, ação 290°.

> As chaves ficaram em inglês na implementação, como os outros valores do contrato
> (`mythic`, `upload`, `recent`); os nomes em português só aparecem na tela.

| Chave | Nome | Claro: fundo · tinta | Razão | Escuro: fundo · tinta | Razão |
|---|---|---|---|---|---|
| `graphite` | Grafite | `#e9e9ed` · `#38373e` | 9,72 | `#303034` · `#dedde3` | 9,74 |
| `silver` | Prata | `#e3eaf3` · `#5c6979` | 4,62 | `#2b3138` · `#959fae` | 4,91 |
| `copper` | Cobre | `#ffe3d6` · `#a94a14` | 4,68 | `#472718` · `#d88762` | 4,81 |
| `gold` | Ouro | `#ffe8a4` · `#7d6500` | 4,64 | `#3a2f0a` · `#b49d55` | 4,96 |
| `olivine` | Olivina | `#dcf2c8` · `#517227` | 4,64 | `#29351c` · `#8caa6f` | 5,00 |
| `patina` | Pátina | `#c9f4ee` · `#00766e` | 4,63 | `#153733` · `#67ada5` | 4,98 |
| `aquamarine` | Água-marinha | `#caf1ff` · `#00718d` | 4,68 | `#123541` · `#62aac2` | 4,99 |
| `tourmaline` | Turmalina | `#fbdeff` · `#93499e` | 4,61 | `#3d2641` · `#c184cb` | 4,79 |
| `rose-quartz` | Quartzo rosa | `#ffe0ea` · `#a4476e` | 4,62 | `#432631` · `#d283a0` | 4,80 |
| `obsidian` | Obsidiana | `#242232` · `#e7e5fb` | 12,59 | `#07060f` · `#d0cbf6` | 13,01 |

- **Ponto de partida medido, não valor final.** Tudo passa de 4,6:1 (o piso é 4,5). O ajuste
  fino se faz na `/paleta`, com os dois temas lado a lado.
- **Os pares a olhar primeiro na tela:** Pátina × Água-marinha, os dois selos mais parecidos
  entre si (ΔE OKLab 8,5 no claro, 7,5 no escuro), e Cobre × selo de atenção, o selo de
  raridade mais perto de um selo de estado (8,2, no claro).
- **Grafite é, de propósito, o selo neutro de hoje.** Raridade que ninguém pintou continua
  com a cara atual.
- **Obsidiana é o único selo de fundo preto.** No claro ela inverte (fundo preto, tinta
  clara); no escuro, afunda abaixo da superfície. Um vidro preto, o selo que mais se
  destaca, para o topo da escala.

**As raridades do seed:**

- **Magic:** Comum grafite · Incomum prata · Rara ouro · Mítica cobre — as cores do símbolo
  de edição.
- **Pokémon:** Comum grafite · Incomum prata · Rara ouro · Rara Holo água-marinha · Ultra
  Rara turmalina · Secreta obsidiana.
- **Yu-Gi-Oh!:** Comum grafite · Rara prata (o nome em prata) · Super Rara água-marinha (a
  arte holográfica) · Ultra Rara ouro (o nome em ouro) · Secreta obsidiana.

Olivina, pátina e quartzo rosa ficam livres para as raridades novas.

---

## 5. Backend — em ordem, com o teste antes de cada passo (ADR-004)

1. **Os testes do B-021 que faltam** (achado 3.3), escritos já contra a anatomia nova:
   `CreateEditionUseCase` e `UpdateEditionUseCase`, com `CreateEditionInput` e
   `UpdateEditionInput` — caminho feliz, código inválido, nome vazio, `409`, `404`, código
   imutável — e `DeactivateCatalogItemUseCase` (`wasInUse`, `404`). O RED é a classe que
   ainda não existe; o verde vem do refactor que renomeia os casos de uso genéricos e divide
   o DTO. Fecha o M-3.
2. **`RarityColor`**: enum com as dez chaves em `Domain/Catalog/Entity/`, com o padrão
   `Grafite`, e `Rarity` ganha `color`. Teste: chave válida vira caso, inválida não, e a
   ordem é a da paleta.
3. **Migration `0011_add_rarity_color.sql`**: `color VARCHAR(16) NOT NULL DEFAULT 'grafite'`
   e um `UPDATE … JOIN games` para as 15 raridades do seed. `VARCHAR` e não `ENUM`: a
   allowlist é o enum do domínio, e trocar a paleta não pede migration — o mesmo raciocínio
   de `code` e de `sort`. Repositório fica fora do TDD; a verificação é o `migrate.php` e
   uma leitura.
4. **As portas.** A `CatalogItemGateway` fica só com o que as duas compartilham: `label`,
   `deactivate`, `existsWithCode`, `gameIdOf`, `isInUse`. `insert` e `update` passam para a
   `EditionGateway` e a `RarityGateway`, a de raridade com `RarityColor`. As regras de código
   e de nome saem para um lugar só (`Domain/Catalog/Validation/CatalogItemRules`), usado
   pelas duas escritas. Os dublês em memória acompanham.
5. **`CreateRarityUseCase` e `UpdateRarityUseCase`**: cria com a cor; cria sem cor e sai
   grafite; cor fora da paleta dá `ValidationError` em `color`; alterar sem cor dá `400` em
   `color`; alterar troca nome, ordem, ativo e cor. Mais as regras que já valiam: código,
   nome, `409`, `404`.
6. **Rotas.** `CreateRarityRoute` e `UpdateRarityRoute`, e as de edição com o nome novo,
   leem `color` com `is_string`, campo a campo — nunca o corpo inteiro. Todas atrás de
   `Guard::protect(…, ADMIN)`, com o mapa conferido no `bin/routes.php`.
7. **Apresentadores** (estão na lista de TDD do ADR-004): a raridade da administração ganha
   `color` e `sortOrder`, e a raridade dentro da carta ganha `color`. Mais um teste
   afirmando que a listagem pública **não** ganhou campo nenhum.
8. **A leitura da carta**: `r.color AS r_color` no mesmo `JOIN` do `CardRepositoryPdo`, sem
   consulta nova (§7.3).
9. **Seed**: a cor vai na inserção e fica fora do `ON DUPLICATE KEY UPDATE` (decisão 2.6).

---

## 6. Frontend

1. **Tokens.** Os dez pares nos dois temas, em `tokens.css` — no claro e nos dois blocos do
   escuro. A regra nova da `/paleta` (`contrastPairs` em `palette.js`: fundo de raridade
   só com a própria tinta, nunca contra a superfície) entra com teste antes, em
   `palette.test.js` — afirmando as duas metades: o par `on-rarity` sobre `rarity` existe, e
   o par fundo de raridade sobre superfície não. A `/paleta` passa de 56 para 76 medidas.
2. **A paleta no cliente**: `shared/theme/rarity-colors.js` (em `shared/` porque `cards` e `catalogs` usam, e feature não importa de feature), com a lista ordenada de
   `{ key, label }` e o padrão. Ela espelha o enum do backend, e a fonte comum dos dois é a
   tabela do `api-contract.md`.
3. **Parsers** (teste antes, em `catalogs-api.test.js` e `cards-api.test.js`): a listagem da
   administração lê `color` e `sortOrder`, criar e alterar enviam `color`, e a raridade da
   carta lê `color`. Chave desconhecida vira grafite com `console.error`: uma cor nova no
   banco não pode derrubar a galeria, do mesmo jeito que um item fora do contrato não
   derruba a cascata.
4. **`rarityBadge`** (`shared/components/`, pelo mesmo motivo): um
   `span.badge.rarity-chip.rarity-<chave>`, com a marca `aria-hidden`. A cor entra por
   classe — dez regras curtas apontando `--rarity-fill` e `--rarity-ink` para os tokens —,
   nunca por `style`, que a CSP não deixa pintar. Com teste no runner, no formato do
   `card-tile.test.js`.
5. **`rarityColorField`**: um `fieldset` com a `legend` "Cor" e dez
   `input type="radio"` nativos. Setas do teclado, um ponto de tabulação só, e o leitor de
   tela anuncia a posição no grupo sem código nenhum. Cada opção **é o próprio selo**, com o
   nome escrito: quem escolhe vê exatamente o que vai aparecer na carta, e escolhe pelo nome
   se não distingue os tons. Grade que reflui (`minmax(min(…, 100%), 1fr)`), alvo de 44px,
   anel de foco via `:has(:focus-visible)`, e a opção marcada se distingue por borda e
   ícone, não só por cor.
6. **O painel de catálogo** continua sem saber se mexe em edição ou em raridade: quem monta
   passa um `appearance` opcional (`{ field, badge }`), e só a página de raridades passa.
   Cada linha ganha **Editar** (achado 3.1): formulário na própria linha com o nome e, se
   houver, a cor; o código aparece e fica travado; Salvar e Cancelar, e o foco volta para a
   linha. Reativar e salvar mandam o registro inteiro (achado 3.2).
7. **Onde o selo aparece**: `card-tile.js`, no lugar do selo neutro; `card-table.js`, na
   coluna Raridade; e as linhas da administração. Filtro e cascata continuam `<select>`
   nativo, sem cor.
8. **Geometria**: o seletor e o formulário de edição entram no `layout-geometry.test.js` —
   nove larguras, em 16 e 32px —, com "Água-marinha" e "Quartzo rosa" sem quebrar palavra.
9. **Na tela**, porque a suíte não pega: os dois temas, zoom de 200%, o grupo de rádio pelo
   teclado, o `EDITOR` chegando pela URL, e a `/paleta` sem nenhuma reprovação.

---

## 7. Contrato e documentos, no mesmo commit de cada mudança

- `api-contract.md` §4: `color` no corpo de criar raridade (opcional) e de alterar
  (obrigatório); a lista das dez chaves; `400` em `color`; `color` e `sortOrder` na
  listagem da administração. §5: `rarity: { id, name, color }` na carta.
- `database-schema.md`: §3.7 e o índice de migrations (§5).
- `design.md`: §2 (os materiais), §3 (os pares novos), §4 (o papel "raridade") e §8 (a
  convenção `rarity`/`on-rarity`).
- `PRD.md`: um RF-44 para a cor da raridade, e a linha dele na rastreabilidade.
- `backlog-backend.md` e `backlog-frontend.md`: B-022 e F-041, no formato de sempre —
  entregar, aceite, testes.
- `audits/open-findings.md`: M-3 fechado, e os achados 3.1 e 3.2 registrados com a
  correção.

---

## 8. Branch e commits

A branch depende do merge da `feature-paleta-liga-pokemon`: as cores foram medidas contra as
superfícies dela, e as duas mexem em `tokens.css` e em `design.md`. Com o merge feito,
`feature-cores-de-raridade` sai de `development`.

Um commit por passo, com a suíte verde em cada um e o RED anotado na mensagem quando o passo
é TDD:

1. `test(catalogo): a escrita de catálogo ganha os testes do B-021`
2. `refactor(catalogo): edição com DTO de criação e de alteração [M-3]`
3. `feat(dominio): a raridade tem cor`
4. `feat(banco): a coluna color, com as raridades do seed já pintadas`
5. `feat(catalogo): criar e alterar raridade com cor`
6. `feat(http): a cor sai na administração e na carta`
7. `feat(estilo): os dez materiais, medidos na /paleta`
8. `feat(front): o selo de raridade e o seletor de cor`
9. `fix(front): editar item de catálogo, e reativar sem perder a ordem`
10. `test(layout): o seletor e a edição na rede de geometria`
11. `docs: contrato, schema, PRD e backlog das cores de raridade`

Merge `--no-ff` em `development`. Sem push: a limpeza dos trailers continua sendo o último
passo da entrega.

---

## 9. Tempo

Backend, cerca de 2h30 — metade disso é o teste que faltava no B-021 e o refactor. Frontend,
cerca de 3h. Documentos e verificação na tela, cerca de 1h. **Seis a sete horas no total.**

---

## 10. Fora deste plano

- **Hex livre.** A chave deixa espaço para um `custom` validado, se o uso pedir.
- **Ordem editável.** Item novo continua entrando com ordem 0, no topo da cascata; o campo
  "Ordem" no formulário de edição é o passo seguinte natural.
- **Cor no filtro e na cascata.** `<option>` nativo não pinta, e trocá-lo por um controle
  próprio custaria acessibilidade.
- **`oklch()`** — ver `design.md` §10.

---

## 11. O que a execução mudou

- **O seletor não tem moldura** (§6, item 5, dizia "borda e ícone"). A primeira versão punha
  borda e padding em volta de um selo que já tem padding; a rede de geometria mediu a opção
  "Obsidiana" em 223,61px contra 222 disponíveis, em 320px com a fonte em 200%. A opção
  marcada se distingue pelo rádio e pelo contorno do selo, e o anel de foco é o de sempre,
  no próprio rádio — sem `:has(:focus-visible)`. A legenda é "Cor do selo".
- **A geometria da edição monta os dois painéis no `.switcher`**, como a página. Sozinho num
  bloco, o painel transbordava para dentro do próprio padding, e a medida contra a borda do
  contêiner não via.
- **Dois defeitos só apareceram na tela** (notas no ledger, 11/09): a legenda colada no campo
  de cima e os controles nativos no esquema do sistema em vez do tema escolhido — este,
  anterior à branch.
- **Os commits** não seguiram a lista do §8 um a um: os testes do B-021 entraram com o
  refactor que eles cobrem (`437dd3e`), a paleta e o selo subiram para `shared/` num commit
  próprio (`1281116`), e o seletor, o painel e as duas correções da tela saíram em quatro
  (`6029661`, `fd8960f`, `0816198`, `eea0502`).
