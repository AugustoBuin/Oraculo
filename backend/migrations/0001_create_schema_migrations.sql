-- Controle de versão do schema.
-- IF NOT EXISTS porque o próprio migrador precisa desta tabela para saber o que
-- já rodou: ele a cria no bootstrap, e esta migration a registra formalmente.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) NOT NULL,
    applied_at  DATETIME    NOT NULL,
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
