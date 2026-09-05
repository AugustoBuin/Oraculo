CREATE TABLE IF NOT EXISTS login_attempts (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- Hash de (e-mail + IP). Guardar o e-mail em claro transformaria a tabela
    -- numa lista de usuários do sistema, legível por qualquer leitura acidental.
    identifier   CHAR(64)     NOT NULL,
    attempted_at DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_attempts_window (identifier, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
