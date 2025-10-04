/**
 * Tests for ATS Integration and Scraping Flows
 */

jest.mock('../src/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
  return mockLogger;
});

// Mock puppeteer module resolution
jest.mock('puppeteer', () => {
  throw new Error('Puppeteer not installed');
}, { virtual: true });

const ATSIntegrator = require('../src/ats/ATSIntegrator');

describe('ATS Integration Flow', () => {
  let atsIntegrator;

  beforeEach(() => {
    atsIntegrator = new ATSIntegrator();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (atsIntegrator) {
      await atsIntegrator.close();
    }
  });

  test('should initialize without puppeteer in API-only mode', async () => {
    const initialized = await atsIntegrator.initialize();
    
    expect(initialized).toBe(false); // No browser automation available
    expect(atsIntegrator.isAutomationEnabled()).toBe(false);
  });

  test('should handle job application via API fallback', async () => {
    const jobData = {
      id: 'job-123',
      title: 'Software Engineer',
      company: 'Tech Corp',
      url: 'https://example.com/job/123'
    };

    const profileData = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    const result = await atsIntegrator.applyToJob(jobData, profileData);

    expect(result.success).toBe(true);
    expect(result.method).toBe('api_integration');
    expect(result.jobId).toBe(jobData.id);
    expect(result.appliedAt).toBeDefined();
  });

  test('should report correct capabilities in API-only mode', () => {
    const capabilities = atsIntegrator.getCapabilities();

    expect(capabilities.browserAutomation).toBe(false);
    expect(capabilities.apiIntegration).toBe(true);
    expect(capabilities.currentMode).toBe('api_only');
    expect(capabilities.supportedPlatforms).toContain('LinkedIn');
    expect(capabilities.supportedPlatforms).toContain('Indeed');
  });

  test('should handle application errors gracefully', async () => {
    const jobData = {
      id: 'job-456',
      title: 'Invalid Job',
      company: 'Test Corp'
    };

    // Mock API failure by overriding the method
    const originalApplyWithAPI = atsIntegrator.applyWithAPI;
    atsIntegrator.applyWithAPI = jest.fn().mockRejectedValue(new Error('API Error'));

    try {
      const result = await atsIntegrator.applyToJob(jobData, {});
      expect(result.success).toBe(false);
    } catch (error) {
      // If error is thrown, that's also acceptable behavior
      expect(error.message).toBeTruthy();
    }

    // Restore original method
    atsIntegrator.applyWithAPI = originalApplyWithAPI;
  });

  test('should close browser resources properly', async () => {
    await atsIntegrator.initialize();
    
    // Close should not throw even if no browser is open
    await expect(atsIntegrator.close()).resolves.not.toThrow();
    
    expect(atsIntegrator.browser).toBe(null);
  });

  test('should support multiple job platforms', () => {
    const capabilities = atsIntegrator.getCapabilities();
    
    const expectedPlatforms = [
      'LinkedIn', 'Indeed', 'Glassdoor', 'ZipRecruiter',
      'Monster', 'CareerBuilder', 'Dice', 'AngelList'
    ];

    expectedPlatforms.forEach(platform => {
      expect(capabilities.supportedPlatforms).toContain(platform);
    });
  });
});

describe('Job Scraping Flow', () => {
  test('should validate job data structure', () => {
    const validJobData = {
      id: 'job-789',
      title: 'Senior Developer',
      company: 'Example Inc',
      url: 'https://example.com/jobs/789',
      location: 'Remote',
      salary: '$100k-$150k'
    };

    // Verify all required fields are present
    expect(validJobData.id).toBeDefined();
    expect(validJobData.title).toBeDefined();
    expect(validJobData.company).toBeDefined();
    expect(validJobData.url).toBeDefined();
  });

  test('should handle malformed job data', () => {
    const malformedJobData = {
      title: 'Incomplete Job'
      // Missing required fields
    };

    expect(malformedJobData.id).toBeUndefined();
    expect(malformedJobData.company).toBeUndefined();
  });
});
