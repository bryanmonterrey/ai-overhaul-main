-- supabase/seed.sql

-- Clear migration tracking
DROP SCHEMA IF EXISTS supabase_migrations CASCADE;
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations (
    version text PRIMARY KEY,
    statements text[],
    name text
);

-- Clear any existing data
TRUNCATE TABLE IF EXISTS message_logs CASCADE;
TRUNCATE TABLE IF EXISTS training_data CASCADE;
TRUNCATE TABLE IF EXISTS message_metrics CASCADE;
TRUNCATE TABLE IF EXISTS quality_metrics CASCADE;
TRUNCATE TABLE IF EXISTS chat_messages CASCADE;
TRUNCATE TABLE IF EXISTS chat_sessions CASCADE;
TRUNCATE TABLE IF EXISTS system_resets CASCADE;
TRUNCATE TABLE IF EXISTS admin_logs CASCADE;
TRUNCATE TABLE IF EXISTS active_sessions CASCADE;
TRUNCATE TABLE IF EXISTS system_stats CASCADE;
TRUNCATE TABLE IF EXISTS user_roles CASCADE;
TRUNCATE TABLE IF EXISTS personality_states CASCADE;
TRUNCATE TABLE IF EXISTS tweet_patterns CASCADE;
TRUNCATE TABLE IF EXISTS interactions CASCADE;
TRUNCATE TABLE IF EXISTS memories CASCADE;