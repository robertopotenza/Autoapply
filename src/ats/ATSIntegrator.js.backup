const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class ATSIntegrator {
  constructor() {
    this.browser = null;
    this.atsHandlers = {
      workday: new WorkdayHandler(),
      greenhouse: new GreenhouseHandler(),
      taleo: new TaleoHandler(),
      icims: new ICIMSHandler(),
      custom: new CustomHandler()
    };
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: false, // Set to true for production
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ]
      });
      logger.info('ATS Integrator browser initialized');
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('ATS Integrator browser closed');
    }
  }

  async applyToJob(jobData, userData, applicationData) {
    await this.initialize();
    
    try {
      const atsType = jobData.ats_type || 'custom';
      const handler = this.atsHandlers[atsType];
      
      if (!handler) {
        throw new Error(`No handler available for ATS type: ${atsType}`);
      }

      logger.info(`Applying to ${jobData.job_title} at ${jobData.company_name} via ${atsType}`);
      
      const page = await this.browser.newPage();
      
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      const result = await handler.apply(page, jobData, userData, applicationData);
      
      await page.close();
      return result;

    } catch (error) {
      logger.error('Error during job application:', error);
      throw error;
    }
  }

  async testATSDetection(jobUrl) {
    await this.initialize();
    
    try {
      const page = await this.browser.newPage();
      await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const atsType = await page.evaluate(() => {
        // Detect ATS type based on page content, URLs, and DOM structure
        const url = window.location.href;
        const html = document.documentElement.innerHTML;
        
        if (url.includes('myworkdayjobs.com') || html.includes('workday')) {
          return 'workday';
        } else if (url.includes('greenhouse.io') || html.includes('greenhouse')) {
          return 'greenhouse';
        } else if (url.includes('taleo.net') || html.includes('taleo')) {
          return 'taleo';
        } else if (url.includes('icims.com') || html.includes('icims')) {
          return 'icims';
        } else {
          return 'custom';
        }
      });
      
      await page.close();
      return atsType;

    } catch (error) {
      logger.error('Error detecting ATS type:', error);
      return 'custom';
    }
  }
}

// Base ATS Handler class
class BaseATSHandler {
  constructor() {
    this.name = 'BaseATS';
  }

  async apply(page, jobData, userData, applicationData) {
    throw new Error('Apply method must be implemented by subclass');
  }

  async fillBasicInfo(page, userData) {
    // Common fields across most ATS platforms
    const commonFields = {
      'input[name*="firstName"], input[id*="firstName"], input[placeholder*="First"]': userData.firstName,
      'input[name*="lastName"], input[id*="lastName"], input[placeholder*="Last"]': userData.lastName,
      'input[name*="email"], input[id*="email"], input[type="email"]': userData.email,
      'input[name*="phone"], input[id*="phone"], input[type="tel"]': userData.phone,
      'input[name*="city"], input[id*="city"], input[placeholder*="City"]': userData.city,
      'input[name*="state"], input[id*="state"], input[placeholder*="State"]': userData.state,
      'input[name*="zip"], input[id*="zip"], input[placeholder*="Zip"]': userData.zipCode
    };

    for (const [selector, value] of Object.entries(commonFields)) {
      if (value) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.type(selector, value);
          logger.info(`Filled field: ${selector}`);
        } catch (error) {
          // Field might not exist, continue with next
          continue;
        }
      }
    }
  }

  async uploadResume(page, resumePath) {
    const resumeSelectors = [
      'input[type="file"][name*="resume"]',
      'input[type="file"][id*="resume"]',
      'input[type="file"][accept*="pdf"]',
      'input[type="file"]'
    ];

    for (const selector of resumeSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.uploadFile(resumePath);
          logger.info('Resume uploaded successfully');
          return true;
        }
      } catch (error) {
        continue;
      }
    }

    logger.warn('Could not find resume upload field');
    return false;
  }

  async submitApplication(page) {
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[class*="submit"]',
      'button[id*="submit"]',
      'button:contains("Submit")',
      'button:contains("Apply")',
      '[role="button"]:contains("Submit")'
    ];

    for (const selector of submitSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        await page.click(selector);
        logger.info('Application submitted');
        return true;
      } catch (error) {
        continue;
      }
    }

    logger.warn('Could not find submit button');
    return false;
  }
}

// Workday ATS Handler
class WorkdayHandler extends BaseATSHandler {
  constructor() {
    super();
    this.name = 'Workday';
  }

  async apply(page, jobData, userData, applicationData) {
    try {
      // Navigate to job URL
      await page.goto(jobData.job_url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Click Apply button
      await page.waitForSelector('[data-automation-id="apply"], .css-1ydndhz', { timeout: 10000 });
      await page.click('[data-automation-id="apply"], .css-1ydndhz');

      // Wait for application form to load
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      // Fill personal information
      await this.fillWorkdayPersonalInfo(page, userData);

      // Upload resume
      if (applicationData.resumePath) {
        await this.uploadResume(page, applicationData.resumePath);
      }

      // Handle multi-step form
      await this.handleWorkdaySteps(page, userData, applicationData);

      // Submit application
      await page.waitForSelector('[data-automation-id="bottom-navigation-next-button"]', { timeout: 5000 });
      await page.click('[data-automation-id="bottom-navigation-next-button"]');

      // Wait for confirmation
      await page.waitForSelector('.css-1dbjc4n:contains("Thank you")', { timeout: 10000 });

      return {
        success: true,
        message: 'Application submitted successfully via Workday',
        confirmationNumber: await this.getWorkdayConfirmation(page)
      };

    } catch (error) {
      logger.error('Workday application error:', error);
      return {
        success: false,
        message: `Workday application failed: ${error.message}`
      };
    }
  }

  async fillWorkdayPersonalInfo(page, userData) {
    const workdayFields = {
      '[data-automation-id="firstName"]': userData.firstName,
      '[data-automation-id="lastName"]': userData.lastName,
      '[data-automation-id="email"]': userData.email,
      '[data-automation-id="phone"]': userData.phone
    };

    for (const [selector, value] of Object.entries(workdayFields)) {
      if (value) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.type(selector, value);
        } catch (error) {
          continue;
        }
      }
    }
  }

  async handleWorkdaySteps(page, userData, applicationData) {
    // Workday typically has multiple steps
    let stepCount = 0;
    const maxSteps = 10;

    while (stepCount < maxSteps) {
      try {
        // Check if there's a next button
        const nextButton = await page.$('[data-automation-id="bottom-navigation-next-button"]');
        if (!nextButton) break;

        // Handle current step based on content
        await this.handleCurrentWorkdayStep(page, userData, applicationData);

        // Click next
        await page.click('[data-automation-id="bottom-navigation-next-button"]');
        await page.waitForTimeout(2000);
        
        stepCount++;
      } catch (error) {
        logger.warn(`Error on Workday step ${stepCount}:`, error.message);
        break;
      }
    }
  }

  async handleCurrentWorkdayStep(page, userData, applicationData) {
    // Handle different types of Workday steps
    const stepContent = await page.content();

    if (stepContent.includes('Resume') || stepContent.includes('CV')) {
      // Resume upload step
      if (applicationData.resumePath) {
        await this.uploadResume(page, applicationData.resumePath);
      }
    } else if (stepContent.includes('Cover Letter')) {
      // Cover letter step
      if (applicationData.coverLetter) {
        const textArea = await page.$('textarea');
        if (textArea) {
          await textArea.type(applicationData.coverLetter);
        }
      }
    } else if (stepContent.includes('Question') || stepContent.includes('screening')) {
      // Screening questions step
      await this.answerWorkdayQuestions(page, applicationData.screeningAnswers);
    }
  }

  async answerWorkdayQuestions(page, screeningAnswers) {
    // Handle various question types in Workday
    const questions = await page.$$('[data-automation-id*="question"]');
    
    for (const question of questions) {
      try {
        // Get question text
        const questionText = await question.$eval('.css-901oao', el => el.textContent);
        
        // Find appropriate answer
        const answer = this.findAnswerForQuestion(questionText, screeningAnswers);
        
        if (answer) {
          // Handle different input types
          const input = await question.$('input, select, textarea');
          if (input) {
            const inputType = await input.evaluate(el => el.type);
            
            if (inputType === 'text' || inputType === 'textarea') {
              await input.type(answer);
            } else if (inputType === 'select-one') {
              await input.select(answer);
            }
          }
        }
      } catch (error) {
        continue;
      }
    }
  }

  findAnswerForQuestion(questionText, screeningAnswers) {
    // Match questions to answers based on keywords
    const lowerQuestion = questionText.toLowerCase();
    
    if (lowerQuestion.includes('authorization') || lowerQuestion.includes('eligible')) {
      return screeningAnswers.workAuthorization || 'Yes';
    } else if (lowerQuestion.includes('sponsorship')) {
      return screeningAnswers.visaSponsorship || 'No';
    } else if (lowerQuestion.includes('experience')) {
      return screeningAnswers.yearsExperience || '5+ years';
    } else if (lowerQuestion.includes('salary') || lowerQuestion.includes('compensation')) {
      return screeningAnswers.salaryExpectation || 'Negotiable';
    } else if (lowerQuestion.includes('available') || lowerQuestion.includes('start')) {
      return screeningAnswers.availability || 'Immediately';
    }
    
    return 'Yes'; // Default answer
  }

  async getWorkdayConfirmation(page) {
    try {
      // Look for confirmation number or application ID
      const confirmationElement = await page.$('[data-automation-id*="confirmation"], .confirmation-number');
      if (confirmationElement) {
        return await confirmationElement.evaluate(el => el.textContent.trim());
      }
    } catch (error) {
      return null;
    }
  }
}

// Placeholder handlers for other ATS types
class GreenhouseHandler extends BaseATSHandler {
  constructor() {
    super();
    this.name = 'Greenhouse';
  }

  async apply(page, jobData, userData, applicationData) {
    // Implement Greenhouse-specific logic
    return {
      success: false,
      message: 'Greenhouse integration not yet implemented'
    };
  }
}

class TaleoHandler extends BaseATSHandler {
  constructor() {
    super();
    this.name = 'Taleo';
  }

  async apply(page, jobData, userData, applicationData) {
    // Implement Taleo-specific logic
    return {
      success: false,
      message: 'Taleo integration not yet implemented'
    };
  }
}

class ICIMSHandler extends BaseATSHandler {
  constructor() {
    super();
    this.name = 'iCIMS';
  }

  async apply(page, jobData, userData, applicationData) {
    // Implement iCIMS-specific logic
    return {
      success: false,
      message: 'iCIMS integration not yet implemented'
    };
  }
}

class CustomHandler extends BaseATSHandler {
  constructor() {
    super();
    this.name = 'Custom';
  }

  async apply(page, jobData, userData, applicationData) {
    // Generic application logic for unknown ATS
    try {
      await page.goto(jobData.job_url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Look for apply button
      const applySelectors = [
        'button:contains("Apply")',
        'a:contains("Apply")',
        '[class*="apply"]',
        '[id*="apply"]'
      ];

      let applyButton = null;
      for (const selector of applySelectors) {
        try {
          applyButton = await page.$(selector);
          if (applyButton) break;
        } catch (error) {
          continue;
        }
      }

      if (applyButton) {
        await applyButton.click();
        await page.waitForTimeout(3000);

        // Fill basic information
        await this.fillBasicInfo(page, userData);

        // Upload resume if possible
        if (applicationData.resumePath) {
          await this.uploadResume(page, applicationData.resumePath);
        }

        // Submit application
        await this.submitApplication(page);

        return {
          success: true,
          message: 'Application submitted via custom handler'
        };
      } else {
        return {
          success: false,
          message: 'Could not find apply button on page'
        };
      }

    } catch (error) {
      return {
        success: false,
        message: `Custom application failed: ${error.message}`
      };
    }
  }
}

module.exports = ATSIntegrator;