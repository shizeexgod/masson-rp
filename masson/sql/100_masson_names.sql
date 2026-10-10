-- Masson RP: уникальные RP-имена персонажей (Имя Фамилия).
-- Сам персонаж хранится в player_data (ключ masson:char); здесь — только бронь имени,
-- чтобы двое игроков не получили одно имя. Сравнение без учёта регистра (utf8mb4_unicode_ci).
CREATE TABLE IF NOT EXISTS masson_names (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    first_name  VARCHAR(16)  NOT NULL,
    last_name   VARCHAR(16)  NOT NULL,
    created_utc TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_masson_name (first_name, last_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
