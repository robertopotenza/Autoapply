# Automated Job Applications (Auto-Apply)

An intelligent AI-powered system that automates job applications by scanning company career sites and submitting applications based on your criteria.

## Features

### 1. Automated Job Scanning
- Continuously scans official company career sites every ~2 hours
- Matches jobs against your configured criteria:
  - Job titles
  - Keywords
  - Locations
  - Seniority levels
  - Exclusion filters

### 2. Intelligent Application Submission
- Uses your uploaded resume(s)
- Leverages your profile information (education, work history, skills, certifications)
- Applies pre-configured answers to screening questions
- Generates AI-powered customized content (answers, statements, cover letters)

### 3. Automation Modes
- **Full Auto-Apply**: System applies immediately without review
- **Review First**: AI drafts application and waits for your approval

### 4. Adaptive Learning
- Generates screening question answers based on your resume and prior applications
- Learns from your edits and improvements
- Continuously improves personalization and accuracy
- Adapts to match your voice and style

## Getting Started

```bash
# Install dependencies
npm install

# Configure your job criteria
cp config.example.json config.json
# Edit config.json with your preferences

# Run the application
npm start
```

## Configuration

Edit `config.json` to set:
- Target job titles and keywords
- Preferred locations
- Seniority levels
- Companies to include/exclude
- Automation mode (auto-apply or review-first)

## License

MIT
