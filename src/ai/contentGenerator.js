const OpenAI = require('openai');
const logger = require('../utils/logger');

class AIContentGenerator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateCoverLetter(job, profile) {
    try {
      const prompt = `Generate a professional cover letter for the following job application:

Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}

Applicant Profile:
Name: ${profile.name}
Skills: ${profile.skills?.join(', ') || 'Not specified'}
Work History: ${JSON.stringify(profile.workHistory) || 'Not specified'}
Education: ${JSON.stringify(profile.education) || 'Not specified'}

Write a compelling, personalized cover letter that highlights relevant experience and skills. Keep it concise (3-4 paragraphs) and professional.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert career coach and writer who creates compelling, personalized cover letters.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return response.choices[0].message.content;
    } catch (error) {
      logger.error('Error generating cover letter:', error);
      return 'Unable to generate cover letter at this time.';
    }
  }

  async generateScreeningAnswers(job, profile, defaultAnswers) {
    try {
      // Common screening questions
      const questions = [
        'Why do you want to work for this company?',
        'What makes you a good fit for this role?',
        'Describe your relevant experience.',
        'What are your salary expectations?'
      ];

      const answers = {};

      for (const question of questions) {
        const prompt = `Answer the following job screening question professionally and concisely:

Question: ${question}

Job: ${job.title} at ${job.company}
Applicant Skills: ${profile.skills?.join(', ') || 'Not specified'}
Work History: ${JSON.stringify(profile.workHistory) || 'Not specified'}

Provide a brief, honest, and compelling answer (2-3 sentences).`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are helping a job applicant answer screening questions professionally and authentically.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 150
        });

        answers[question] = response.choices[0].message.content;
      }

      // Merge with default answers
      return { ...defaultAnswers, ...answers };
    } catch (error) {
      logger.error('Error generating screening answers:', error);
      return defaultAnswers;
    }
  }

  async improveAnswer(originalAnswer, feedback, context) {
    try {
      const prompt = `Improve the following answer based on user feedback:

Original Answer: ${originalAnswer}
User Feedback: ${feedback}
Context: ${context}

Generate an improved version that incorporates the feedback while maintaining professionalism.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You help improve job application responses based on user feedback.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      return response.choices[0].message.content;
    } catch (error) {
      logger.error('Error improving answer:', error);
      return originalAnswer;
    }
  }
}

module.exports = AIContentGenerator;
