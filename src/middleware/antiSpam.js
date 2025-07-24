const logger = require('../utils/logger');
const { LIMITS } = require('../config/constants');

class AntiSpamMiddleware {
    constructor() {
        this.userMessages = new Map();
        this.userWarnings = new Map();
        this.blockedUsers = new Set();
        
        // Clean old records every 5 minutes
        setInterval(() => {
            this.cleanOldRecords();
        }, 5 * 60 * 1000);
    }

    middleware() {
        return (ctx, next) => {
            const userId = ctx.from.id;
            const now = Date.now();
            
            // Check if user is temporarily blocked
            if (this.blockedUsers.has(userId)) {
                logger.warn('Blocked user tried to send message', userId);
                return;
            }

            // Initialize user data if not exists
            if (!this.userMessages.has(userId)) {
                this.userMessages.set(userId, []);
                this.userWarnings.set(userId, 0);
            }

            const userMsgData = this.userMessages.get(userId);
            const userWarnings = this.userWarnings.get(userId);
            
            // Add current message timestamp
            userMsgData.push(now);
            
            // Remove messages older than 1 minute
            const oneMinuteAgo = now - 60000;
            const recentMessages = userMsgData.filter(timestamp => timestamp > oneMinuteAgo);
            this.userMessages.set(userId, recentMessages);
            
            // Check rate limit
            if (recentMessages.length > LIMITS.RATE_LIMIT) {
                const newWarnings = userWarnings + 1;
                this.userWarnings.set(userId, newWarnings);
                
                logger.warn('Rate limit exceeded', userId, { 
                    messagesInMinute: recentMessages.length,
                    warnings: newWarnings 
                });
                
                if (newWarnings >= 3) {
                    // Temporary block for 10 minutes
                    this.blockUser(userId, 10 * 60 * 1000);
                    ctx.reply('🚫 Anda telah diblokir sementara karena spam. Coba lagi dalam 10 menit.');
                    return;
                } else {
                    ctx.reply(`⚠️ Peringatan ${newWarnings}/3: Jangan spam! Kurangi kecepatan pesan Anda.`);
                    return;
                }
            }
            
            // Check for command spam
            if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
                if (this.isCommandSpam(userId, now)) {
                    ctx.reply('⏳ Tunggu sebentar sebelum menggunakan command lagi.');
                    return;
                }
            }
            
            return next();
        };
    }

    isCommandSpam(userId, now) {
        const userMsgData = this.userMessages.get(userId) || [];
        const lastFiveMessages = userMsgData.slice(-5);
        
        // If last 5 messages were within 10 seconds, it's spam
        if (lastFiveMessages.length >= 5) {
            const oldestRecentMsg = lastFiveMessages[0];
            return (now - oldestRecentMsg) < 10000; // 10 seconds
        }
        
        return false;
    }

    blockUser(userId, duration) {
        this.blockedUsers.add(userId);
        
        setTimeout(() => {
            this.blockedUsers.delete(userId);
            this.userWarnings.set(userId, 0); // Reset warnings
            logger.info('User unblocked from spam protection', userId);
        }, duration);
        
        logger.warn('User temporarily blocked for spam', userId, { duration });
    }

    cleanOldRecords() {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        
        for (const [userId, messages] of this.userMessages.entries()) {
            const recentMessages = messages.filter(timestamp => timestamp > fiveMinutesAgo);
            
            if (recentMessages.length === 0) {
                this.userMessages.delete(userId);
                this.userWarnings.delete(userId);
            } else {
                this.userMessages.set(userId, recentMessages);
            }
        }
        
        logger.info('Anti-spam records cleaned', null, { 
            activeUsers: this.userMessages.size,
            blockedUsers: this.blockedUsers.size 
        });
    }

    getUserStats(userId) {
        return {
            messagesInLastMinute: (this.userMessages.get(userId) || []).length,
            warnings: this.userWarnings.get(userId) || 0,
            isBlocked: this.blockedUsers.has(userId)
        };
    }

    resetUserWarnings(userId) {
        this.userWarnings.set(userId, 0);
        this.blockedUsers.delete(userId);
        logger.admin('User warnings reset', null, { targetUser: userId });
    }

    getGlobalStats() {
        return {
            totalActiveUsers: this.userMessages.size,
            totalBlockedUsers: this.blockedUsers.size,
            totalUsersWithWarnings: Array.from(this.userWarnings.values()).filter(w => w > 0).length
        };
    }
}

module.exports = new AntiSpamMiddleware();
