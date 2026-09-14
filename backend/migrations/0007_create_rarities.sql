-- Raridade é específica de cada TCG: Magic tem Mítica, Yu-Gi-Oh! tem Super
-- Rara, Pokémon tem Rara Holo. Um campo de texto livre permitiria cadastrar
-- carta de Magic como Secret Rare (docs/PRD.md, seção 6, decisão 1).
-- sort_order existe porque raridade tem ordem natural, que não é alfabética.
CREATE TABLE IF NOT EXISTS rarities (
    id         INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    game_id    INT UNSIGNED      NOT NULL,
    code       VARCHAR(32)       NOT NULL,
    name       VARCHAR(80)       NOT NULL,
    active     TINYINT(1)        NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME          NOT NULL,
    updated_at DATETIME          NULL,
    deleted_at DATETIME          NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_rarities_game_code (game_id, code),
    KEY idx_rarities_listing (game_id, active, deleted_at, sort_order),
    CONSTRAINT fk_rarities_game FOREIGN KEY (game_id) REFERENCES games (id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
