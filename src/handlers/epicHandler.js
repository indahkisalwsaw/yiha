const epicService = require('../services/epicService');
const userService = require('../services/userService');
const logger = require('../utils/logger');
const validator = require('../utils/validator');

class EpicHandler {
    constructor() {
        this.cooldowns = new Map();
        this.COOLDOWN_TIME = 30000; // 30 seconds
    }

    async handleEpicFree(ctx) {
        try {
            // Check cooldown
            if (this.isOnCooldown(ctx.from.id)) {
                const remaining = this.getRemainingCooldown(ctx.from.id);
                return ctx.reply(`⏳ Tunggu ${Math.ceil(remaining / 1000)} detik sebelum mengecek lagi.`);
            }

            const loadingMsg = await ctx.reply('🔍 Mengecek game gratis Epic Games...');
            
            const data = await epicService.getFreeGames();
            
            if (!data.currentGames || data.currentGames.length === 0) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMsg.message_id,
                    null,
                    '😔 Tidak ada game gratis saat ini di Epic Games Store.'
                );
                return;
            }

            const message = this.formatCurrentGamesMessage(data.currentGames);
            
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                loadingMsg.message_id,
                null,
                message,
                { 
                    parse_mode: 'Markdown', 
                    disable_web_page_preview: true 
                }
            );

            // Set cooldown
            this.setCooldown(ctx.from.id);
            
            logger.info('User checked current free games', ctx.from.id);
            
        } catch (error) {
            logger.error('Error in handleEpicFree', ctx.from.id, { error: error.message });
            
            try {
                await ctx.reply('❌ Gagal mengambil data game gratis. Silakan coba lagi nanti.');
            } catch (e) {
                // Ignore reply errors
            }
        }
    }

    async handleUpcoming(ctx) {
        try {
            // Check cooldown
            if (this.isOnCooldown(ctx.from.id)) {
                const remaining = this.getRemainingCooldown(ctx.from.id);
                return ctx.reply(`⏳ Tunggu ${Math.ceil(remaining / 1000)} detik sebelum mengecek lagi.`);
            }

            const loadingMsg = await ctx.reply('🔮 Mengecek game gratis yang akan datang...');
            
            const data = await epicService.getFreeGames();
            
            if (!data.upcomingGames || data.upcomingGames.length === 0) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMsg.message_id,
                    null,
                    '📅 Belum ada informasi game gratis yang akan datang.'
                );
                return;
            }

            const message = this.formatUpcomingGamesMessage(data.upcomingGames);
            
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                loadingMsg.message_id,
                null,
                message,
                { 
                    parse_mode: 'Markdown', 
                    disable_web_page_preview: true 
                }
            );

            // Set cooldown
            this.setCooldown(ctx.from.id);
            
            logger.info('User checked upcoming games', ctx.from.id);
            
        } catch (error) {
            logger.error('Error in handleUpcoming', ctx.from.id, { error: error.message });
            
            try {
                await ctx.reply('❌ Gagal mengambil data game yang akan datang. Silakan coba lagi nanti.');
            } catch (e) {
                // Ignore reply errors
            }
        }
    }

    formatCurrentGamesMessage(games) {
        if (!games || games.length === 0) {
            return '😔 Tidak ada game gratis saat ini.';
        }

        let message = '🎮 *Game Gratis Epic Games Saat Ini:*\n\n';
        
        games.forEach((game, index) => {
            const endDate = new Date(game.endDate);
            const timeLeft = this.getTimeUntil(endDate);
            
            message += `${index + 1}. *${this.escapeMarkdown(game.title)}*\n`;
            message += `⏰ Berakhir: ${timeLeft}\n`;
            message += `💰 Harga Normal: ${game.originalPrice}\n`;
            message += `🔗 [Klaim Sekarang](${game.url})\n`;
            
            if (game.description && game.description !== 'No description available') {
                const shortDesc = game.description.length > 150 
                    ? game.description.substring(0, 150) + '...' 
                    : game.description;
                message += `📝 ${this.escapeMarkdown(shortDesc)}\n`;
            }
            message += '\n';
        });

        message += '⚡️ *Klaim sebelum berakhir!*';
        return message;
    }

    formatUpcomingGamesMessage(games) {
        if (!games || games.length === 0) {
            return '📅 Belum ada informasi game gratis yang akan datang.';
        }

        let message = '🔮 *Game Gratis Epic Games Yang Akan Datang:*\n\n';
        
        games.forEach((game, index) => {
            const startDate = new Date(game.startDate);
            const timeUntil = this.getTimeUntil(startDate);
            
            message += `${index + 1}. *${this.escapeMarkdown(game.title)}*\n`;
            message += `🚀 Mulai: ${timeUntil}\n`;
            message += `💰 Harga Normal: ${game.originalPrice}\n`;
            
            if (game.description && game.description !== 'No description available') {
                const shortDesc = game.description.length > 150 
                    ? game.description.substring(0, 150) + '...' 
                    : game.description;
                message += `📝 ${this.escapeMarkdown(shortDesc)}\n`;
            }
            message += '\n';
        });

        message += '⏰ *Siapkan reminder!*';
        return message;
    }

    getTimeUntil(targetDate) {
        const now = new Date();
        const diff = targetDate - now;
        
        if (diff <= 0) {
            return 'Sudah berlalu';
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return `${days} hari ${hours} jam`;
        } else if (hours > 0) {
            return `${hours} jam ${minutes} menit`;
        } else {
            return `${minutes} menit`;
        }
    }

    escapeMarkdown(text) {
        return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    }

    isOnCooldown(userId) {
        return this.cooldowns.has(userId) && 
               (Date.now() - this.cooldowns.get(userId)) < this.COOLDOWN_TIME;
    }

    setCooldown(userId) {
        this.cooldowns.set(userId, Date.now());
        
        // Clean old cooldowns
        setTimeout(() => {
            this.cooldowns.delete(userId);
        }, this.COOLDOWN_TIME);
    }

    getRemainingCooldown(userId) {
        const lastUsed = this.cooldowns.get(userId);
        if (!lastUsed) return 0;
        
        return this.COOLDOWN_TIME - (Date.now() - lastUsed);
    }
}

module.exports = new EpicHandler();
