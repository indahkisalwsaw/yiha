const { LIMITS } = require('../config/constants');

class Validator {
    // Validate user ID
    validateUserId(userId) {
        if (!userId) {
            return { valid: false, error: 'User ID tidak boleh kosong' };
        }
        
        if (typeof userId === 'string') {
            userId = parseInt(userId);
        }
        
        if (isNaN(userId) || userId <= 0) {
            return { valid: false, error: 'User ID harus berupa angka positif' };
        }
        
        if (userId.toString().length < 6 || userId.toString().length > 12) {
            return { valid: false, error: 'User ID tidak valid (6-12 digit)' };
        }
        
        return { valid: true, userId };
    }

    // Validate message content
    validateMessage(message) {
        if (!message || typeof message !== 'string') {
            return { valid: false, error: 'Pesan tidak boleh kosong' };
        }
        
        const trimmed = message.trim();
        
        if (trimmed.length === 0) {
            return { valid: false, error: 'Pesan tidak boleh hanya spasi' };
        }
        
        if (trimmed.length > LIMITS.MAX_MESSAGE_LENGTH) {
            return { 
                valid: false, 
                error: `Pesan terlalu panjang (maksimal ${LIMITS.MAX_MESSAGE_LENGTH} karakter)` 
            };
        }
        
        return { valid: true, message: trimmed };
    }

    // Validate maintenance mode settings
    validateMaintenanceMode(mode, message = '') {
        if (mode !== '0' && mode !== '1') {
            return { valid: false, error: 'Mode harus 0 (off) atau 1 (on)' };
        }
        
        if (mode === '1' && message.length > 500) {
            return { valid: false, error: 'Pesan maintenance terlalu panjang (maksimal 500 karakter)' };
        }
        
        return { valid: true, mode: mode === '1', message };
    }

    // Validate auto check settings
    validateAutoCheck(mode, interval = 6) {
        if (mode !== 'true' && mode !== 'false') {
            return { valid: false, error: 'Mode harus true atau false' };
        }
        
        if (mode === 'true') {
            const parsedInterval = parseInt(interval);
            
            if (isNaN(parsedInterval) || parsedInterval < 1 || parsedInterval > 24) {
                return { valid: false, error: 'Interval harus antara 1-24 jam' };
            }
            
            return { valid: true, enabled: true, interval: parsedInterval };
        }
        
        return { valid: true, enabled: false };
    }

    // Validate group settings
    validateGroupSettings(mode) {
        if (mode !== '0' && mode !== '1') {
            return { valid: false, error: 'Mode grup harus 0 (disabled) atau 1 (enabled)' };
        }
        
        return { valid: true, enabled: mode === '1' };
    }

    // Validate ban reason
    validateBanReason(reason) {
        if (!reason || typeof reason !== 'string') {
            return { valid: true, reason: 'No reason provided' };
        }
        
        const trimmed = reason.trim();
        
        if (trimmed.length > 200) {
            return { valid: false, error: 'Alasan ban terlalu panjang (maksimal 200 karakter)' };
        }
        
        return { valid: true, reason: trimmed || 'No reason provided' };
    }

    // Validate command parameters
    validateCommandParams(params, requiredCount, optionalCount = 0) {
        if (!Array.isArray(params)) {
            return { valid: false, error: 'Parameter tidak valid' };
        }
        
        const totalParams = params.length;
        const minRequired = requiredCount;
        const maxAllowed = requiredCount + optionalCount;
        
        if (totalParams < minRequired) {
            return { 
                valid: false, 
                error: `Parameter kurang. Diperlukan minimal ${minRequired} parameter` 
            };
        }
        
        if (totalParams > maxAllowed) {
            return { 
                valid: false, 
                error: `Terlalu banyak parameter. Maksimal ${maxAllowed} parameter` 
            };
        }
        
        return { valid: true, params };
    }

    // Validate file upload
    validateFileUpload(file, allowedTypes = [], maxSize = 50 * 1024 * 1024) { // 50MB default
        if (!file) {
            return { valid: false, error: 'File tidak ditemukan' };
        }
        
        if (file.file_size > maxSize) {
            return { 
                valid: false, 
                error: `File terlalu besar (maksimal ${Math.round(maxSize / 1024 / 1024)}MB)` 
            };
        }
        
        if (allowedTypes.length > 0) {
            const fileExtension = file.file_name ? 
                file.file_name.split('.').pop().toLowerCase() : '';
            
            if (!allowedTypes.includes(fileExtension)) {
                return { 
                    valid: false, 
                    error: `Tipe file tidak didukung. Hanya: ${allowedTypes.join(', ')}` 
                };
            }
        }
        
        return { valid: true, file };
    }

    // Validate URL
    validateUrl(url) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL tidak boleh kosong' };
        }
        
        try {
            new URL(url);
            return { valid: true, url };
        } catch (error) {
            return { valid: false, error: 'Format URL tidak valid' };
        }
    }

    // Validate JSON data
    validateJson(jsonString) {
        if (!jsonString || typeof jsonString !== 'string') {
            return { valid: false, error: 'Data JSON tidak boleh kosong' };
        }
        
        try {
            const parsed = JSON.parse(jsonString);
            return { valid: true, data: parsed };
        } catch (error) {
            return { valid: false, error: 'Format JSON tidak valid' };
        }
    }

    // Sanitize input for security
    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }
        
        return input
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/data:/gi, '') // Remove data: protocol
            .trim();
    }

    // Validate cron expression (basic)
    validateCronExpression(expression) {
        if (!expression || typeof expression !== 'string') {
            return { valid: false, error: 'Cron expression tidak boleh kosong' };
        }
        
        const parts = expression.trim().split(' ');
        
        if (parts.length !== 5 && parts.length !== 6) {
            return { valid: false, error: 'Cron expression harus memiliki 5 atau 6 bagian' };
        }
        
        return { valid: true, expression };
    }
}

module.exports = new Validator();
