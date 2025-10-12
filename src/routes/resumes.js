const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Resume = require('../database/models/Resume');
const { requireAuth } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/resumes');
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Secure filename: candidateId-timestamp.ext
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const candidateId = req.user?.user_id || 'anon';
        const ts = Date.now();
        cb(null, `${candidateId}_${ts}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_TYPES.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only PDF, DOC, DOCX allowed.'));
        }
        cb(null, true);
    }
});

// POST /api/resumes/upload
router.post('/upload', requireAuth, upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        const candidateId = req.user.user_id;
        const originalFilename = req.file.originalname;
        const secureFilename = req.file.filename;
        const filePath = req.file.path;
        const meta = await Resume.create({ candidateId, originalFilename, secureFilename, filePath });
        // Log upload
        console.log(`[UPLOAD] Resume uploaded for candidate ${candidateId}: ${secureFilename}`);
        res.status(201).json({ resume: meta });
    } catch (err) {
        console.error('[UPLOAD ERROR]', err);
        res.status(500).json({ error: 'Resume upload failed.' });
    }
});

// GET /api/resumes/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const resume = await Resume.findById(req.params.id);
        if (!resume) return res.status(404).json({ error: 'Resume not found.' });
        // Only allow owner or admin to download
        if (resume.candidate_id !== req.user.user_id && !req.user.is_admin) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        res.download(resume.file_path, resume.original_filename);
    } catch (err) {
        console.error('[DOWNLOAD ERROR]', err);
        res.status(500).json({ error: 'Resume download failed.' });
    }
});

module.exports = router;
