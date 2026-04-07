-- Migration: Add kernel_media table for R2 media tracking
-- Tracks uploaded media files with ownership for access control

CREATE TABLE IF NOT EXISTS kernel_media (
    key TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES kernel_users(user_id),
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    filename TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_owner ON kernel_media(owner_id, created_at);
