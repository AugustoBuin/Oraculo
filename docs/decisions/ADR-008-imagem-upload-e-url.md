# ADR-008 — Imagem por upload (padrão) ou por URL, via Strategy

**Data:** 04/09/2026 · **Status:** aceito

---

## Contexto

O enunciado pede o campo "Imagem da Carta" e não especifica a forma. A persona declarada —
*"pessoas com diferentes níveis de familiaridade com a tecnologia"* — é o que decide.

Há também uma restrição de ambiente: o avaliador vai rodar o projeto em uma máquina que não
conhecemos. Qualquer caminho que dependa de permissão de escrita em volume precisa de uma
alternativa que não dependa.

## Opções consideradas

**A. Só campo de URL.** Zero storage, seed trivial, nenhum risco de permissão de volume. Mas
transfere trabalho de engenharia ao usuário: para cadastrar uma carta ele precisaria
hospedar a imagem em algum lugar e saber extrair o endereço. Para a persona descrita, é o
mesmo que não ter o campo.

**B. Só upload.** Um caminho, mais simples de explicar e de validar. Melhor para a persona.
Mas perde a conveniência de quem já tem a URL do CDN — que é justamente o caso da LigaMagic,
cujas imagens de carta vivem em CDN próprio.

**C. Upload como padrão, URL como alternativa.**

## Decisão

**Opção C.** O formulário oferece as duas entradas, com o upload em primeiro plano:
arrastar ou selecionar o arquivo, com **pré-visualização imediata**. O campo de URL fica
disponível como segunda opção, também com pré-visualização.

Isso vira a **Decisão de UX nº 4** do README (PRD §6).

### A Strategy

Duas implementações reais da mesma porta — *"transforme esta entrada numa referência de
imagem utilizável, ou falhe com uma mensagem em português"* — o que satisfaz o teto de duas
implementações do `PADROES.md` §3.1 (ADR-005).

| Estratégia | Responsabilidade |
|---|---|
| `UploadedFileImageSource` | Valida tipo pelo conteúdo, verifica tamanho, gera nome no servidor, grava fora do document root |
| `RemoteUrlImageSource` | Valida o esquema contra a allowlist `http`/`https`, normaliza a URL |

Persistência: o par `(image_type, image_reference)` na tabela `cards`. O apresentador
transforma o par numa `imageUrl` pública — `/api/media/{reference}` para upload, a própria
URL para remoto. **O cliente nunca vê o par**; vê uma URL pronta para usar.

### O upload é um endpoint separado

`POST /api/uploads/card-image` devolve a referência antes de a carta ser salva. Duas razões:
permite a pré-visualização imediata que a decisão de UX exige, e mantém
`POST /api/cards` em JSON puro — misturar `multipart` com JSON no mesmo endpoint gera um
handler que precisa saber de dois formatos.

### As regras de segurança, todas obrigatórias

| Regra | Por quê |
|---|---|
| Tipo validado pelo **conteúdo** (`finfo`), nunca pela extensão | Extensão é dado do cliente, e dado do cliente mente |
| Allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/gif` | **SVG fica de fora deliberadamente** — SVG é XML e carrega script |
| Nome gerado pelo servidor: `bin2hex(random_bytes(16))` + extensão do tipo real | O nome enviado pelo usuário é dado hostil, tanto ao gravar quanto ao exibir |
| Destino **fora do document root**: `backend/storage/uploads/` | Arquivo enviado dentro de pasta pública é execução remota esperando acontecer |
| Servido por rota, com `Content-Type` do tipo validado na gravação | O tipo sai do que foi verificado, não do que o sistema de arquivos adivinha |
| Referência validada contra `^[a-f0-9]{32}\.(jpg\|png\|webp\|gif)$` antes de tocar o disco | Nenhum caractere de caminho passa — sem travessia de diretório |
| URL remota: apenas `http` e `https` | Bloqueia `javascript:`, `data:`, `file:` |

### O seed usa URL, nunca arquivo

Decisão explícita de robustez: a massa inicial referencia imagens por URL
(`image_type = 'remote'`), então o `docker compose up` funciona mesmo se o volume de upload
tiver problema de permissão no ambiente do avaliador. O upload é demonstrado pelo uso, não
pelo seed.

## Consequências

- Uma tabela sem `NOT NULL` em `image_type` e `image_reference`: carta sem imagem é caso
  legítimo, e a interface mostra um espaço reservado legível — nunca um ícone quebrado (RF-34).
- Cada imagem enviada passa pelo PHP ao ser exibida. Custo real, mitigado com
  `Cache-Control` e `ETag`, e irrelevante nesta escala. **Gatilho para mudar:** se o volume
  de imagens próprias crescer, servir por caminho estático dedicado com execução de PHP
  desabilitada no diretório.
- `img-src` da CSP precisa incluir `https:` para permitir imagem remota. É a única
  concessão da política, e está registrada em `api-contract.md` §7.

## Gatilho de revisão

Revisitar se surgir necessidade de processamento de imagem (miniatura, normalização de
formato, remoção de metadados EXIF). Nesse caso a Strategy ganha um terceiro passo de
pós-processamento — e aí a cadeia de responsabilidade do §3.1 passa a valer também aqui.
