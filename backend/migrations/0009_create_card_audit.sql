-- Alimentada exclusivamente pelo handler dos eventos de carta, que nunca lança:
-- falha de auditoria vira log, jamais erro para quem acabou de salvar
-- (docs/decisions/ADR-005).
CREATE TABLE IF NOT EXISTS card_audit (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    card_id    INT UNSIGNED    NOT NULL,
    user_id    INT UNSIGNED    NOT NULL,
    action     ENUM('created','updated','deleted','restored') NOT NULL,
    -- Só o que mudou, no formato {campo: {from, to}}. Guardar a linha inteira
    -- torna ilegível justamente o que se quer ler seis meses depois.
    changes    JSON            NULL,
    trace_id   CHAR(32)        NULL,
    created_at DATETIME        NOT NULL,
    PRIMARY KEY (id),
    KEY idx_audit_card (card_id, created_at),
    KEY idx_audit_user (user_id, created_at),
    CONSTRAINT fk_audit_card FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
