const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

class Helpers {
    // Format numbers with thousand separators
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // Format bytes to human readable
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Format duration in milliseconds to human readable
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} hari ${hours % 24} jam`;
        } else if (hours > 0) {
            return `${hours} jam ${minutes % 60} menit`;
        } else if (minutes > 0) {
            return `${minutes} menit ${seconds % 60} detik`;
        } else {
            return `${seconds} detik`;
        }
    }

    // Format date to Indonesian locale
    formatDate(date, includeTime = true) {
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Jakarta'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.second = '2-digit';
        }
        
        return new Date(date).toLocaleDateString('id-ID', options);
    }

    // Generate random string
    generateRandomString(length = 10) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return result;
    }

    // Sleep/delay function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Retry function with exponential backoff
    async retry(fn, maxAttempts = 3, baseDelay = 1000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw error;
                }
                
                const delay = baseDelay * Math.pow(2, attempt - 1);
                logger.warn(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`, null, { error: error.message });
                await this.sleep(delay);
            }
        }
    }

    // Chunk array into smaller arrays
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    // Escape special characters for Markdown
    escapeMarkdown(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    }

    // Escape special characters for HTML
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Truncate text with ellipsis
    truncateText(text, maxLength, ellipsis = '...') {
        if (typeof text !== 'string') return text;
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - ellipsis.length) + ellipsis;
    }

    // Deep clone object
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // Check if file exists and is readable
    async isFileAccessible(filePath) {
        try {
            await fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }

    // Get file size
    async getFileSize(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch {
            return 0;
        }
    }

    // Create backup of file
    async createBackup(filePath, backupDir = null) {
        try {
            if (!await this.isFileAccessible(filePath)) {
                throw new Error('File not accessible');
            }
            
            const fileName = path.basename(filePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${fileName}.backup.${timestamp}`;
            
            const targetDir = backupDir || path.dirname(filePath);
            const backupPath = path.join(targetDir, backupFileName);
            
            await fs.copy(filePath, backupPath);
            return backupPath;
        } catch (error) {
            logger.error('Failed to create backup', null, { filePath, error: error.message });
            throw error;
        }
    }

    // Parse command arguments
    parseCommand(text) {
        const parts = text.trim().split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        return { command, args, fullText: text };
    }

    // Generate progress bar
    generateProgressBar(current, total, length = 20) {
        const percent = Math.round((current / total) * 100);
        const filled = Math.round((length * current) / total);
        const empty = length - filled;
        
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        return `${bar} ${percent}%`;
    }

    // Calculate percentage
    calculatePercentage(value, total, decimals = 1) {
        if (total === 0) return 0;
        return parseFloat(((value / total) * 100).toFixed(decimals));
    }

    // Validate and parse JSON safely
    safeJsonParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch {
            return defaultValue;
        }
    }

    // Remove sensitive data from object for logging
    sanitizeForLogging(obj) {
        const sensitive = ['token', 'password', 'secret', 'key', 'auth'];
        const sanitized = this.deepClone(obj);
        
        const sanitizeRecursive = (item) => {
            if (typeof item === 'object' && item !== null) {
                for (const [key, value] of Object.entries(item)) {
                    if (sensitive.some(s => key.toLowerCase().includes(s))) {
                        item[key] = '[REDACTED]';
                    } else if (typeof value === 'object') {
                        sanitizeRecursive(value);
                    }
                }
            }
        };
        
        sanitizeRecursive(sanitized);
        return sanitized;
    }

    // Generate file hash (simple)
    generateFileHash(content) {
        let hash = 0;
        if (content.length === 0) return hash.toString();
        
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(36);
    }

    // Check if value is empty
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        if (Array.isArray(value) && value.length === 0) return true;
        if (typeof value === 'object' && Object.keys(value).length === 0) return true;
        return false;
    }

    // Get memory usage
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: this.formatBytes(usage.rss),
            heapTotal: this.formatBytes(usage.heapTotal),
            heapUsed: this.formatBytes(usage.heapUsed),
            external: this.formatBytes(usage.external)
        };
    }

    // Get system uptime
    getUptime() {
        return this.formatDuration(process.uptime() * 1000);
    }
}

module.exports = new Helpers();
