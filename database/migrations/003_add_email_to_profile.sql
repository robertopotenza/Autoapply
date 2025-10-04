-- Migration 003: Add email column to profile table
-- This allows users to update their email in the wizard form

ALTER TABLE profile ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profile_email ON profile(email);
