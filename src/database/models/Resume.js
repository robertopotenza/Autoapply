const db = require('../db');

class Resume {
    static async create({ candidateId, originalFilename, secureFilename, filePath }) {
        const result = await db.query(
            `INSERT INTO resumes (candidate_id, original_filename, secure_filename, file_path)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [candidateId, originalFilename, secureFilename, filePath]
        );
        return result.rows[0];
    }

    static async findById(resumeId) {
        const result = await db.query(
            `SELECT * FROM resumes WHERE resume_id = $1`,
            [resumeId]
        );
        return result.rows[0];
    }

    static async findByCandidate(candidateId) {
        const result = await db.query(
            `SELECT * FROM resumes WHERE candidate_id = $1 ORDER BY upload_timestamp DESC`,
            [candidateId]
        );
        return result.rows;
    }
}

module.exports = Resume;