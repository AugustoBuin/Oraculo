CREATE TABLE IF NOT EXISTS editions (
    id         INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    game_id    INT UNSIGNED      NOT NULL,
    -- O identificador do JSON do enunciado: dom, war, base1, lob.
    -- Exposto na API como id, para bater com o contrato do desafio.
    code       VARCHAR(32)       NOT NULL,
    name       VARCHAR(120)      NOT NULL,
    active     TINYINT(1)        NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME          NOT NULL,
    updated_at DATETIME          NULL,
    deleted_at DATETIME          NULL,
    PRIMARY KEY (id),
    -- Único DENTRO do jogo: dois TCGs podem usar a mesma sigla.
    UNIQUE KEY uk_editions_game_code (game_id, code),
    KEY idx_editions_listing (game_id, active, deleted_at, sort_order),
    CONSTRAINT fk_editions_game FOREIGN KEY (game_id) REFERENCES games (id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
