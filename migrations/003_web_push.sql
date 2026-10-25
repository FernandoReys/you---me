BEGIN;
CREATE TABLE IF NOT EXISTS push_subscriptions(endpoint_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),session_hash text NOT NULL REFERENCES sessions(token),subscription text NOT NULL,created bigint NOT NULL,updated bigint NOT NULL);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_session ON push_subscriptions(session_hash);
CREATE TABLE IF NOT EXISTS push_limits(user_id text PRIMARY KEY REFERENCES users(id),tested_at bigint NOT NULL);
COMMIT;
