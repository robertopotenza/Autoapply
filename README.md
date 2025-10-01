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
