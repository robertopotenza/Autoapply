// @ai-meta: unit-test
// @ai-meta: orchestrator-test

/**
 * Tests for AutoApplyOrchestrator parameter flexibility
 */

// Mock dependencies before requiring AutoApplyOrchestrator
jest.mock('../src/services/autoapply/JobScanner', () => {
    return jest.fn().mockImplementation(() => ({
        scanJobsForUser: jest.fn()
    }));
});

jest.mock('../src/services/autoapply/ApplicationAutomator', () => {
    return jest.fn().mockImplementation(() => ({
        applyToJob: jest.fn(),
        cleanup: jest.fn()
    }));
});

const AutoApplyOrchestrator = require('../src/services/autoapply/AutoApplyOrchestrator');

describe('AutoApplyOrchestrator', () => {
    let orchestrator;

    beforeEach(() => {
        // Mock database
        const mockDb = {
            query: jest.fn()
        };
        orchestrator = new AutoApplyOrchestrator(mockDb);
    });

    describe('getUserAndGlobalJobsWhere', () => {
        test('should generate WHERE clause with parameter $1 by default', () => {
            const whereClause = orchestrator.getUserAndGlobalJobsWhere();
            expect(whereClause).toBe('(j.user_id = $1 OR j.user_id IS NULL)');
        });

        test('should generate WHERE clause with parameter $1 explicitly', () => {
            const whereClause = orchestrator.getUserAndGlobalJobsWhere(1);
            expect(whereClause).toBe('(j.user_id = $1 OR j.user_id IS NULL)');
        });

        test('should generate WHERE clause with parameter $2', () => {
            const whereClause = orchestrator.getUserAndGlobalJobsWhere(2);
            expect(whereClause).toBe('(j.user_id = $2 OR j.user_id IS NULL)');
        });

        test('should generate WHERE clause with parameter $3', () => {
            const whereClause = orchestrator.getUserAndGlobalJobsWhere(3);
            expect(whereClause).toBe('(j.user_id = $3 OR j.user_id IS NULL)');
        });

        test('should handle any parameter number', () => {
            const whereClause = orchestrator.getUserAndGlobalJobsWhere(10);
            expect(whereClause).toBe('(j.user_id = $10 OR j.user_id IS NULL)');
        });
    });

    describe('Query methods use correct parameter positions', () => {
        beforeEach(() => {
            orchestrator.db.query.mockResolvedValue({ rows: [{ count: '0' }] });
        });

        test('getPendingJobsCount should use $1 for userId', async () => {
            await orchestrator.getPendingJobsCount(123);
            
            const query = orchestrator.db.query.mock.calls[0][0];
            expect(query).toContain('(j.user_id = $1 OR j.user_id IS NULL)');
            expect(orchestrator.db.query).toHaveBeenCalledWith(
                expect.any(String),
                [123]
            );
        });

        test('getQualifiedJobsForUser should use $1 for userId', async () => {
            await orchestrator.getQualifiedJobsForUser(123);
            
            const query = orchestrator.db.query.mock.calls[0][0];
            expect(query).toContain('(j.user_id = $1 OR j.user_id IS NULL)');
            expect(orchestrator.db.query).toHaveBeenCalledWith(
                expect.any(String),
                [123]
            );
        });

        test('getJobsByIds should use $2 for userId (after jobIds)', async () => {
            await orchestrator.getJobsByIds([1, 2, 3], 123);
            
            const query = orchestrator.db.query.mock.calls[0][0];
            expect(query).toContain('job_id = ANY($1)');
            expect(query).toContain('(j.user_id = $2 OR j.user_id IS NULL)');
            expect(orchestrator.db.query).toHaveBeenCalledWith(
                expect.any(String),
                [[1, 2, 3], 123]
            );
        });

        test('getScannedJobs should use $1 for userId', async () => {
            await orchestrator.getScannedJobs(123, { page: 1, limit: 10 });
            
            const query = orchestrator.db.query.mock.calls[0][0];
            expect(query).toContain('(j.user_id = $1 OR j.user_id IS NULL)');
            expect(orchestrator.db.query).toHaveBeenCalledWith(
                expect.any(String),
                [123, 10, 0]
            );
        });
    });
});
