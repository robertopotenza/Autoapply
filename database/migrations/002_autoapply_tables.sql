-- Auto-Apply Enhancement: Job Tracking and Application Management
-- Migration 002: Add tables for job tracking, applications, and ATS integration

-- Jobs Table - Track discovered job postings
CREATE TABLE IF NOT EXISTS jobs (
    job_id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    job_url TEXT NOT NULL UNIQUE,
    ats_type VARCHAR(50), -- workday, greenhouse, taleo, icims, etc.
    location VARCHAR(255),
    job_type VARCHAR(50), -- full-time, part-time, contract
    seniority_level VARCHAR(50), -- entry, mid, senior, executive
    salary_min NUMERIC(12, 2),
    salary_max NUMERIC(12, 2),
    job_description TEXT,
    requirements TEXT,
    benefits TEXT,
    posted_date DATE,
    application_deadline DATE,
    is_active BOOLEAN DEFAULT TRUE,
    discovered_at TIMESTAMP DEFAULT NOW(),
    last_checked TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Applications Table - Track application attempts and status
CREATE TABLE IF NOT EXISTS applications (
    application_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    job_id INT REFERENCES jobs(job_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, applied, interview, rejected, offer, withdrawn
    application_mode VARCHAR(20) DEFAULT 'auto', -- auto, manual, review
    applied_at TIMESTAMP,
    resume_used TEXT, -- path to resume file used
    cover_letter_used TEXT, -- path to cover letter used
    screening_answers_used JSONB, -- snapshot of answers used
    application_data JSONB, -- ATS form data submitted
    confirmation_number VARCHAR(255), -- ATS confirmation ID
    error_message TEXT, -- if application failed
    retry_count INT DEFAULT 0,
    last_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, job_id) -- prevent duplicate applications
);

-- Application Status History - Track status changes
CREATE TABLE IF NOT EXISTS application_status_history (
    id SERIAL PRIMARY KEY,
    application_id INT REFERENCES applications(application_id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    status_message TEXT,
    changed_at TIMESTAMP DEFAULT NOW(),
    changed_by VARCHAR(50) DEFAULT 'system' -- system, user, ats
);

-- Job Queue - Manage application tasks
CREATE TABLE IF NOT EXISTS job_queue (
    queue_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    job_id INT REFERENCES jobs(job_id) ON DELETE CASCADE,
    priority INT DEFAULT 5, -- 1-10, lower is higher priority
    scheduled_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    error_log TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Auto-Apply Settings
CREATE TABLE IF NOT EXISTS autoapply_settings (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT FALSE,
    mode VARCHAR(20) DEFAULT 'review', -- auto, review
    max_applications_per_day INT DEFAULT 10,
    max_applications_per_week INT DEFAULT 50,
    scan_frequency_hours INT DEFAULT 2,
    preferred_ats JSONB DEFAULT '["workday", "greenhouse", "taleo", "icims"]',
    excluded_companies JSONB DEFAULT '[]',
    required_keywords JSONB DEFAULT '[]',
    excluded_keywords JSONB DEFAULT '[]',
    min_salary NUMERIC(12, 2),
    max_commute_miles INT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ATS Integration Logs - Debug ATS interactions
CREATE TABLE IF NOT EXISTS ats_logs (
    log_id SERIAL PRIMARY KEY,
    application_id INT REFERENCES applications(application_id) ON DELETE CASCADE,
    ats_type VARCHAR(50),
    action VARCHAR(100), -- navigate_to_job, fill_form, upload_resume, submit_application
    step_number INT,
    success BOOLEAN,
    error_message TEXT,
    screenshot_path TEXT, -- for debugging
    page_html TEXT, -- for analysis
    execution_time_ms INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_company_title ON jobs(company_name, job_title);
CREATE INDEX IF NOT EXISTS idx_jobs_ats_type ON jobs(ats_type);
CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_date ON jobs(posted_date);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications(applied_at);

CREATE INDEX IF NOT EXISTS idx_job_queue_user_id ON job_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled_at ON job_queue(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_autoapply_settings_user_id ON autoapply_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_autoapply_settings_enabled ON autoapply_settings(is_enabled);

-- Create views for common queries
CREATE OR REPLACE VIEW user_application_stats AS
SELECT
    u.user_id,
    u.email,
    COUNT(a.application_id) as total_applications,
    COUNT(CASE WHEN a.status = 'applied' THEN 1 END) as applications_submitted,
    COUNT(CASE WHEN a.status = 'interview' THEN 1 END) as interviews_received,
    COUNT(CASE WHEN a.status = 'offer' THEN 1 END) as offers_received,
    COUNT(CASE WHEN a.status = 'rejected' THEN 1 END) as rejections_received,
    MAX(a.applied_at) as last_application_date,
    COUNT(CASE WHEN a.applied_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as applications_this_week,
    COUNT(CASE WHEN a.applied_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as applications_today
FROM users u
LEFT JOIN applications a ON u.user_id = a.user_id
GROUP BY u.user_id, u.email;

