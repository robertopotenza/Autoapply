-- Migration 004: Add user_id to jobs table
-- This migration adds optional user_id to the jobs table to support:
-- 1. User-specific jobs: Jobs created/saved by individual users (user_id set)
-- 2. Global jobs: Jobs discovered from job boards available to all users (user_id IS NULL)
--
-- Security Note: The user_id IS NULL condition allows all users to see global job postings
-- that are scraped from job boards and not associated with any specific user.
-- This is intentional for the job discovery feature.

-- Add user_id column to jobs table (nullable to support global jobs)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(user_id) ON DELETE CASCADE;

-- Add comment to explain the nullable user_id field
COMMENT ON COLUMN jobs.user_id IS 
'Optional user ID. NULL indicates a global job available to all users (scraped from job boards). 
When set, indicates a user-specific job (e.g., manually added or saved by a specific user).';

-- Add index for performance when querying by user_id
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);

-- Add additional columns that may be referenced in the code
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS source VARCHAR(100),
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

-- Add comment for source column
COMMENT ON COLUMN jobs.source IS 
'Source of the job posting (e.g., "indeed", "linkedin", "manual", "glassdoor").';

-- Add comment for external_id column  
COMMENT ON COLUMN jobs.external_id IS 
'External identifier from the source system to prevent duplicate entries.';

-- Create unique index to prevent duplicate jobs from external sources
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_external_id 
ON jobs(source, external_id) 
WHERE source IS NOT NULL AND external_id IS NOT NULL;
