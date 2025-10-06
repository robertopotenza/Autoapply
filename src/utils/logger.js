/**
 * Centralized logging utility for Apply Autonomously platform
 * Provides structured info/error logging with file persistence and rotation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_ROOT = path.resolve(__dirname, '../../logs');
const INFO_LOG_PATH = path.join(LOG_ROOT, 'info.log');
const ERROR_LOG_PATH = path.join(LOG_ROOT, 'errors.log');
const ARCHIVE_DIR = path.join(LOG_ROOT, 'archive');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ROTATION_THRESHOLD_DAYS = 7;

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function ensureLogFiles() {
    ensureDirectory(LOG_ROOT);
    ensureDirectory(ARCHIVE_DIR);

    if (!fs.existsSync(INFO_LOG_PATH)) {
        fs.writeFileSync(INFO_LOG_PATH, '', 'utf8');
    }

    if (!fs.existsSync(ERROR_LOG_PATH)) {
        fs.writeFileSync(ERROR_LOG_PATH, '', 'utf8');
    }
}

function rotateIfStale(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return;
        }

        const stats = fs.statSync(filePath);
        const ageDays = (Date.now() - stats.mtimeMs) / ONE_DAY_MS;

        if (ageDays >= ROTATION_THRESHOLD_DAYS) {
            const timestamp = new Date(stats.mtimeMs).toISOString().replace(/[:.]/g, '-');
            const archiveName = `${path.basename(filePath, '.log')}-${timestamp}.log`;
            const archivePath = path.join(ARCHIVE_DIR, archiveName);
            fs.renameSync(filePath, archivePath);
            fs.writeFileSync(filePath, '', 'utf8');
        }
    } catch (rotationError) {
        console.warn('Failed rotating log file', filePath, rotationError);
    }
}

function maskSensitive(value) {
    if (!value) {
        return value;
    }

    if (typeof value !== 'string') {
        return value;
    }

    if (value.includes('postgresql://') || value.includes('postgres://')) {
        const [protocol, rest] = value.split('//');
        if (!rest) {
            return value;
        }
        const redacted = rest.replace(/[^:@/]+(?=@)/, '****');
        return `${protocol}//${redacted}`;
    }

    return value;
}

function formatEntry(level, message, source = 'system', metadata = {}) {
    const payload = {
        timestamp: new Date().toISOString(),
        level,
        source,
        message,
        metadata
    };

    if (payload.metadata && payload.metadata.env) {
        payload.metadata.env = Object.fromEntries(
            Object.entries(payload.metadata.env).map(([key, val]) => [key, maskSensitive(val)])
        );
    }

    return JSON.stringify(payload) + os.EOL;
}

function appendLog(filePath, entry) {
    try {
        rotateIfStale(filePath);
        fs.appendFileSync(filePath, entry, 'utf8');
    } catch (writeError) {
        console.error('Failed writing log entry', writeError);
    }
}

function logInfo(message, source = 'system', metadata = {}) {
    ensureLogFiles();
    const entry = formatEntry('info', message, source, metadata);
    appendLog(INFO_LOG_PATH, entry);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[INFO] [${source}] ${message}`);
    }
}

function logWarn(message, source = 'system', metadata = {}) {
    ensureLogFiles();
    const entry = formatEntry('warn', message, source, metadata);
    appendLog(INFO_LOG_PATH, entry);
    if (process.env.NODE_ENV !== 'production') {
        console.warn(`[WARN] [${source}] ${message}`);
    }
}

function serializeError(error) {
    if (!error) {
        return { message: 'Unknown error' };
    }

    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack
        };
    }

    if (typeof error === 'object') {
        return {
            message: error.message || JSON.stringify(error),
            stack: error.stack || undefined
        };
    }

    return {
        message: String(error)
    };
}

function logError(error, source = 'system', metadata = {}) {
    ensureLogFiles();
    const serialized = serializeError(error);
    const entry = formatEntry('error', serialized.message, source, {
        ...metadata,
        stack: serialized.stack,
        env: {
            NODE_ENV: process.env.NODE_ENV,
            RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
            DATABASE_URL: maskSensitive(process.env.DATABASE_URL)
        }
    });
    appendLog(ERROR_LOG_PATH, entry);
    console.error(`[ERROR] [${source}] ${serialized.message}`);
    if (serialized.stack) {
        console.error(serialized.stack);
    }
}

function logDebug(message, source = 'system', metadata = {}) {
    if (process.env.DEBUG !== 'true' && process.env.NODE_ENV === 'production') {
        return;
    }
    ensureLogFiles();
    const entry = formatEntry('debug', message, source, metadata);
    appendLog(INFO_LOG_PATH, entry);
    console.debug(`[DEBUG] [${source}] ${message}`);
}

function getRecentLogs(limit = 50) {
    ensureLogFiles();
    const files = [INFO_LOG_PATH, ERROR_LOG_PATH];
    const entries = [];

    files.forEach((filePath) => {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.trim().split(/\r?\n/).filter(Boolean);
            const recent = lines.slice(-limit).map((line) => {
                try {
                    return JSON.parse(line);
                } catch (parseError) {
                    return { raw: line };
                }
            });
            entries.push(...recent);
        } catch (readError) {
            console.warn('Failed reading log file', filePath, readError);
        }
    });

    return entries
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, limit);
}

class Logger {
    constructor(source = 'system') {
        this.source = source;
    }

    info(message, metadata) {
        logInfo(message, this.source, metadata);
    }

    warn(message, metadata) {
        logWarn(message, this.source, metadata);
    }

    error(error, metadata) {
        logError(error, this.source, metadata);
    }

    debug(message, metadata) {
        logDebug(message, this.source, metadata);
    }

    logError(error, metadata) {
        logError(error, this.source, metadata);
    }
}

function createLogger(source) {
    return new Logger(source);
}

ensureLogFiles();

module.exports = {
    logInfo,
    logError,
    logWarn,
    logDebug,
    getRecentLogs,
    createLogger,
    Logger,
    INFO_LOG_PATH,
    ERROR_LOG_PATH,
    LOG_ROOT
};
