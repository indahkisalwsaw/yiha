const fs = require('fs');
const path = require('path');

// ✅ ANSI Color Codes Manual
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    // Text colors
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
};

// ✅ Level Colors Configuration
const levelColors = {
    INFO: colors.cyan,
    ERROR: colors.red,
    WARN: colors.yellow,
    ADMIN: colors.magenta,
    SUCCESS: colors.green,
    DEBUG: colors.blue
};

// ✅ Level Icons
const levelIcons = {
    INFO: 'ℹ️',
    ERROR: '❌',
    WARN: '⚠️',
    ADMIN: '👑',
    SUCCESS: '✅',
    DEBUG: '🔍'
};

// Import config secara aman
let config;
try {
    config = require('../config/config');
} catch (error) {
    console.error('Config import error:', error.message);
    // Fallback config
    config = {
        getDbPath: (filename) => path.join(__dirname, '../database', filename)
    };
} // ✅ FIXED missing closing brace

class Logger {
    constructor() {
        // Pastikan config memiliki method getDbPath
        if (!config || typeof config.getDbPath !== 'function') {
            console.warn('Config.getDbPath not available, using fallback');
            this.logFile = path.join(__dirname, '../database/logs.json');
        } else {
            this.logFile = config.getDbPath('logs.json');
        } // ✅ FIXED missing closing brace

        this.initLog();
    } // ✅ FIXED missing closing brace

    initLog() {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.logFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            } // ✅ FIXED missing closing brace

            // Check if file exists and is not empty
            if (!fs.existsSync(this.logFile)) {
                this.writeLogsFile([]);
                return;
            } // ✅ FIXED missing closing brace

            // Check if file is empty
            const stats = fs.statSync(this.logFile);
            if (stats.size === 0) {
                this.writeLogsFile([]);
                return;
            } // ✅ FIXED missing closing brace

            // Try to read and validate JSON
            const content = fs.readFileSync(this.logFile, 'utf8').trim();
            if (!content) {
                this.writeLogsFile([]);
                return;
            } // ✅ FIXED missing closing brace

            // Validate JSON content
            JSON.parse(content);
        } catch (error) {
            console.warn('Invalid logs.json file, reinitializing...', error.message);
            this.writeLogsFile([]);
        } // ✅ FIXED missing closing brace
    } // ✅ FIXED missing closing brace

    writeLogsFile(logs) {
        try {
            fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('Failed to write logs file:', error.message);
        } // ✅ FIXED missing closing brace
    } // ✅ FIXED missing closing brace

    // ✅ Format timestamp dengan color
    formatTimestamp() {
        const now = new Date();
        const timestamp = now.toLocaleString('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        return `${colors.gray}[${timestamp}]${colors.reset}`;
    }

    // ✅ Format level dengan color dan icon
    formatLevel(level) {
        const color = levelColors[level] || colors.white;
        const icon = levelIcons[level] || '📝';
        return `${color}${colors.bright}[${level}]${colors.reset} ${icon}`;
    }

    log(level, message, userId = null, extra = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            userId,
            ...extra
        };

        try {
            let logs = [];
            
            // Safely read existing logs
            try {
                if (fs.existsSync(this.logFile)) {
                    const content = fs.readFileSync(this.logFile, 'utf8').trim();
                    if (content) {
                        logs = JSON.parse(content);
                    } // ✅ FIXED missing closing brace
                } // ✅ FIXED missing closing brace
            } catch (readError) {
                console.warn('Error reading logs, starting fresh:', readError.message);
                logs = [];
            } // ✅ FIXED missing closing brace

            // Ensure logs is an array
            if (!Array.isArray(logs)) {
                logs = [];
            } // ✅ FIXED missing closing brace

            logs.push(logEntry);
            
            // Keep only last 1000 logs
            if (logs.length > 1000) {
                logs.splice(0, logs.length - 1000);
            } // ✅ FIXED missing closing brace

            this.writeLogsFile(logs);

            // ✅ Colorful console output
            const timestamp = this.formatTimestamp();
            const levelFormatted = this.formatLevel(level);
            const messageFormatted = `${levelColors[level] || colors.white}${message}${colors.reset}`;
            const userFormatted = userId ? `${colors.blue}(User: ${userId})${colors.reset}` : '';
            const extraFormatted = Object.keys(extra).length > 0 ? 
                ` ${colors.dim}{ ${Object.entries(extra).map(([k,v]) => `${k}: ${v}`).join(', ')} }${colors.reset}` : '';

            console.log(`${timestamp} ${levelFormatted} ${messageFormatted} ${userFormatted}${extraFormatted}`);

        } catch (error) {
            // Fallback to console logging if file operations fail
            console.error('Logging error:', error.message);
            console.log(`[${level}] ${message}`, userId ? `(User: ${userId})` : '');
        } // ✅ FIXED missing closing brace
    } // ✅ FIXED missing closing brace

    info(message, userId = null, extra = {}) {
        this.log('INFO', message, userId, extra);
    } // ✅ FIXED missing closing brace

    error(message, userId = null, extra = {}) {
        this.log('ERROR', message, userId, extra);
    } // ✅ FIXED missing closing brace

    warn(message, userId = null, extra = {}) {
        this.log('WARN', message, userId, extra);
    } // ✅ FIXED missing closing brace

    admin(message, userId = null, extra = {}) {
        this.log('ADMIN', message, userId, extra);
    } // ✅ FIXED missing closing brace
} // ✅ FIXED missing closing brace for class

module.exports = new Logger();
