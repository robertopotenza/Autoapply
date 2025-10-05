-- Migration 005: Add enhanced autoapply tables
-- This migration adds supplementary tables for advanced autoapply functionality
-- Note: jobs and applications tables are already created by migration 002

-- Table: autoapply_sessions
-- Tracks autoapply sessions for users
CREATE TABLE IF NOT EXISTS autoapply_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
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
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table: autoapply_config
-- User-specific autoapply configuration
CREATE TABLE IF NOT EXISTS autoapply_config (
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
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
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
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
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
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
    application_id INT REFERENCES applications(application_id) ON DELETE CASCADE,
    log_level VARCHAR NOT NULL, -- info, warning, error, debug
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_autoapply_sessions_user_id ON autoapply_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_autoapply_sessions_status ON autoapply_sessions(status);

CREATE INDEX IF NOT EXISTS idx_application_logs_application_id ON application_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_created_at ON application_logs(created_at);

-- Views for common queries
CREATE OR REPLACE VIEW user_autoapply_stats AS
SELECT 
    u.user_id,
    u.email,
    uas.is_active,
    COALESCE(job_stats.total_jobs, 0) as total_jobs_scanned,
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
        COALESCE(user_id, 0) as user_id,
        COUNT(*) as total_jobs
    FROM jobs
    WHERE user_id IS NOT NULL
    GROUP BY user_id
) job_stats ON u.user_id = job_stats.user_id
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_applications,
        COUNT(CASE WHEN status IN ('applied', 'submitted') THEN 1 END) as successful_applications,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as todays_applications
    FROM applications
    GROUP BY user_id
) app_stats ON u.user_id = app_stats.user_id;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_autoapply_data() RETURNS void AS $$
BEGIN
    -- Delete jobs older than 30 days with no applications (user-specific jobs only)
    DELETE FROM jobs 
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND user_id IS NOT NULL
    AND job_id NOT IN (SELECT job_id FROM applications);
    
    -- Delete application logs older than 7 days
    DELETE FROM application_logs 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Delete expired job board cookies
    DELETE FROM job_board_cookies 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE autoapply_sessions IS 'Tracks user autoapply sessions with status and statistics';
COMMENT ON TABLE user_autoapply_status IS 'Current autoapply on/off status for each user';
COMMENT ON TABLE autoapply_config IS 'User-specific autoapply configuration and preferences';
COMMENT ON TABLE application_templates IS 'User templates for cover letters and screening answers';
COMMENT ON TABLE job_board_cookies IS 'Stored authentication cookies for job board sessions';
COMMENT ON TABLE application_logs IS 'Detailed logs for debugging application attempts';
