const path = require('path');
const fs = require('fs');
const db = require('../src/database/db');

const UPLOAD_DIR = path.join(__dirname, '../uploads/resumes');

async function getAllResumeFiles() {
    return fs.readdirSync(UPLOAD_DIR).filter(f => f.match(/\.(pdf|docx?|DOCX?)$/));
}

async function getAllDbFiles() {
    const result = await db.query('SELECT secure_filename FROM resumes');
    return result.rows.map(r => r.secure_filename);
}

async function cleanupOrphanedFiles() {
    const diskFiles = await getAllResumeFiles();
    const dbFiles = await getAllDbFiles();
    const orphaned = diskFiles.filter(f => !dbFiles.includes(f));
    if (orphaned.length === 0) {
        console.log('No orphaned resume files found.');
        return;
    }
    console.log(`Found ${orphaned.length} orphaned files. Removing...`);
    orphaned.forEach(f => {
        try {
            fs.unlinkSync(path.join(UPLOAD_DIR, f));
            console.log(`Deleted: ${f}`);
        } catch (err) {
            console.error(`Failed to delete ${f}:`, err);
        }
    });
}

cleanupOrphanedFiles().then(() => process.exit(0));