const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class LearningSystem {
  constructor() {
    this.learningDataPath = path.join(process.cwd(), 'data', 'learning.json');
    this.learningData = {
      applications: [],
      successfulPatterns: [],
      userEdits: [],
      preferences: {}
    };
  }

  async loadLearningData() {
    try {
      const data = await fs.readFile(this.learningDataPath, 'utf8');
      this.learningData = JSON.parse(data);
    } catch (error) {
      // File doesn't exist yet, use defaults
      logger.info('No existing learning data, starting fresh');
    }
  }

  async saveLearningData() {
    try {
      await fs.mkdir(path.dirname(this.learningDataPath), { recursive: true });
      await fs.writeFile(
        this.learningDataPath,
        JSON.stringify(this.learningData, null, 2)
      );
    } catch (error) {
      logger.error('Error saving learning data:', error);
    }
  }

  async recordApplication(application) {
    await this.loadLearningData();

    this.learningData.applications.push({
      jobTitle: application.job.title,
      company: application.job.company,
      coverLetter: application.coverLetter,
      screeningAnswers: application.screeningAnswers,
      timestamp: new Date().toISOString()
    });

    await this.saveLearningData();
    logger.info('Application recorded for learning');
  }

  async recordUserEdit(original, edited, context) {
    await this.loadLearningData();

    const edit = {
      original,
      edited,
      context,
      timestamp: new Date().toISOString()
    };

    this.learningData.userEdits.push(edit);

    // Analyze the edit to extract patterns
    await this.analyzeEdit(edit);

    await this.saveLearningData();
    logger.info('User edit recorded and analyzed');
  }

  async analyzeEdit(edit) {
    // Simple pattern extraction
    // In production, this could use ML to find patterns

    const patterns = {
      // Detect tone preferences
      tone: this.detectTone(edit.edited),

      // Detect length preferences
      lengthPreference: edit.edited.length > edit.original.length ? 'longer' : 'shorter',

      // Detect keyword additions
      addedKeywords: this.extractNewKeywords(edit.original, edit.edited)
    };

    this.learningData.successfulPatterns.push({
      ...patterns,
      context: edit.context,
      timestamp: edit.timestamp
    });
  }

  detectTone(text) {
    // Simple tone detection
    const lowerText = text.toLowerCase();

    if (lowerText.includes('passionate') || lowerText.includes('excited') || lowerText.includes('enthusiastic')) {
      return 'enthusiastic';
    }
    if (lowerText.includes('experienced') || lowerText.includes('proven') || lowerText.includes('accomplished')) {
      return 'confident';
    }
    return 'professional';
  }

  extractNewKeywords(original, edited) {
    const originalWords = new Set(original.toLowerCase().split(/\s+/));
    const editedWords = edited.toLowerCase().split(/\s+/);

    return editedWords.filter(word =>
      !originalWords.has(word) && word.length > 4
    );
  }

  async getPreferences() {
    await this.loadLearningData();

    // Aggregate learning data into preferences
    const preferences = {
      preferredTone: this.getMostCommonTone(),
      commonKeywords: this.getMostCommonKeywords(),
      averageLength: this.getAverageResponseLength()
    };

    return preferences;
  }

  getMostCommonTone() {
    const tones = this.learningData.successfulPatterns.map(p => p.tone);
    return this.mostCommon(tones) || 'professional';
  }

  getMostCommonKeywords() {
    const allKeywords = this.learningData.successfulPatterns
      .flatMap(p => p.addedKeywords || []);

    // Get top 10 most common keywords
    const counts = {};
    allKeywords.forEach(kw => {
      counts[kw] = (counts[kw] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kw]) => kw);
  }

  getAverageResponseLength() {
    const edits = this.learningData.userEdits;
    if (edits.length === 0) return 0;

    const totalLength = edits.reduce((sum, edit) => sum + edit.edited.length, 0);
    return Math.round(totalLength / edits.length);
  }

  mostCommon(arr) {
    if (arr.length === 0) return null;

    const counts = {};
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])[0][0];
  }
}

module.exports = LearningSystem;
