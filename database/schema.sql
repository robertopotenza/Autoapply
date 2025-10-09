-- Auto-Apply Platform Database Schema
-- PostgreSQL Database on Railway
--
-- SCHEMA ARCHITECTURE OVERVIEW:
-- ==============================
-- This schema uses a NORMALIZED design with separate tables for different data domains:
--
-- WIZARD DATA TABLES (write operations):
--   1. job_preferences   - Step 1: Remote/onsite, job types, titles, seniority
--   2. profile          - Step 2: Name, contact, resume, location
--   3. eligibility      - Step 3: Job title, availability, visa, salary
--   4. screening_answers - Screening: Languages, demographics, preferences
--
-- UNIFIED READ INTERFACE:
--   - user_complete_profile (VIEW) - Aggregates all wizard data via JOINs
--   - This is a VIEW, not a table - it doesn't store data
--   - Provides convenient read-only access to complete user profiles
--
-- DATA FLOW:
--   WRITE: App → Model.upsert() → Individual TABLE
--   READ:  App → User.getCompleteProfile() → user_complete_profile VIEW → Individual TABLES
--
-- See SCHEMA_ARCHITECTURE.md and FAQ_SCREENING_DATA.md for detailed documentation.
--
-- ==============================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Magic Link Tokens Table (for passwordless authentication)
CREATE TABLE IF NOT EXISTS magic_link_tokens (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Password Reset Tokens Table (for password recovery)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Job Preferences Table (Steps 1 & 2)
CREATE TABLE IF NOT EXISTS job_preferences (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    remote_jobs JSONB DEFAULT '[]',
    onsite_location VARCHAR(255),
    job_types JSONB DEFAULT '[]',
    job_titles JSONB DEFAULT '[]',
    seniority_levels JSONB DEFAULT '[]',
    time_zones JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Profile Table (Step 3)
CREATE TABLE IF NOT EXISTS profile (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    email VARCHAR(255),
    resume_path TEXT,
    cover_letter_option VARCHAR(50),
    cover_letter_path TEXT,
    phone VARCHAR(20),
    country VARCHAR(100),
    city VARCHAR(100),
    state_region VARCHAR(100),
    postal_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Eligibility Table (Step 4)
CREATE TABLE IF NOT EXISTS eligibility (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    current_job_title VARCHAR(255),
    availability VARCHAR(50),
    eligible_countries JSONB DEFAULT '[]',
    visa_sponsorship BOOLEAN,
    nationality JSONB DEFAULT '[]',
    current_salary NUMERIC(12, 2),
    expected_salary NUMERIC(12, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Screening Answers Table (Additional Questions)
CREATE TABLE IF NOT EXISTS screening_answers (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    experience_summary TEXT,
    hybrid_preference VARCHAR(50),
    travel VARCHAR(50),
    relocation VARCHAR(50),
    languages JSONB DEFAULT '[]',
    date_of_birth DATE,
    gpa NUMERIC(3, 2),
    is_adult BOOLEAN,
    gender_identity VARCHAR(50),
    disability_status VARCHAR(50),
    military_service VARCHAR(50),
    ethnicity VARCHAR(100),
    driving_license TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_magic_link_token ON magic_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_tokens(email);
CREATE INDEX IF NOT EXISTS idx_magic_link_expires ON magic_link_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_job_preferences_user_id ON job_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON profile(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_email ON profile(email);
CREATE INDEX IF NOT EXISTS idx_eligibility_user_id ON eligibility(user_id);
CREATE INDEX IF NOT EXISTS idx_screening_answers_user_id ON screening_answers(user_id);

-- =============================================================================
-- user_complete_profile VIEW
-- =============================================================================
-- IMPORTANT: This is a VIEW (not a table). It does NOT store data.
-- 
-- Purpose: Provides a unified read interface for complete user profiles by
--          aggregating data from multiple normalized tables via LEFT JOINs.
--
-- Data Sources:
--   - users (u)              : Base user information
--   - job_preferences (jp)   : Wizard Step 1 data
--   - profile (p)           : Wizard Step 2 data
--   - eligibility (e)       : Wizard Step 3 data
--   - screening_answers (sa): Screening questions data
--
-- Usage:
--   READ:  SELECT * FROM user_complete_profile WHERE user_id = ?
--   WRITE: You CANNOT write to this VIEW. Write to the individual tables instead.
--
-- Example: When you see "languages" in this VIEW, the data is actually stored
--          in the screening_answers table. The VIEW just makes it appear as
--          part of a unified structure.
--
-- See: SCHEMA_ARCHITECTURE.md for detailed architecture documentation
--      FAQ_SCREENING_DATA.md for common questions about data storage
-- =============================================================================
CREATE OR REPLACE VIEW user_complete_profile AS
SELECT
    u.user_id,
    u.email,
    u.created_at,
    jp.remote_jobs,
    jp.onsite_location,
    jp.job_types,
    jp.job_titles,
    jp.seniority_levels,
    jp.time_zones,
    p.full_name,
    p.email,
    p.resume_path,
    p.cover_letter_option,
    p.phone,
    p.country,
    p.city,
    p.state_region,
    p.postal_code,
    e.current_job_title,
    e.availability,
    e.eligible_countries,
    e.visa_sponsorship,
    e.nationality,
    e.current_salary,
    e.expected_salary,
    sa.experience_summary,
    sa.hybrid_preference,
    sa.travel,
    sa.relocation,
    sa.languages,
    sa.date_of_birth,
    sa.gpa,
    sa.is_adult,
    sa.gender_identity,
    sa.disability_status,
    sa.military_service,
    sa.ethnicity,
    sa.driving_license
FROM users u
LEFT JOIN job_preferences jp ON u.user_id = jp.user_id
LEFT JOIN profile p ON u.user_id = p.user_id
LEFT JOIN eligibility e ON u.user_id = e.user_id
LEFT JOIN screening_answers sa ON u.user_id = sa.user_id;
