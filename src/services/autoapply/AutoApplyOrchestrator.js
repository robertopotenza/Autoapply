/**
 * AutoApply Orchestrator - Enhanced Autoapply Engine
 * Coordinates job scanning, matching, and application automation
 */

const JobScanner = require('./JobScanner');
const ApplicationAutomator = require('./ApplicationAutomator');
const { Logger } = require('../../utils/logger');

class AutoApplyOrchestrator {
    constructor(database) {
        this.db = database;
        this.logger = new Logger('AutoApplyOrchestrator');
        this.jobScanner = new JobScanner(database);
        this.applicationAutomator = new ApplicationAutomator(database);
        
        // Configuration
        this.config = {
            scanIntervalHours: parseInt(process.env.SCAN_INTERVAL_HOURS || '2'),
            maxDailyApplications: 20,
            minMatchScore: 70,
            automationMode: process.env.AUTOMATION_MODE || 'review' // 'auto' or 'review'
        };

        this.activeUsers = new Map(); // Track active autoapply sessions
    }

    /**
     * Generate WHERE clause for queries that include both user-specific and global jobs
     * Global jobs (user_id IS NULL) are job board postings available to all users
     * User-specific jobs are jobs saved/created by this specific user
     * 
     * @param {number} paramNumber - The parameter position for userId in the query (e.g., 1 for $1, 2 for $2)
     * @returns {string} - WHERE clause with the appropriate parameter placeholder
     */
    getUserAndGlobalJobsWhere(paramNumber = 1) {
        return `(j.user_id = $${paramNumber} OR j.user_id IS NULL)`;
    }

    /**
     * Start autoapply for a user
     * @param {string} userId - User ID to start autoapply for
     * @returns {Promise<Object>} - Start result
     */
    async startAutoApplyForUser(userId) {
        try {
            this.logger.info(`Starting autoapply for user: ${userId}`);

            // Check if user has valid preferences
            const userPreferences = await this.getUserPreferences(userId);
            if (!userPreferences) {
                throw new Error('User must complete job preferences before starting autoapply');
            }

            // Check if user profile is complete
            const profileComplete = await this.checkProfileCompleteness(userId);
            if (!profileComplete.isComplete) {
                throw new Error(`Profile incomplete. Missing: ${profileComplete.missing.join(', ')}`);
            }

            // Start autoapply session
            const sessionId = await this.createAutoApplySession(userId);
            this.activeUsers.set(userId, {
                sessionId,
                startTime: new Date(),
                lastScan: null,
                applicationsToday: 0
            });

            // Perform initial job scan
            const initialScan = await this.performJobScan(userId);

            this.logger.info(`Autoapply started for user ${userId}. Found ${initialScan.jobs.length} initial jobs.`);

            return {
                success: true,
                sessionId,
                initialJobs: initialScan.jobs.length,
                config: this.config,
                message: `Autoapply started successfully. Found ${initialScan.jobs.length} matching jobs.`
            };

        } catch (error) {
            this.logger.error(`Failed to start autoapply for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Stop autoapply for a user
     */
    async stopAutoApplyForUser(userId) {
        try {
            this.logger.info(`Stopping autoapply for user: ${userId}`);

            // Remove from active users
            const session = this.activeUsers.get(userId);
            if (session) {
                await this.endAutoApplySession(session.sessionId);
                this.activeUsers.delete(userId);
            }

            // Update database status
            await this.updateUserAutoApplyStatus(userId, false);

            return {
                success: true,
                message: 'Autoapply stopped successfully'
            };

        } catch (error) {
            this.logger.error(`Failed to stop autoapply for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Perform job scan for a user
     */
    async performJobScan(userId) {
        try {
            this.logger.info(`Performing job scan for user: ${userId}`);

            // Scan for new jobs
            const jobs = await this.jobScanner.scanJobsForUser(userId);

            // Filter jobs based on user's daily limit and match score
            const dailyApplications = await this.getTodaysApplicationCount(userId);
            const remainingApplications = this.config.maxDailyApplications - dailyApplications;

            const qualifiedJobs = jobs
                .filter(job => job.matchScore >= this.config.minMatchScore)
                .slice(0, remainingApplications);

            // Update last scan time
            const session = this.activeUsers.get(userId);
            if (session) {
                session.lastScan = new Date();
            }

            return {
                jobs: qualifiedJobs,
                totalFound: jobs.length,
                qualifiedCount: qualifiedJobs.length,
                dailyApplicationsUsed: dailyApplications,
                remainingApplications
            };

        } catch (error) {
            this.logger.error(`Job scan failed for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Process applications for qualified jobs
     */
    async processApplications(userId, jobIds = null) {
        try {
            this.logger.info(`Processing applications for user: ${userId}`);

            let jobs;
            if (jobIds) {
                // Process specific jobs
                jobs = await this.getJobsByIds(jobIds, userId);
            } else {
                // Get all qualified jobs for user
                jobs = await this.getQualifiedJobsForUser(userId);
            }

            const results = [];
            const session = this.activeUsers.get(userId);

            for (const job of jobs) {
                try {
                    // Check daily limit
                    if (session && session.applicationsToday >= this.config.maxDailyApplications) {
                        this.logger.info(`Daily application limit reached for user ${userId}`);
                        break;
                    }

                    // Check if already applied
                    const alreadyApplied = await this.checkIfAlreadyApplied(userId, job.id);
                    if (alreadyApplied) {
                        continue;
                    }

                    this.logger.info(`Applying to: ${job.title} at ${job.company}`);

                    // Apply to job
                    const applicationResult = await this.applicationAutomator.applyToJob(userId, job.id);
                    
                    results.push({
                        jobId: job.id,
                        jobTitle: job.title,
                        company: job.company,
                        result: applicationResult
                    });

                    // Update session counter
                    if (session) {
                        session.applicationsToday++;
                    }

                    // Add delay between applications to avoid being flagged
                    await this.sleep(5000 + Math.random() * 10000); // 5-15 second delay

                } catch (error) {
                    this.logger.error(`Application failed for job ${job.id}:`, error.message);
                    results.push({
                        jobId: job.id,
                        jobTitle: job.title,
                        company: job.company,
                        result: {
                            status: 'failed',
                            error: error.message
                        }
                    });
                }
            }

            return {
                processed: results.length,
                successful: results.filter(r => r.result.status !== 'failed').length,
                failed: results.filter(r => r.result.status === 'failed').length,
                results
            };

        } catch (error) {
            this.logger.error(`Application processing failed for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get autoapply status for a user
     */
    async getAutoApplyStatus(userId) {
        try {
            const session = this.activeUsers.get(userId);
            const isActive = !!session;

            let status = {
                isActive,
                sessionInfo: session || null
            };

            if (isActive) {
                // Get additional status information
                const [pendingJobs, todaysApplications, totalApplications] = await Promise.all([
                    this.getPendingJobsCount(userId),
                    this.getTodaysApplicationCount(userId),
                    this.getTotalApplicationsCount(userId)
                ]);

                status = {
                    ...status,
                    stats: {
                        pendingJobs,
                        todaysApplications,
                        totalApplications,
                        dailyLimit: this.config.maxDailyApplications,
                        remainingToday: this.config.maxDailyApplications - todaysApplications
                    }
                };
            }

            return status;

        } catch (error) {
            this.logger.error(`Failed to get autoapply status for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Run continuous autoapply process
     */
    async runContinuousAutoApply() {
        this.logger.info('Starting continuous autoapply process');

        setInterval(async () => {
            try {
                const activeUsers = Array.from(this.activeUsers.keys());
                
                for (const userId of activeUsers) {
                    const session = this.activeUsers.get(userId);
                    const hoursSinceLastScan = session.lastScan 
                        ? (new Date() - session.lastScan) / (1000 * 60 * 60)
                        : this.config.scanIntervalHours;

                    // Check if it's time for a new scan
                    if (hoursSinceLastScan >= this.config.scanIntervalHours) {
                        this.logger.info(`Running scheduled scan for user: ${userId}`);
                        
                        try {
                            const scanResult = await this.performJobScan(userId);
                            
                            // Auto-process applications if in auto mode
                            if (this.config.automationMode === 'auto' && scanResult.qualifiedCount > 0) {
                                await this.processApplications(userId);
                            }
                        } catch (error) {
                            this.logger.error(`Scheduled scan failed for user ${userId}:`, error.message);
                        }
                    }
                }

            } catch (error) {
                this.logger.error('Continuous autoapply process error:', error.message);
            }
        }, 30 * 60 * 1000); // Check every 30 minutes
    }

    /**
     * Database helper methods
     */
    async getUserPreferences(userId) {
        const query = 'SELECT * FROM job_preferences WHERE user_id = $1';
        const result = await this.db.query(query, [userId]);
        return result.rows[0] || null;
    }

    async checkProfileCompleteness(userId) {
        const query = `
            SELECT
                p.full_name, p.phone, p.resume_path,
                e.current_job_title, e.availability
            FROM profile p
            LEFT JOIN eligibility e ON p.user_id = e.user_id
            WHERE p.user_id = $1
        `;

        const result = await this.db.query(query, [userId]);
        const profile = result.rows[0];

        if (!profile) {
            return { isComplete: false, missing: ['profile'] };
        }

        const missing = [];
        if (!profile.full_name) missing.push('full name');
        if (!profile.phone) missing.push('phone');
        if (!profile.resume_path) missing.push('resume');
        if (!profile.current_job_title) missing.push('current job title');
        if (!profile.availability) missing.push('availability');

        return {
            isComplete: missing.length === 0,
            missing
        };
    }

    async createAutoApplySession(userId) {
        const query = `
            INSERT INTO autoapply_sessions (user_id, started_at, status)
            VALUES ($1, NOW(), 'active')
            RETURNING id
        `;
        
        const result = await this.db.query(query, [userId]);
        return result.rows[0].id;
    }

    async endAutoApplySession(sessionId) {
        const query = `
            UPDATE autoapply_sessions 
            SET ended_at = NOW(), status = 'ended'
            WHERE id = $1
        `;
        
        await this.db.query(query, [sessionId]);
    }

    async updateUserAutoApplyStatus(userId, isActive) {
        const query = `
            INSERT INTO user_autoapply_status (user_id, is_active, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                is_active = EXCLUDED.is_active,
                updated_at = EXCLUDED.updated_at
        `;
        
        await this.db.query(query, [userId, isActive]);
    }

    async getTodaysApplicationCount(userId) {
        const query = `
            SELECT COUNT(*) as count
            FROM applications 
            WHERE user_id = $1 
            AND DATE(created_at) = CURRENT_DATE
        `;
        
        const result = await this.db.query(query, [userId]);
        return parseInt(result.rows[0].count);
    }

    async getPendingJobsCount(userId) {
        const query = `
            SELECT COUNT(*) as count
            FROM jobs j
            LEFT JOIN applications a ON j.job_id = a.job_id AND a.user_id = $1
            WHERE ${this.getUserAndGlobalJobsWhere(1)}
            AND a.application_id IS NULL
        `;
        
        const result = await this.db.query(query, [userId]);
        return parseInt(result.rows[0].count);
    }

    async getTotalApplicationsCount(userId) {
        const query = 'SELECT COUNT(*) as count FROM applications WHERE user_id = $1';
        const result = await this.db.query(query, [userId]);
        return parseInt(result.rows[0].count);
    }

    async getQualifiedJobsForUser(userId) {
        const query = `
            SELECT j.*
            FROM jobs j
            LEFT JOIN applications a ON j.job_id = a.job_id AND a.user_id = $1
            WHERE ${this.getUserAndGlobalJobsWhere(1)}
            AND a.application_id IS NULL
            ORDER BY j.created_at DESC
            LIMIT 10
        `;
        
        const result = await this.db.query(query, [userId]);
        return result.rows;
    }

    async getJobsByIds(jobIds, userId) {
        const query = `
            SELECT * FROM jobs 
            WHERE job_id = ANY($1) AND ${this.getUserAndGlobalJobsWhere(2)}
        `;
        
        const result = await this.db.query(query, [jobIds, userId]);
        return result.rows;
    }

    async checkIfAlreadyApplied(userId, jobId) {
        const query = 'SELECT application_id FROM applications WHERE user_id = $1 AND job_id = $2';
        const result = await this.db.query(query, [userId, jobId]);
        return result.rows.length > 0;
    }

    /**
     * Get scanned jobs for a user with pagination
     */
    async getScannedJobs(userId, options = {}) {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const minScore = options.minScore || 0;
        const offset = (page - 1) * limit;

        const query = `
            SELECT j.*,
                   j.job_id as id,
                   j.job_title as title,
                   j.company_name as company,
                   j.job_description as description,
                   j.job_url as url,
                   CASE WHEN a.application_id IS NOT NULL THEN true ELSE false END as already_applied
            FROM jobs j
            LEFT JOIN applications a ON j.job_id = a.job_id AND a.user_id = $1
            WHERE ${this.getUserAndGlobalJobsWhere(1)}
            AND j.is_active = true
            ORDER BY j.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await this.db.query(query, [userId, limit, offset]);
        return result.rows;
    }

    /**
     * Utility methods
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        await this.applicationAutomator.cleanup();
    }
}

module.exports = AutoApplyOrchestrator;