<<<<<<< HEAD
# Apply Autonomously - Enhanced AutoApply Platform

🚀 **Advanced AI-Powered Job Application Automation Platform**

## 🎯 Overview

Apply Autonomously is a comprehensive job application automation platform that intelligently scans job boards, matches opportunities to user preferences, and automates the application process. Built with Node.js, PostgreSQL, and AI-powered form filling.

### 🌟 **Live Platform**
- **Production URL**: https://autoapply-production-1393.up.railway.app
- **Railway Project**: Apply Autonomously (869e01d3-accc-4409-a7b3-5f2970846141)
- **Status**: ✅ Fully operational with enhanced autoapply features

## ✨ Key Features

### 🔍 **Intelligent Job Scanning**
- **Multi-Platform Support**: Indeed, LinkedIn, Glassdoor
- **AI-Powered Matching**: 0-100% relevance scoring
- **Smart Filtering**: Based on salary, location, experience level
- **Duplicate Prevention**: Avoids re-scanning identical positions

### 🤖 **Advanced Application Automation**
- **ATS Detection**: Workday, Greenhouse, Lever, iCIMS, LinkedIn Easy Apply
- **Smart Form Filling**: AI-powered field recognition and completion
- **Resume Management**: Automated resume upload and attachment
- **Screening Intelligence**: Contextual screening question responses

### 📊 **Comprehensive Analytics**
- **Match Scoring**: Detailed explanations for job relevance
- **Application Tracking**: Real-time status monitoring
- **Success Metrics**: Conversion rates and performance analytics
- **Session Management**: User activity and progress tracking

### 🛡️ **Safety & Control**
- **Review Mode**: User approval before submission (default)
- **Auto Mode**: Fully automated application submission
- **Daily Limits**: Configurable application quotas
- **Quality Controls**: Match score thresholds and filters

## 🏗️ Architecture

### **Frontend** (Existing - Fully Functional)
- Landing page with authentication
- Magic link login system
- User onboarding wizard
- Real-time dashboard
- Application management interface

### **Backend** (Enhanced)
- Express.js API server
- PostgreSQL database with comprehensive schema
- AI-powered job scanning and matching
- Application automation engine
- Session and user management

### **Database Schema**
```sql
-- Core Tables
users                    -- User accounts with magic link auth
job_preferences          -- User job search criteria
profile                  -- User profile information
eligibility              -- Work authorization and requirements
screening_answers        -- Saved screening responses

-- Enhanced AutoApply Tables
job_opportunities        -- Scanned jobs with match scores
job_applications         -- Application attempts and status
autoapply_sessions       -- User automation sessions
autoapply_config         -- User-specific configuration
application_templates    -- Cover letter and response templates
```

## 🚀 Quick Start

### 1. **Access the Platform**
Visit https://autoapply-production-1393.up.railway.app and create an account using magic link authentication.

### 2. **Complete Setup**
- Fill out your profile information
- Set job preferences (roles, salary, location)
- Upload your resume
- Configure autoapply settings

### 3. **Start AutoApply**
```javascript
POST /api/autoapply/start
```
The system will begin scanning for relevant jobs and can automate applications based on your preferences.

## 🔧 API Documentation

### **Core AutoApply Endpoints**

#### Start AutoApply
```http
POST /api/autoapply/start
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "message": "Autoapply started successfully",
  "data": {
    "sessionId": "uuid",
    "initialJobs": 15,
    "config": { ... }
  }
}
```

#### Get Job Opportunities
```http
GET /api/autoapply/jobs?page=1&limit=20&minScore=70
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "uuid",
        "title": "Senior Software Engineer",
        "company": "TechCorp",
        "matchScore": 85,
        "matchReasons": ["Title matches", "Location match"],
        "application_status": null
      }
    ],
    "pagination": { ... }
  }
}
```

#### Apply to Jobs
```http
POST /api/autoapply/apply
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "jobIds": ["job-uuid-1", "job-uuid-2"]
}
```

### **Additional Endpoints**
- `GET /api/autoapply/status` - Current autoapply status
- `POST /api/autoapply/stop` - Stop autoapply session
- `GET /api/autoapply/applications` - Application history
- `GET /api/autoapply/stats` - Comprehensive statistics
- `POST /api/autoapply/config` - Update configuration

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL (Railway managed)
- **Authentication**: JWT + Magic Links
- **AI Integration**: OpenAI GPT-4o-mini
- **Web Scraping**: Puppeteer + Cheerio
- **Email Service**: Resend
- **Deployment**: Railway
- **Version Control**: Git

## 📈 Performance Features

- **Asynchronous Processing**: Non-blocking job scanning
- **Database Optimization**: Indexed queries and views
- **Rate Limiting**: Respectful job board interaction
- **Error Recovery**: Automatic retry mechanisms
- **Session Management**: Efficient resource cleanup

## 🔒 Security & Privacy

- **JWT Authentication**: Secure API access
- **Magic Link Auth**: Passwordless authentication
- **Data Encryption**: Secure data transmission
- **Rate Limiting**: API abuse prevention
- **Privacy Controls**: User data ownership

## 🌍 Environment Variables

```bash
# Core Configuration
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://...

# AI & Automation
OPENAI_API_KEY=sk-proj-...
AUTOMATION_MODE=review  # or 'auto'
CHAT_MODEL=gpt-4o-mini

# Email Service
EMAIL_SERVICE=resend
RESEND_API_KEY=re_...

# AutoApply Configuration
SCAN_INTERVAL_HOURS=2
```

## 📝 Usage Modes

### **Review Mode** (Default)
- Scans jobs and calculates match scores
- Fills out application forms automatically
- **Requires user approval** before submission
- Provides detailed application previews

### **Auto Mode** (Full Automation)
- Fully automated job scanning and application
- Respects daily limits and match thresholds
- Provides comprehensive logging and tracking
- Suitable for experienced users with refined preferences

## 📊 Monitoring & Analytics

### **User Dashboard**
- Real-time application status
- Job match analytics
- Success rate tracking
- Session history and statistics

### **System Health**
```http
GET /api/health/enhanced

Response:
{
  "status": "healthy",
  "autoapply": {
    "active_users": 5,
    "jobs_scanned_24h": 150,
    "applications_submitted_24h": 45
  }
}
```

## 🎯 Success Metrics

- **Job Matching Accuracy**: 85%+ relevance scores
- **Application Success Rate**: Tracked per user and globally
- **Time Savings**: Automated applications vs manual process
- **User Satisfaction**: Application quality and interview rates

## 🔄 Development Status

### ✅ **Completed Features**
- User authentication and management
- Job scanning engine (Indeed, LinkedIn, Glassdoor)
- AI-powered application automation
- Comprehensive API system
- Real-time dashboard and analytics
- Database optimization and indexing

### 🚧 **In Progress**
- Enhanced deployment and integration
- Advanced matching algorithms
- Additional job board integrations
- Mobile application interface

### 📋 **Roadmap**
- Advanced AI screening responses
- Company research integration
- Interview scheduling automation
- Performance analytics dashboard

## 🆘 Support & Documentation

- **Detailed Documentation**: See `README_DETAIL.md`
- **API Reference**: Available in platform dashboard
- **Troubleshooting**: Comprehensive guide included
- **Contact**: Via platform support system

## 📄 License

MIT License - See LICENSE file for details.

---

**Ready to revolutionize your job search with AI-powered automation! 🚀**
=======
# Auto-Apply - Automated Job Application Platform

An intelligent AI-powered platform that automates job applications with user authentication, PostgreSQL database, and a comprehensive wizard interface.

## 🚀 Features

### User Authentication
- Secure signup and login with JWT tokens
- Password hashing with bcrypt
- Session management
- Protected routes and API endpoints

### Multi-Step Configuration Wizard
- **Step 1: Work Location & Jobs** - Remote/onsite preferences, job types, job titles
- **Step 2: Seniority & Time Zones** - Seniority levels and time zone preferences
- **Step 3: Resume & Contact** - Resume upload, cover letter, contact information
- **Step 4: Eligibility Details** - Work authorization, visa requirements, salary expectations
- **Optional Screening Questions** - Demographics, preferences, compliance information

### User Dashboard
- Profile completion tracking
- Editable sections
- Application history
- Quick access to all settings

### Automated Job Scanning
- Scans company career sites every ~2 hours
- Matches jobs against configured criteria
- Filters by titles, keywords, locations, seniority

### AI-Powered Applications
- Auto-generates cover letters using OpenAI
- Creates personalized screening question answers
- Learns from user edits and improves over time
- Adapts to match user's voice and style

### Automation Modes
- **Full Auto-Apply** - Applies immediately without review
- **Review First** - Drafts applications for user approval

## 🌐 Supported Platforms

AGENT AI applies directly on company career portals (not just job boards like Indeed or LinkedIn).

It avoids most spam postings by targeting verified, first-party job listings.

Compatible with most major ATS (Applicant Tracking Systems) like Workday, Greenhouse, Taleo, iCIMS, though occasional variations in workflow may require manual handling.

### Supported Platforms — How It Works

#### 1. Direct Application on Career Portals

Instead of just scraping job boards (like Indeed or ZipRecruiter), AGENT AI navigates directly to a company's career page or ATS portal.

**Example:** If Tesla posts a role, AGENT AI goes straight to careers.tesla.com or their Workday portal, not the LinkedIn mirror posting.

This ensures the application is official, first-party, and less likely to disappear or lead to spam.

#### 2. Why First-Party Matters

- **Verified authenticity** → applications are guaranteed to go to the real employer, not a recruiter farm or a reposted listing.
- **Better tracking** → status updates (Applied, Interview, Offer) tend to be more accurate when tied directly to the employer's ATS.
- **Avoids "black holes"** → many third-party job boards never pass applications forward; direct portals reduce this risk.

#### 3. ATS (Applicant Tracking System) Compatibility

Most companies use ATS platforms to manage applications. AGENT AI is designed to interact with the most common ones:

- **Workday** → very common in large enterprises; AGENT AI autofills fields like personal info, work history, education, and uploads resumes.
- **Greenhouse** → popular with tech companies; AGENT AI handles structured forms, equal opportunity surveys, and file uploads.
- **Taleo (Oracle)** → widely used in manufacturing and healthcare; AGENT AI manages multi-page application flows.
- **iCIMS** → often used by mid-to-large companies; AGENT AI navigates through different modules for resume parsing and questions.
- **Other Systems** → Lever, BrassRing, SmartRecruiters, etc., are also partly supported, though some require manual verification.

#### 4. How AGENT AI Interacts

- **Form Autofill** → Uses stored profile data (name, contact, education, employment history) to populate fields.
- **Resume Upload** → Either base or tailored resume is uploaded to the ATS.
- **Screening Questions** → AI-generated answers are inserted (or pulled from your pre-saved responses).
- **Consent & Surveys** → Handles EEO, diversity, and location/work authorization questions.
- **Submission Confirmation** → Waits for a successful "Application Submitted" confirmation page before logging completion in the dashboard.

#### 5. Handling Variations

ATS platforms sometimes change layouts or add extra questions.

AGENT AI uses a mix of:

- **Pre-trained workflows** (specific sequences for Workday, Taleo, etc.)
- **Fallback prompts** (if it sees an unexpected field, it tries to answer logically using your stored data)
- **Error detection** (if the application stalls, it flags it for manual review rather than submitting incomplete data).

#### 6. Example Flow — Workday

1. AGENT AI detects a "VP Operations" posting at Company X.
2. It opens the Workday portal link.
3. Logs into your pre-synced applicant profile (if credentials stored securely).
4. Uploads the tailored resume from your Railway app.
5. Auto-fills education and employment history.
6. Answers screening questions with AI text.
7. Confirms submission and saves the confirmation number in the dashboard.

✅ **The result:** You're always applying where it matters most (direct employer systems), with reduced spam and higher reliability.

⚠️ **The caveat:** Not every ATS is 100% consistent; occasionally a question or step may require manual intervention.

## 🗄️ Database Schema

PostgreSQL database with the following tables:
- `users` - User accounts and authentication
- `job_preferences` - Job search criteria (Steps 1 & 2)
- `profile` - User profile and contact info (Step 3)
- `eligibility` - Work eligibility and salary (Step 4)
- `screening_answers` - Optional screening questions

## 📋 Prerequisites

- Node.js 16+
- PostgreSQL database (Railway hosted)
- OpenAI API key

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/robertopotenza/Autoapply
cd Autoapply
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# PostgreSQL Database (Railway)
PGHOST=tramway.proxy.rlwy.net
PGUSER=postgres
PGPASSWORD=your_postgres_password
PGDATABASE=railway
PGPORT=5432

# JWT Secret (change in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Server
PORT=3000
NODE_ENV=production
```

### 4. Initialize the database

The database tables will be automatically created when the server starts.

Alternatively, you can manually run the schema:

```bash
psql -h tramway.proxy.rlwy.net -U postgres -d railway -f database/schema.sql
```

### 5. Start the server

```bash
npm start
```

The application will be available at `http://localhost:3000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user info

### Wizard Configuration
- `GET /api/wizard/data` - Get all user data
- `POST /api/wizard/step1` - Save job preferences
- `POST /api/wizard/step2` - Save profile info
- `POST /api/wizard/step3` - Save eligibility
- `POST /api/wizard/screening` - Save screening answers
- `PUT /api/wizard/update` - Update any section
- `GET /api/wizard/completion` - Get completion percentage

### File Upload
- `POST /api/upload` - Upload resume/cover letter (authenticated)

## 🎯 User Flow

1. **Sign Up** - Create account at `/signup.html`
2. **Complete Wizard** - Fill out 4-step configuration at `/wizard.html`
3. **Dashboard** - View and edit profile at `/dashboard.html`
4. **Auto-Apply** - System automatically applies to matching jobs

## 🏗️ Project Structure

```
autoapply/
├── database/
│   └── schema.sql           # PostgreSQL schema
├── public/
│   ├── index.html           # Landing page
│   ├── login.html           # Login page
│   ├── signup.html          # Signup page
│   ├── wizard.html          # Configuration wizard
│   ├── dashboard.html       # User dashboard
│   ├── styles.css           # Shared styles
│   └── app.js               # Wizard frontend logic
├── src/
│   ├── database/
│   │   ├── db.js            # Database connection
│   │   └── models/          # Data models
│   ├── middleware/
│   │   └── auth.js          # JWT authentication
│   ├── routes/
│   │   ├── auth.js          # Auth endpoints
│   │   └── wizard.js        # Wizard endpoints
│   ├── ai/
│   │   ├── contentGenerator.js
│   │   └── learningSystem.js
│   ├── scanner/
│   │   └── jobScanner.js
│   ├── application/
│   │   └── applicationEngine.js
│   ├── utils/
│   │   └── logger.js
│   └── server.js            # Express server
├── .env.example
├── package.json
└── README.md
```

## 🔒 Security

- Passwords hashed with bcrypt (10 salt rounds)
- JWT tokens for authentication
- Environment variables for sensitive data
- SQL injection protection with parameterized queries
- File upload validation and limits
- HTTPS recommended for production

## 🚢 Deployment (Railway)

The application is configured for Railway deployment:

1. Set environment variables in Railway dashboard:
   - `OPENAI_API_KEY`
   - `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`
   - `JWT_SECRET`
   - `NODE_ENV=production`

2. Database will auto-initialize on first run

3. Application will be available at your Railway URL

## 🛣️ Roadmap

- [ ] OAuth integration (Google, LinkedIn)
- [ ] Email notifications for new applications
- [ ] Application analytics and reporting
- [ ] Resume parsing and optimization
- [ ] Job board integrations
- [ ] Mobile app

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

**Built with:** Node.js, Express, PostgreSQL, OpenAI API, JWT, Bcrypt

**Hosted on:** Railway
>>>>>>> origin/main
