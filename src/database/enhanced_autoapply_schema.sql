-- Enhanced AutoApply Database Schema
-- Additional tables and indexes for advanced autoapply functionality

-- Table: job_opportunities
-- Stores scanned job opportunities with match scores
CREATE TABLE IF NOT EXISTS job_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    company VARCHAR NOT NULL,
    location VARCHAR,
    salary VARCHAR,
    description TEXT,
    url VARCHAR NOT NULL,
    source VARCHAR NOT NULL, -- indeed, linkedin, glassdoor, etc.
    match_score INTEGER NOT NULL, -- 0-100 match percentage
    match_reasons JSONB, -- Array of reasons why it matches
    scanned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(url, user_id)
);

-- Table: job_applications
-- Tracks application attempts and status
CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(user_id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_opportunities(id) ON DELETE CASCADE,
    status VARCHAR NOT NULL DEFAULT 'pending', -- pending, submitted, failed, ready_to_submit
    ats_type VARCHAR, -- workday, greenhouse, lever, etc.
    error_message TEXT,
    application_data JSONB, -- Store application details and responses
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, job_id)
);

-- Table: autoapply_sessions
-- Tracks autoapply sessions for users
CREATE TABLE IF NOT EXISTS autoapply_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(user_id) ON DELETE CASCADE,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    status VARCHAR NOT NULL DEFAULT 'active', -- active, ended, paused
    applications_count INTEGER DEFAULT 0,
    jobs_scanned INTEGER DEFAULT 0,
    session_data JSONB
);

-- Table: user_autoapply_status
-- Current autoapply status for users
CREATE TABLE IF NOT EXISTS user_autoapply_status (
    user_id VARCHAR PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table: autoapply_config
-- User-specific autoapply configuration
CREATE TABLE IF NOT EXISTS autoapply_config (
    user_id VARCHAR PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    max_daily_applications INTEGER DEFAULT 20,
    min_match_score INTEGER DEFAULT 70,
    automation_mode VARCHAR DEFAULT 'review', -- 'auto' or 'review'
    scan_frequency_hours INTEGER DEFAULT 2,
    enabled_job_boards JSONB DEFAULT '["indeed", "linkedin", "glassdoor"]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table: application_templates
-- Store templates for cover letters and responses
CREATE TABLE IF NOT EXISTS application_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(user_id) ON DELETE CASCADE,
    template_name VARCHAR NOT NULL,
    template_type VARCHAR NOT NULL, -- cover_letter, screening_answer, etc.
    template_content TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table: job_board_cookies
-- Store authentication cookies for job boards
CREATE TABLE IF NOT EXISTS job_board_cookies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(user_id) ON DELETE CASCADE,
    job_board VARCHAR NOT NULL, -- linkedin, indeed, etc.
    cookies_data JSONB NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, job_board)
);

-- Table: application_logs
-- Detailed logs for troubleshooting applications
CREATE TABLE IF NOT EXISTS application_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
    log_level VARCHAR NOT NULL, -- info, warning, error, debug
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_opportunities_user_id ON job_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_job_opportunities_match_score ON job_opportunities(match_score);
CREATE INDEX IF NOT EXISTS idx_job_opportunities_scanned_at ON job_opportunities(scanned_at);
CREATE INDEX IF NOT EXISTS idx_job_opportunities_source ON job_opportunities(source);

CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON job_applications(created_at);

CREATE INDEX IF NOT EXISTS idx_autoapply_sessions_user_id ON autoapply_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_autoapply_sessions_status ON autoapply_sessions(status);

CREATE INDEX IF NOT EXISTS idx_application_logs_job_application_id ON application_logs(job_application_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_created_at ON application_logs(created_at);

-- Views for common queries
CREATE OR REPLACE VIEW user_autoapply_stats AS
SELECT 
    u.user_id,
    u.email,
    uas.is_active,
    COALESCE(job_stats.total_jobs, 0) as total_jobs_scanned,
    COALESCE(job_stats.high_match_jobs, 0) as high_match_jobs,
    COALESCE(app_stats.total_applications, 0) as total_applications,
    COALESCE(app_stats.successful_applications, 0) as successful_applications,
    COALESCE(app_stats.todays_applications, 0) as todays_applications,
    ac.max_daily_applications,
    ac.min_match_score,
    ac.automation_mode
FROM users u
LEFT JOIN user_autoapply_status uas ON u.user_id = uas.user_id
LEFT JOIN autoapply_config ac ON u.user_id = ac.user_id
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN match_score >= 70 THEN 1 END) as high_match_jobs
    FROM job_opportunities
    GROUP BY user_id
) job_stats ON u.user_id = job_stats.user_id
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_applications,
        COUNT(CASE WHEN status IN ('submitted', 'ready_to_submit') THEN 1 END) as successful_applications,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as todays_applications
    FROM job_applications
    GROUP BY user_id
) app_stats ON u.user_id = app_stats.user_id;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_autoapply_data() RETURNS void AS $$
BEGIN
    -- Delete job opportunities older than 30 days with no applications
    DELETE FROM job_opportunities 
    WHERE scanned_at < NOW() - INTERVAL '30 days'
    AND id NOT IN (SELECT job_id FROM job_applications);
    
    -- Delete application logs older than 7 days
    DELETE FROM application_logs 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Delete expired job board cookies
    DELETE FROM job_board_cookies 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-autoapply-data', '0 2 * * *', 'SELECT cleanup_old_autoapply_data();');

COMMIT;