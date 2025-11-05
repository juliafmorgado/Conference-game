-- Database initialization script for Conference Games
-- This script sets up the basic schema for the application

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)

-- Session tracking for analytics (optional)
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_type VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    items_shown INTEGER DEFAULT 0,
    category VARCHAR(100)
);

-- Configuration table for runtime settings
CREATE TABLE IF NOT EXISTS app_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default configuration values
INSERT INTO app_config (key, value) VALUES 
    ('timer_default_seconds', '30'),
    ('history_size', '10'),
    ('audio_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_type ON game_sessions(game_type);
CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at ON game_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(key);