-- Sessão de servidor em MySQL: é o que torna possível revogar de verdade.
-- Logout encerra no servidor, e troca de senha encerra TODAS as sessões do
-- usuário (docs/decisions/ADR-003).
CREATE TABLE IF NOT EXISTS sessions (
    id               VARCHAR(128) NOT NULL,
    user_id          INT UNSIGNED NOT NULL,
    payload          TEXT         NOT NULL,
    csrf_token       CHAR(64)     NOT NULL,
    ip_address       VARCHAR(45)  NULL,
    user_agent       VARCHAR(255) NULL,
    created_at       DATETIME     NOT NULL,
    last_activity_at DATETIME     NOT NULL,
    expires_at       DATETIME     NOT NULL,
    PRIMARY KEY (id),
    -- Encerrar todas as sessões de um usuário em um DELETE.
    KEY idx_sessions_user (user_id),
    -- Coleta de vencidas com LIMIT, sem varrer a tabela.
    KEY idx_sessions_expires (expires_at),
    -- Único ON DELETE CASCADE do schema, e deliberado: excluir usuário precisa
    -- encerrar as sessões dele imediatamente.
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
