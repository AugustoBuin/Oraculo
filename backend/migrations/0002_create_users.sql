CREATE TABLE IF NOT EXISTS users (
    id             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    name           VARCHAR(120)     NOT NULL,
    email          VARCHAR(190)     NOT NULL,
    password_hash  VARCHAR(255)     NOT NULL,
    -- Espelha o enum PermissionLevel. O número nunca é comparado direto na
    -- aplicação: sempre via PermissionLevel (docs/decisions/ADR-006).
    role_level     TINYINT UNSIGNED NOT NULL,
    active         TINYINT(1)       NOT NULL DEFAULT 1,
    created_at     DATETIME         NOT NULL,
    updated_at     DATETIME         NULL,
    deleted_at     DATETIME         NULL,
    PRIMARY KEY (id),
    -- 190 e não 255: limite de índice do utf8mb4 em InnoDB com prefixo de 767 bytes.
    UNIQUE KEY uk_users_email (email),
    KEY idx_users_active (active, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
