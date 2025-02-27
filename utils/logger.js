const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

class Logger {
    constructor(minLevel = 'INFO') {
        this.minLevel = LOG_LEVELS[minLevel] || LOG_LEVELS.INFO;
    }

    formatMessage(level, message) {
        return `[${level}] ${new Date().toISOString()}: ${message}`;
    }

    debug(message) {
        if (this.minLevel <= LOG_LEVELS.DEBUG) {
            console.log(this.formatMessage('DEBUG', message));
        }
    }

    info(message) {
        if (this.minLevel <= LOG_LEVELS.INFO) {
            console.log(this.formatMessage('INFO', message));
        }
    }

    warn(message) {
        if (this.minLevel <= LOG_LEVELS.WARN) {
            console.warn(this.formatMessage('WARN', message));
        }
    }

    error(message, error = null) {
        if (this.minLevel <= LOG_LEVELS.ERROR) {
            console.error(this.formatMessage('ERROR', message));
            if (error) console.error(error);
        }
    }
}

module.exports = new Logger(process.env.LOG_LEVEL);