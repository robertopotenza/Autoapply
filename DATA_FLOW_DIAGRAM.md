# Data Flow Diagram: Wizard Form to Database

## Complete Data Pipeline for All 34 Fields

```
┌─────────────────────────────────────────────────────────────────┐
│                     WIZARD FORM (wizard.html)                   │
│                                                                 │
│  Step 1: Work Location & Job Preferences                       │
│  ├─ remote-countries-input  (multi-select)                     │
│  ├─ onsite-region           (select)                           │
│  ├─ job-types               (pills → hidden)                   │
│  └─ job-titles              (tags → hidden)                    │
│                                                                 │
│  Step 2: Seniority & Time Zones                                │
│  ├─ seniority-levels        (pills → hidden)                   │
│  └─ timezones-input         (multi-select)                     │
│                                                                 │
│  Step 3: Resume, Cover Letter & Contact                        │
│  ├─ resume-upload           (file)                             │
│  ├─ cover-letter-option     (pills → hidden)                   │
│  ├─ cover-letter-file       (file)                             │
│  ├─ full-name               (text)                             │
│  ├─ email                   (email) ⭐ FIXED                   │
│  ├─ country-code + phone    (select + tel)                     │
│  ├─ location-country        (select)                           │
│  ├─ location-city           (text)                             │
│  ├─ location-state          (text)                             │
│  └─ location-postal         (text)                             │
│                                                                 │
│  Step 4: Job & Eligibility Details                             │
│  ├─ current-job-title       (text)                             │
│  ├─ availability            (pills → hidden)                   │
│  ├─ eligible-countries      (multi-select → hidden)            │
│  ├─ visa-sponsorship        (pills → hidden)                   │
│  ├─ nationalities           (multi-select → hidden)            │
│  ├─ current-salary          (number)                           │
│  ├─ expected-salary         (number)                           │
│  ├─ experience-summary      (textarea)                         │
│  ├─ hybrid-preference       (pills → hidden)                   │
│  ├─ travel-comfortable      (pills → hidden)                   │
│  ├─ relocation-open         (pills → hidden)                   │
│  ├─ languages-input         (multi-select)                     │
│  ├─ date-of-birth           (date)                             │
│  ├─ gpa                     (number)                           │
│  ├─ age-18                  (pills → hidden)                   │
│  ├─ gender                  (select)                           │
│  ├─ disability              (select)                           │
│  ├─ military                (select)                           │
│  ├─ ethnicity               (select)                           │
│  ├─ licenses                (text)                             │
│  └─ no-license              (checkbox) ⭐ FIXED                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    saveStepData() on each step
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 FORM STATE (localStorage)                       │
│              formState.data[field-id] = value                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        Form Submission
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND: parseFormData() (app.js)                 │
│                                                                 │
│  Extracts and transforms all field values:                      │
│  ├─ Combines country-code + phone                              │
│  ├─ Parses comma-separated multi-select values                 │
│  ├─ Extracts hidden field values from pills                    │
│  ├─ Includes email field ⭐ FIXED                              │
│  └─ Handles no-license checkbox ⭐ FIXED                       │
│      (sets licenses to "No driver's license" if checked)       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    submitForm() (app.js)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API REQUESTS (HTTPS)                         │
│                                                                 │
│  POST /api/wizard/step1 (Job Preferences)                      │
│  ├─ remoteJobs: []                                             │
│  ├─ onsiteLocation: ""                                         │
│  ├─ jobTypes: []                                               │
│  ├─ jobTitles: []                                              │
│  ├─ seniorityLevels: []                                        │
│  └─ timeZones: []                                              │
│                                                                 │
│  POST /api/wizard/step2 (Profile)                              │
│  ├─ fullName: ""                                               │
│  ├─ email: "" ⭐ FIXED                                         │
│  ├─ resumePath: ""                                             │
│  ├─ coverLetterOption: ""                                      │
│  ├─ coverLetterPath: ""                                        │
│  ├─ phone: ""                                                  │
│  ├─ country: ""                                                │
│  ├─ city: ""                                                   │
│  ├─ stateRegion: ""                                            │
│  └─ postalCode: ""                                             │
│                                                                 │
│  POST /api/wizard/step3 (Eligibility)                          │
│  ├─ currentJobTitle: ""                                        │
│  ├─ availability: ""                                           │
│  ├─ eligibleCountries: []                                      │
│  ├─ visaSponsorship: false                                     │
│  ├─ nationality: []                                            │
│  ├─ currentSalary: null                                        │
│  └─ expectedSalary: null                                       │
│                                                                 │
│  POST /api/wizard/screening (Screening)                        │
│  ├─ experienceSummary: ""                                      │
│  ├─ hybridPreference: ""                                       │
│  ├─ travel: ""                                                 │
│  ├─ relocation: ""                                             │
│  ├─ languages: []                                              │
│  ├─ dateOfBirth: null                                          │
│  ├─ gpa: null                                                  │
│  ├─ isAdult: false                                             │
│  ├─ genderIdentity: ""                                         │
│  ├─ disabilityStatus: ""                                       │
│  ├─ militaryService: ""                                        │
│  ├─ ethnicity: ""                                              │
│  └─ drivingLicense: "" ⭐ FIXED                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
              Express Routes (wizard.js)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               BACKEND: Database Models                          │
│                                                                 │
│  JobPreferences.upsert(userId, data)                           │
│  Profile.upsert(userId, data) ⭐ UPDATED                       │
│  Eligibility.upsert(userId, data)                              │
│  ScreeningAnswers.upsert(userId, data)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        SQL Queries
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          POSTGRESQL DATABASE (Railway)                          │
│                                                                 │
│  Table: job_preferences                                         │
│  ├─ user_id (FK)                                               │
│  ├─ remote_jobs (JSONB)                                        │
│  ├─ onsite_location (VARCHAR)                                  │
│  ├─ job_types (JSONB)                                          │
│  ├─ job_titles (JSONB)                                         │
│  ├─ seniority_levels (JSONB)                                   │
│  └─ time_zones (JSONB)                                         │
│                                                                 │
│  Table: profile ⭐ UPDATED                                     │
│  ├─ user_id (FK)                                               │
│  ├─ full_name (VARCHAR)                                        │
│  ├─ email (VARCHAR) ⭐ NEW COLUMN                             │
│  ├─ resume_path (TEXT)                                         │
│  ├─ cover_letter_option (VARCHAR)                              │
│  ├─ cover_letter_path (TEXT)                                   │
│  ├─ phone (VARCHAR)                                            │
│  ├─ country (VARCHAR)                                          │
│  ├─ city (VARCHAR)                                             │
│  ├─ state_region (VARCHAR)                                     │
│  └─ postal_code (VARCHAR)                                      │
│                                                                 │
│  Table: eligibility                                             │
│  ├─ user_id (FK)                                               │
│  ├─ current_job_title (VARCHAR)                                │
│  ├─ availability (VARCHAR)                                     │
│  ├─ eligible_countries (JSONB)                                 │
│  ├─ visa_sponsorship (BOOLEAN)                                 │
│  ├─ nationality (JSONB)                                        │
│  ├─ current_salary (NUMERIC)                                   │
│  └─ expected_salary (NUMERIC)                                  │
│                                                                 │
│  Table: screening_answers                                       │
│  ├─ user_id (FK)                                               │
│  ├─ experience_summary (TEXT)                                  │
│  ├─ hybrid_preference (VARCHAR)                                │
│  ├─ travel (VARCHAR)                                           │
│  ├─ relocation (VARCHAR)                                       │
│  ├─ languages (JSONB)                                          │
│  ├─ date_of_birth (DATE)                                       │
│  ├─ gpa (NUMERIC)                                              │
│  ├─ is_adult (BOOLEAN)                                         │
│  ├─ gender_identity (VARCHAR)                                  │
│  ├─ disability_status (VARCHAR)                                │
│  ├─ military_service (VARCHAR)                                 │
│  ├─ ethnicity (VARCHAR)                                        │
│  └─ driving_license (TEXT) ⭐ HANDLES CHECKBOX                │
└─────────────────────────────────────────────────────────────────┘

Legend:
⭐ = Fixed or Enhanced in this PR
FK = Foreign Key
JSONB = JSON Binary (PostgreSQL)
```

## Key Improvements

1. **Email Field**: Complete data pipeline from form → database
2. **No-License Checkbox**: Properly handled and stored
3. **All 34 Fields**: Verified and functioning correctly

## Verification

Run these scripts to verify:
- `node scripts/run-migration-003.js` - Apply database changes
- `node scripts/verify-database.js` - Validate structure
- `node scripts/verify-database.js --user <email>` - Check user data
