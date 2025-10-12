-- Migration: Add resumes table for uploaded resume metadata
CREATE TABLE IF NOT EXISTS resumes (
    resume_id SERIAL PRIMARY KEY,
    candidate_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    secure_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    upload_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Index for quick lookup by candidate
CREATE INDEX IF NOT EXISTS idx_resumes_candidate_id ON resumes(candidate_id);