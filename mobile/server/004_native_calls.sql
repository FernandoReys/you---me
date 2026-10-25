BEGIN;
CREATE TABLE IF NOT EXISTS native_devices(token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),session_hash text NOT NULL REFERENCES sessions(token),platform text NOT NULL CHECK(platform IN ('ios','android')),token text NOT NULL,updated bigint NOT NULL);
CREATE INDEX IF NOT EXISTS native_devices_user ON native_devices(user_id);
COMMIT;
