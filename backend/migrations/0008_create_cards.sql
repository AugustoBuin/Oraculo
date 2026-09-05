CREATE TABLE IF NOT EXISTS cards (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- game_id é redundante (derivável por JOIN em editions) e mantido de
    -- propósito: filtrar por jogo é a consulta mais frequente da listagem, e
    -- derivar custaria um JOIN em toda leitura. A coerência entre game_id e o
    -- jogo da edição é garantida pela cadeia de validação (RN-01).
    game_id    INT UNSIGNED NOT NULL,
    edition_id INT UNSIGNED NOT NULL,
    rarity_id  INT UNSIGNED NOT NULL,
    name_en    VARCHAR(150) NOT NULL,
    -- "Pode existir ou não", nas palavras do enunciado.
    name_pt    VARCHAR(150) NULL,

    -- A Strategy de imagem grava o par (tipo, referência): upload guarda o nome
    -- gerado pelo servidor, remote guarda a URL http(s) validada.
    image_type      ENUM('upload','remote') NULL,
    image_reference VARCHAR(2048)           NULL,

    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NULL,
    created_at DATETIME     NOT NULL,
    updated_at DATETIME     NULL,
    deleted_at DATETIME     NULL,

    PRIMARY KEY (id),
    -- NÃO existe UNIQUE (edition_id, name_en), e isso é modelagem correta: em
    -- card games reais a mesma carta tem várias impressões na mesma edição
    -- (terrenos básicos em Magic). O sistema avisa e pede confirmação; não
    -- bloqueia (RN-04).
    KEY idx_cards_game    (game_id,    deleted_at),
    KEY idx_cards_edition (edition_id, deleted_at),
    KEY idx_cards_rarity  (rarity_id,  deleted_at),
    KEY idx_cards_listing (deleted_at, id),
    KEY idx_cards_name_en (name_en),

    CONSTRAINT fk_cards_game       FOREIGN KEY (game_id)    REFERENCES games (id)    ON DELETE RESTRICT,
    CONSTRAINT fk_cards_edition    FOREIGN KEY (edition_id) REFERENCES editions (id) ON DELETE RESTRICT,
    CONSTRAINT fk_cards_rarity     FOREIGN KEY (rarity_id)  REFERENCES rarities (id) ON DELETE RESTRICT,
    CONSTRAINT fk_cards_created_by FOREIGN KEY (created_by) REFERENCES users (id)    ON DELETE RESTRICT,
    CONSTRAINT fk_cards_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
