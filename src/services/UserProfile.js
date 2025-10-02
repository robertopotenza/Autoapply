const db = require('../database/db');
const Job = require('../models/Job');
const Application = require('../models/Application');
const AutoApplySettings = require('../models/AutoApplySettings');

class UserProfile {
  static async getCompleteProfile(userId) {
    try {
      // Get user and profile data from existing tables
      const userQuery = `
        SELECT u.*, p.current_role, p.current_salary, p.years_experience, 
               p.location, p.linkedin_url, p.skills
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = $1
      `;
      
      const result = await db.query(userQuery, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      
      // Create a simplified profile structure that works with existing data
      return {
        user_id: user.id,
        email: user.email,
        created_at: user.created_at,
        
        // Personal Information - use available data
        personal: {
          full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          phone: null, // Not in current schema
          country: null, // Not in current schema  
          city: user.location ? user.location.split(',')[0] : null,
          state_region: user.location ? user.location.split(',')[1] : null,
          postal_code: null, // Not in current schema
          resume_path: null, // Not in current schema
          cover_letter_option: 'generate', // Default
          cover_letter_path: null
        },
        
        // Job Preferences - use available data and reasonable defaults
        preferences: {
          remote_jobs: ['hybrid', 'remote'], // Default preference
          onsite_location: user.location,
          job_types: ['full-time'], // Default
          job_titles: user.current_role ? [user.current_role] : ['Software Engineer'], // Use current role or default
          seniority_levels: this.determineSeniorityFromExperience(user.years_experience),
          time_zones: ['PST', 'EST'] // Default time zones
        },
        
        // Eligibility - use available data with sensible defaults
        eligibility: {
          current_job_title: user.current_role || 'Software Engineer',
          availability: 'Immediately', // Default
          eligible_countries: ['United States'], // Default
          visa_sponsorship: false, // Default
          nationality: ['United States'], // Default
          current_salary: user.current_salary || user.target_salary,
          expected_salary: user.target_salary
        },
        
        // Additional Screening Information - reasonable defaults
        screening: {
          experience_summary: `${user.years_experience || 3} years of experience in ${user.current_role || 'software development'}`,
          hybrid_preference: 'hybrid', // Default
          travel: 'No', // Default
          relocation: 'No', // Default  
          languages: ['English'], // Default
          date_of_birth: null,
          gpa: null,
          is_adult: true, // Default assumption
          gender_identity: null,
          disability_status: null,
          military_service: null,
          ethnicity: null,
          driving_license: null
        }
      };
    } catch (error) {
      console.error('Error getting complete user profile:', error);
      return null;
    }
  }

  static parseJsonField(jsonField) {
    if (!jsonField) return [];
    if (typeof jsonField === 'string') {
      try {
        return JSON.parse(jsonField);
      } catch {
        return [];
      }
    }
    return jsonField;
  }

  // Determine seniority level based on years of experience
  static determineSeniorityFromExperience(yearsExperience) {
    if (!yearsExperience) return ['Mid-level']; // Default
    
    if (yearsExperience < 2) return ['Junior', 'Entry-level'];
    if (yearsExperience < 5) return ['Mid-level'];
    if (yearsExperience < 8) return ['Senior'];
    return ['Senior', 'Lead', 'Principal'];
  }

  // Convert profile data to format needed by ATS integrator
  static formatForATS(profile) {
    if (!profile) return null;

    return {
      // Basic personal information
      firstName: this.extractFirstName(profile.personal.full_name),
      lastName: this.extractLastName(profile.personal.full_name),
      fullName: profile.personal.full_name,
      email: profile.email,
      phone: profile.personal.phone,
      
      // Address information
      city: profile.personal.city,
      state: profile.personal.state_region,
      country: profile.personal.country,
      zipCode: profile.personal.postal_code,
      
      // Work authorization and eligibility
      workAuthorization: this.determineWorkAuthorization(profile.eligibility),
      visaSponsorship: profile.eligibility.visa_sponsorship ? 'Yes' : 'No',
      eligibleCountries: profile.eligibility.eligible_countries,
      nationality: profile.eligibility.nationality,
      
      // Experience and availability
      currentJobTitle: profile.eligibility.current_job_title,
      yearsExperience: this.calculateExperience(profile.screening.experience_summary),
      availability: profile.eligibility.availability || 'Immediately',
      
      // Salary expectations
      currentSalary: profile.eligibility.current_salary,
      expectedSalary: profile.eligibility.expected_salary,
      salaryExpectation: this.formatSalaryExpectation(profile.eligibility.expected_salary),
      
      // Work preferences
      remoteWork: this.formatRemotePreference(profile.preferences.remote_jobs),
      hybridPreference: profile.screening.hybrid_preference,
      travelWillingness: profile.screening.travel,
      relocationWillingness: profile.screening.relocation,
      
      // Personal details for screening questions
      languages: profile.screening.languages,
      dateOfBirth: profile.screening.date_of_birth,
      gpa: profile.screening.gpa,
      isAdult: profile.screening.is_adult,
      genderIdentity: profile.screening.gender_identity,
      disabilityStatus: profile.screening.disability_status,
      militaryService: profile.screening.military_service,
      ethnicity: profile.screening.ethnicity,
      drivingLicense: profile.screening.driving_license,
      
      // Files
      resumePath: profile.personal.resume_path,
      coverLetterPath: profile.personal.cover_letter_path,
      coverLetterOption: profile.personal.cover_letter_option
    };
  }

  static extractFirstName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts[0] || '';
  }

  static extractLastName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  static determineWorkAuthorization(eligibility) {
    if (!eligibility.eligible_countries) return 'No';
    
    const countries = Array.isArray(eligibility.eligible_countries) 
      ? eligibility.eligible_countries 
      : [eligibility.eligible_countries];
    
    // Check if user is authorized to work in US
    if (countries.some(country => 
      country.toLowerCase().includes('united states') || 
      country.toLowerCase().includes('us') ||
      country.toLowerCase().includes('usa')
    )) {
      return 'Yes';
    }
    
    return eligibility.visa_sponsorship ? 'Requires Sponsorship' : 'No';
  }

  static calculateExperience(experienceSummary) {
    if (!experienceSummary) return '0-1 years';
    
    // Try to extract years from experience summary
    const yearMatches = experienceSummary.match(/(\d+)\s*(?:years?|yrs?)/i);
    if (yearMatches) {
      const years = parseInt(yearMatches[1]);
      if (years < 2) return '0-1 years';
      if (years <= 3) return '2-3 years';
      if (years <= 5) return '3-5 years';
      if (years <= 7) return '5-7 years';
      return '7+ years';
    }
    
    // Default based on length of description
    if (experienceSummary.length > 500) return '5+ years';
    if (experienceSummary.length > 200) return '2-5 years';
    return '0-2 years';
  }

  static formatSalaryExpectation(expectedSalary) {
    if (!expectedSalary) return 'Negotiable';
    
    // Format salary as a range
    const salary = parseFloat(expectedSalary);
    if (salary < 50000) return '$40K - $60K';
    if (salary < 80000) return '$60K - $90K';
    if (salary < 120000) return '$90K - $130K';
    if (salary < 180000) return '$130K - $200K';
    return '$180K+';
  }

  static formatRemotePreference(remoteJobs) {
    if (!remoteJobs || remoteJobs.length === 0) return 'Onsite only';
    
    const preferences = Array.isArray(remoteJobs) ? remoteJobs : [remoteJobs];
    
    if (preferences.includes('remote-only')) return 'Remote only';
    if (preferences.includes('hybrid')) return 'Hybrid preferred';
    if (preferences.includes('remote') && preferences.includes('onsite')) return 'Open to both';
    if (preferences.includes('remote')) return 'Remote preferred';
    return 'Onsite preferred';
  }

  // Generate screening answers based on profile
  static generateScreeningAnswers(profile) {
    const atsData = this.formatForATS(profile);
    
    return {
      // Work authorization questions
      workAuthorization: atsData.workAuthorization,
      visaSponsorship: atsData.visaSponsorship,
      eligibleToWork: atsData.workAuthorization === 'Yes' ? 'Yes' : 'No',
      
      // Experience questions
      yearsExperience: atsData.yearsExperience,
      relevantExperience: profile.screening.experience_summary || 'Experienced professional with relevant background',
      
      // Availability questions
      availability: atsData.availability,
      startDate: atsData.availability === 'Immediately' ? 'Immediately' : '2 weeks notice',
      
      // Salary questions
      salaryExpectation: atsData.salaryExpectation,
      salaryNegotiable: 'Yes',
      
      // Location and travel questions
      remoteWork: atsData.remoteWork,
      hybridWork: atsData.hybridPreference || 'Open to hybrid',
      travelWillingness: atsData.travelWillingness || 'Occasional travel acceptable',
      relocation: atsData.relocationWillingness || 'Open to relocation for right opportunity',
      
      // Education questions
      degreeCompleted: 'Yes', // Assume college degree
      gpa: atsData.gpa || 'N/A',
      
      // Personal questions (for EEO compliance)
      gender: atsData.genderIdentity || 'Prefer not to say',
      ethnicity: atsData.ethnicity || 'Prefer not to say',
      disability: atsData.disabilityStatus || 'No',
      veteran: atsData.militaryService || 'No',
      
      // Additional questions
      drivingLicense: atsData.drivingLicense || 'Yes',
      backgroundCheck: 'Yes',
      drugTest: 'Yes',
      
      // Default professional answers
      teamWork: 'I excel in collaborative environments and enjoy working with diverse teams',
      leadership: 'I have experience leading projects and mentoring team members',
      communication: 'Strong written and verbal communication skills',
      problemSolving: 'Analytical thinker with proven problem-solving abilities',
      motivation: 'Passionate about contributing to innovative projects and company growth'
    };
  }

  // Check if user profile is complete enough for autoapply
  static isProfileComplete(profile) {
    if (!profile) {
      return { complete: false, missing: 'Profile not found' };
    }
    
    // For existing users, we'll be more lenient and use available data
    // Essential requirements for autoapply to work
    const essentials = {
      email: profile.email,
      fullName: profile.personal?.full_name,
      currentJobTitle: profile.eligibility?.current_job_title,
      jobTitles: profile.preferences?.job_titles
    };
    
    // Check essential fields
    if (!essentials.email) {
      return { complete: false, missing: 'Email address' };
    }
    
    if (!essentials.fullName || essentials.fullName.trim() === '') {
      return { complete: false, missing: 'Full name' };
    }
    
    if (!essentials.currentJobTitle) {
      return { complete: false, missing: 'Current job title' };
    }
    
    if (!essentials.jobTitles || essentials.jobTitles.length === 0) {
      return { complete: false, missing: 'Job preferences' };
    }
    
    // Profile is complete enough for autoapply
    return { complete: true };
  }

  // Get user application readiness summary
  static async getApplicationReadiness(userId) {
    try {
      const profile = await this.getCompleteProfile(userId);
      const completeness = this.isProfileComplete(profile);
      const autoApplySettings = await AutoApplySettings.findByUser(userId);
      
      return {
        userId: userId,
        profileComplete: completeness.complete,
        missingFields: completeness.missing || null,
        autoApplyEnabled: autoApplySettings.is_enabled,
        autoApplyMode: autoApplySettings.mode,
        readyForAutoApply: completeness.complete && autoApplySettings.is_enabled,
        profile: profile,
        settings: autoApplySettings
      };
    } catch (error) {
      console.error('Error getting application readiness:', error);
      return {
        userId: userId,
        profileComplete: false,
        readyForAutoApply: false,
        error: error.message
      };
    }
  }

  // Create application data package for ATS integrator
  static async createApplicationPackage(userId, jobData) {
    try {
      const profile = await this.getCompleteProfile(userId);
      if (!profile) {
        throw new Error('User profile not found');
      }

      const atsData = this.formatForATS(profile);
      const screeningAnswers = this.generateScreeningAnswers(profile);
      
      return {
        jobData: jobData,
        userData: atsData,
        applicationData: {
          resumePath: profile.personal.resume_path,
          coverLetterPath: profile.personal.cover_letter_path,
          coverLetter: await this.generateCoverLetter(profile, jobData),
          screeningAnswers: screeningAnswers,
          personalInfo: atsData,
          preferences: profile.preferences,
          eligibility: profile.eligibility
        }
      };
    } catch (error) {
      console.error('Error creating application package:', error);
      throw error;
    }
  }

  static async generateCoverLetter(profile, jobData) {
    // Basic cover letter template using profile data
    const name = profile.personal.full_name;
    const currentRole = profile.eligibility.current_job_title;
    const company = jobData.company_name;
    const position = jobData.job_title;
    
    return `Dear ${company} Hiring Team,

I am writing to express my interest in the ${position} position at ${company}. As a ${currentRole}, I am excited about the opportunity to contribute to your team.

${profile.screening.experience_summary || 'I bring relevant experience and skills that align well with this role.'}

I am ${profile.eligibility.availability.toLowerCase()} and ${profile.eligibility.visa_sponsorship ? 'would require visa sponsorship' : 'authorized to work in the specified locations'}.

Thank you for your consideration. I look forward to hearing from you.

Best regards,
${name}`;
  }
}

module.exports = UserProfile;