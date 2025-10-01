const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  log(level, message, data = null) {
    const timestamp = this.getTimestamp();
    const logMessage = data
      ? `[${timestamp}] [${level}] ${message} ${JSON.stringify(data)}`
      : `[${timestamp}] [${level}] ${message}`;

    console.log(logMessage);

    // Write to file
    const logFile = path.join(
      this.logDir,
      `autoapply-${new Date().toISOString().split('T')[0]}.log`
    );
    fs.appendFileSync(logFile, logMessage + '\n');
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }

  debug(message, data) {
    this.log('DEBUG', message, data);
  }
}

module.exports = new Logger();
