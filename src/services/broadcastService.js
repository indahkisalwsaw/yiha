const userService = require('./userService');
const logger = require('../utils/logger');

class BroadcastService {
    constructor() {
        this.isRunning = false;
        this.stats = {
            total: 0,
            sent: 0,
            failed: 0,
            blocked: 0
        };
    }

    async broadcast(telegram, message, adminId, options = {}) {
        if (this.isRunning) {
            throw new Error('Broadcast sedang berjalan');
        }

        this.isRunning = true;
        this.resetStats();

        try {
            const users = userService.getAllUsers();
            const userIds = Object.keys(users).filter(id => !userService.isBanned(id));
            
            this.stats.total = userIds.length;
            logger.admin('Broadcast started', adminId, { totalUsers: this.stats.total });

            // Send progress message to admin
            const progressMsg = await telegram.sendMessage(
                adminId, 
                `📡 Memulai broadcast ke ${this.stats.total} pengguna...`
            );

            for (let i = 0; i < userIds.length; i++) {
                const userId = userIds[i];
                const user = users[userId];

                try {
                    if (options.photo) {
                        // Send photo with caption
                        await telegram.sendPhoto(user.chatId, options.photo, {
                            caption: message,
                            parse_mode: options.parse_mode || 'HTML'
                        });
                    } else {
                        // Send text message
                        await telegram.sendMessage(user.chatId, message, {
                            parse_mode: options.parse_mode || 'HTML',
                            disable_web_page_preview: true
                        });
                    }
                    
                    this.stats.sent++;

                } catch (error) {
                    this.stats.failed++;
                    
                    if (error.code === 403) {
                        // User blocked the bot
                        this.stats.blocked++;
                        userService.markUserBlocked(userId);
                        logger.warn('User blocked bot during broadcast', null, { userId });
                    } else {
                        logger.error('Broadcast error for user', null, { userId, error: error.message });
                    }
                }

                // Update progress every 50 users
                if ((i + 1) % 50 === 0) {
                    try {
                        await telegram.editMessageText(
                            adminId,
                            progressMsg.message_id,
                            null,
                            this.getProgressMessage()
                        );
                    } catch (e) {
                        // Ignore edit errors
                    }
                }

                // Delay to avoid rate limits
                await this.delay(100);
            }

            // Final update
            await telegram.editMessageText(
                adminId,
                progressMsg.message_id,
                null,
                this.getFinalMessage()
            );

            logger.admin('Broadcast completed', adminId, this.stats);
            return this.stats;

        } finally {
            this.isRunning = false;
        }
    }

    resetStats() {
        this.stats = {
            total: 0,
            sent: 0,
            failed: 0,
            blocked: 0
        };
    }

    getProgressMessage() {
        const progress = Math.round((this.stats.sent + this.stats.failed) / this.stats.total * 100);
        return `📡 *Broadcast Progress*\n\n` +
               `📊 Progress: ${progress}%\n` +
               `✅ Terkirim: ${this.stats.sent}\n` +
               `❌ Gagal: ${this.stats.failed}\n` +
               `🚫 Diblokir: ${this.stats.blocked}\n` +
               `📈 Total: ${this.stats.total}`;
    }

    getFinalMessage() {
        return `✅ *Broadcast Selesai!*\n\n` +
               `📊 *Statistik:*\n` +
               `✅ Berhasil: ${this.stats.sent}\n` +
               `❌ Gagal: ${this.stats.failed}\n` +
               `🚫 Diblokir: ${this.stats.blocked}\n` +
               `📈 Total: ${this.stats.total}\n\n` +
               `⚡️ Tingkat keberhasilan: ${Math.round(this.stats.sent / this.stats.total * 100)}%`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isCurrentlyRunning() {
        return this.isRunning;
    }
}

module.exports = new BroadcastService();
