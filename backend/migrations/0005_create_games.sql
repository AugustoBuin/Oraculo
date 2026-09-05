-- O discriminador de tenant. Um ENUM na coluna de cards custaria menos hoje e
-- travaria o produto amanhã: adicionar um TCG novo viraria ALTER TABLE e deploy.
-- Aqui é um INSERT (docs/PRD.md, seção 1.1).
CREATE TABLE IF NOT EXISTS games (
    id         INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    slug       VARCHAR(32)       NOT NULL,
    name       VARCHAR(80)       NOT NULL,
    active     TINYINT(1)        NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME          NOT NULL,
    updated_at DATETIME          NULL,
    deleted_at DATETIME          NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_games_slug (slug),
    KEY idx_games_listing (active, deleted_at, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
