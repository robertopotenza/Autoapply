/**
 * Job Scanner Service - Enhanced Autoapply Engine
 * Scans multiple job boards and finds relevant positions based on user preferences
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { Logger } = require('../../utils/logger');

class JobScanner {
    constructor(database) {
        this.db = database;
        this.logger = new Logger('JobScanner');
        
        // Job board configurations
        this.jobBoards = [
            {
                name: 'indeed',
                baseUrl: 'https://www.indeed.com',
                searchPath: '/jobs',
                enabled: true
            },
            {
                name: 'linkedin',
                baseUrl: 'https://www.linkedin.com',
                searchPath: '/jobs/search',
                enabled: true
            },
            {
                name: 'glassdoor',
                baseUrl: 'https://www.glassdoor.com',
                searchPath: '/Job/jobs.htm',
                enabled: true
            }
        ];
    }

    /**
     * Scan for jobs based on user preferences
     * @param {string} userId - User ID to scan jobs for
     * @returns {Promise<Array>} - Array of job opportunities
     */
    async scanJobsForUser(userId) {
        try {
            this.logger.info(`Starting job scan for user: ${userId}`);
            
            // Get user preferences
            const preferences = await this.getUserPreferences(userId);
            if (!preferences) {
                throw new Error('No job preferences found for user');
            }

            const allJobs = [];

            // Scan each enabled job board
            for (const board of this.jobBoards) {
                if (!board.enabled) continue;

                try {
                    const jobs = await this.scanJobBoard(board, preferences);
                    allJobs.push(...jobs);
                    this.logger.info(`Found ${jobs.length} jobs on ${board.name}`);
                } catch (error) {
                    this.logger.error(`Error scanning ${board.name}:`, error.message);
                }
            }

            // Filter and score jobs
            const scoredJobs = await this.scoreAndFilterJobs(allJobs, preferences);
            
            // Save jobs to database
            await this.saveJobsToDatabase(scoredJobs, userId);

            this.logger.info(`Job scan completed. Found ${scoredJobs.length} relevant jobs`);
            return scoredJobs;

        } catch (error) {
            this.logger.error('Job scanning failed:', error.message);
            throw error;
        }
    }

    /**
     * Get user preferences from database
     */
    async getUserPreferences(userId) {
        const query = `
            SELECT 
                jp.*,
                p.current_title,
                p.years_experience,
                e.work_authorization
            FROM job_preferences jp
            JOIN profile p ON jp.user_id = p.user_id
            JOIN eligibility e ON jp.user_id = e.user_id
            WHERE jp.user_id = $1
        `;
        
        const result = await this.db.query(query, [userId]);
        return result.rows[0] || null;
    }

    /**
     * Scan a specific job board
     */
    async scanJobBoard(board, preferences) {
        const jobs = [];

        try {
            // Build search query based on preferences
            const searchParams = this.buildSearchParams(preferences, board);
            const searchUrl = `${board.baseUrl}${board.searchPath}?${searchParams}`;

            this.logger.debug(`Scanning ${board.name}: ${searchUrl}`);

            // Make request with proper headers
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                },
                timeout: 10000
            });

            // Parse HTML response
            const $ = cheerio.load(response.data);
            
            // Extract jobs based on board-specific selectors
            const extractedJobs = this.extractJobsFromHTML($, board);
            jobs.push(...extractedJobs);

        } catch (error) {
            this.logger.error(`Failed to scan ${board.name}:`, error.message);
        }

        return jobs;
    }

    /**
     * Build search parameters for job board
     */
    buildSearchParams(preferences, board) {
        const params = new URLSearchParams();

        // Add job titles from desired roles
        if (preferences.desired_roles && preferences.desired_roles.length > 0) {
            const jobTitle = preferences.desired_roles.join(' OR ');
            
            switch (board.name) {
                case 'indeed':
                    params.append('q', jobTitle);
                    break;
                case 'linkedin':
                    params.append('keywords', jobTitle);
                    break;
                case 'glassdoor':
                    params.append('jobTitle', jobTitle);
                    break;
            }
        }

        // Add location preferences
        if (preferences.preferred_locations && preferences.preferred_locations.length > 0) {
            const location = preferences.preferred_locations[0];
            
            switch (board.name) {
                case 'indeed':
                    params.append('l', location);
                    break;
                case 'linkedin':
                    params.append('location', location);
                    break;
                case 'glassdoor':
                    params.append('locT', 'C');
                    params.append('locId', location);
                    break;
            }
        }

        // Add salary range
        if (preferences.salary_min) {
            switch (board.name) {
                case 'indeed':
                    params.append('salary', `$${preferences.salary_min}+`);
                    break;
                case 'linkedin':
                    params.append('f_SB2', preferences.salary_min);
                    break;
            }
        }

        // Add experience level
        if (preferences.experience_level) {
            switch (board.name) {
                case 'linkedin':
                    const expMap = {
                        'entry': '2',
                        'mid': '3',
                        'senior': '4',
                        'executive': '5'
                    };
                    params.append('f_E', expMap[preferences.experience_level] || '3');
                    break;
            }
        }

        // Add remote work preference
        if (preferences.location_preference === 'remote') {
            switch (board.name) {
                case 'indeed':
                    params.append('remotejob', '1');
                    break;
                case 'linkedin':
                    params.append('f_WT', '2');
                    break;
            }
        }

        return params.toString();
    }

    /**
     * Extract jobs from HTML using board-specific selectors
     */
    extractJobsFromHTML($, board) {
        const jobs = [];

        try {
            let jobElements;

            switch (board.name) {
                case 'indeed':
                    jobElements = $('.job_seen_beacon');
                    break;
                case 'linkedin':
                    jobElements = $('.jobs-search-results__list-item');
                    break;
                case 'glassdoor':
                    jobElements = '.react-job-listing');
                    break;
                default:
                    jobElements = $('.job-item, .job-listing, .job-result');
            }

            jobElements.each((index, element) => {
                const job = this.extractJobDetails($, element, board);
                if (job && job.title && job.company) {
                    jobs.push(job);
                }
            });

        } catch (error) {
            this.logger.error(`Failed to extract jobs from ${board.name}:`, error.message);
        }

        return jobs;
    }

    /**
     * Extract individual job details from HTML element
     */
    extractJobDetails($, element, board) {
        const job = {
            source: board.name,
            scannedAt: new Date().toISOString()
        };

        try {
            const $el = $(element);

            switch (board.name) {
                case 'indeed':
                    job.title = $el.find('[data-jk] h2 a span').first().text().trim();
                    job.company = $el.find('[data-testid="company-name"]').text().trim();
                    job.location = $el.find('[data-testid="job-location"]').text().trim();
                    job.salary = $el.find('[data-testid="attribute_snippet_testid"]').text().trim();
                    job.url = 'https://www.indeed.com' + $el.find('[data-jk] h2 a').attr('href');
                    job.description = $el.find('[data-testid="job-snippet"]').text().trim();
                    break;

                case 'linkedin':
                    job.title = $el.find('.job-search-card__title').text().trim();
                    job.company = $el.find('.job-search-card__subtitle-link').text().trim();
                    job.location = $el.find('.job-search-card__location').text().trim();
                    job.url = $el.find('.job-search-card__title-link').attr('href');
                    break;

                case 'glassdoor':
                    job.title = $el.find('[data-test="job-title"]').text().trim();
                    job.company = $el.find('[data-test="employer-name"]').text().trim();
                    job.location = $el.find('[data-test="job-location"]').text().trim();
                    job.salary = $el.find('[data-test="detailSalary"]').text().trim();
                    break;
            }

            // Clean up extracted data
            job.title = this.cleanText(job.title);
            job.company = this.cleanText(job.company);
            job.location = this.cleanText(job.location);
            job.description = this.cleanText(job.description);

        } catch (error) {
            this.logger.error('Failed to extract job details:', error.message);
            return null;
        }

        return job;
    }

    /**
     * Score and filter jobs based on user preferences
     */
    async scoreAndFilterJobs(jobs, preferences) {
        const scoredJobs = [];

        for (const job of jobs) {
            const score = this.calculateJobScore(job, preferences);
            
            // Only include jobs with score >= 60%
            if (score >= 0.6) {
                job.matchScore = Math.round(score * 100);
                job.matchReasons = this.getMatchReasons(job, preferences);
                scoredJobs.push(job);
            }
        }

        // Sort by match score (highest first)
        return scoredJobs.sort((a, b) => b.matchScore - a.matchScore);
    }

    /**
     * Calculate job match score (0-1)
     */
    calculateJobScore(job, preferences) {
        let score = 0;
        let factors = 0;

        // Title matching
        if (preferences.desired_roles && preferences.desired_roles.length > 0) {
            factors++;
            const titleMatch = preferences.desired_roles.some(role => 
                job.title.toLowerCase().includes(role.toLowerCase())
            );
            if (titleMatch) score += 0.4; // 40% weight for title match
        }

        // Location matching
        if (preferences.preferred_locations && preferences.preferred_locations.length > 0) {
            factors++;
            const locationMatch = preferences.preferred_locations.some(loc => 
                job.location.toLowerCase().includes(loc.toLowerCase())
            );
            if (locationMatch) score += 0.2; // 20% weight
        }

        // Remote work preference
        if (preferences.location_preference === 'remote') {
            factors++;
            const remoteKeywords = ['remote', 'work from home', 'distributed', 'virtual'];
            const isRemote = remoteKeywords.some(keyword => 
                job.description.toLowerCase().includes(keyword) ||
                job.location.toLowerCase().includes(keyword)
            );
            if (isRemote) score += 0.2; // 20% weight
        }

        // Salary matching
        if (preferences.salary_min && job.salary) {
            factors++;
            const salaryNumbers = job.salary.match(/\d+/g);
            if (salaryNumbers && salaryNumbers.length > 0) {
                const jobSalary = parseInt(salaryNumbers[0]) * 1000; // Assume K format
                if (jobSalary >= preferences.salary_min) {
                    score += 0.2; // 20% weight
                }
            }
        }

        // Normalize score based on available factors
        return factors > 0 ? score : 0;
    }

    /**
     * Get reasons why job matches preferences
     */
    getMatchReasons(job, preferences) {
        const reasons = [];

        if (preferences.desired_roles) {
            const titleMatch = preferences.desired_roles.find(role => 
                job.title.toLowerCase().includes(role.toLowerCase())
            );
            if (titleMatch) reasons.push(`Title matches "${titleMatch}"`);
        }

        if (preferences.preferred_locations) {
            const locationMatch = preferences.preferred_locations.find(loc => 
                job.location.toLowerCase().includes(loc.toLowerCase())
            );
            if (locationMatch) reasons.push(`Located in ${locationMatch}`);
        }

        if (preferences.location_preference === 'remote') {
            const remoteKeywords = ['remote', 'work from home'];
            const isRemote = remoteKeywords.some(keyword => 
                job.description.toLowerCase().includes(keyword) ||
                job.location.toLowerCase().includes(keyword)
            );
            if (isRemote) reasons.push('Remote work available');
        }

        return reasons;
    }

    /**
     * Save jobs to database
     */
    async saveJobsToDatabase(jobs, userId) {
        const insertQuery = `
            INSERT INTO job_opportunities (
                user_id, title, company, location, salary, description, url, 
                source, match_score, match_reasons, scanned_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (url, user_id) DO UPDATE SET
                match_score = EXCLUDED.match_score,
                match_reasons = EXCLUDED.match_reasons,
                scanned_at = EXCLUDED.scanned_at
        `;

        for (const job of jobs) {
            try {
                await this.db.query(insertQuery, [
                    userId,
                    job.title,
                    job.company,
                    job.location,
                    job.salary,
                    job.description,
                    job.url,
                    job.source,
                    job.matchScore,
                    JSON.stringify(job.matchReasons),
                    job.scannedAt
                ]);
            } catch (error) {
                this.logger.error('Failed to save job to database:', error.message);
            }
        }
    }

    /**
     * Clean extracted text
     */
    cleanText(text) {
        if (!text) return '';
        return text.replace(/\s+/g, ' ').trim();
    }

    /**
     * Get jobs for a user from database
     */
    async getJobsForUser(userId, limit = 50) {
        const query = `
            SELECT * FROM job_opportunities 
            WHERE user_id = $1 
            ORDER BY match_score DESC, scanned_at DESC 
            LIMIT $2
        `;
        
        const result = await this.db.query(query, [userId, limit]);
        return result.rows;
    }
}

module.exports = JobScanner;