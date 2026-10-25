BEGIN;
CREATE TABLE IF NOT EXISTS user_settings(user_id text PRIMARY KEY REFERENCES users(id),preferences text NOT NULL DEFAULT '{}',avatar_version text NOT NULL DEFAULT '',wallpaper_version text NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS profile_media(user_id text NOT NULL REFERENCES users(id),kind text NOT NULL CHECK(kind IN ('avatar','wallpaper')),mime text NOT NULL,bytes bytea NOT NULL,PRIMARY KEY(user_id,kind));
COMMIT;
