const epicService = require("../services/epicService");
const userService = require("../services/userService");
const { MESSAGES } = require("../config/constants");
const logger = require("../utils/logger");

class UserHandler {
    async handleStart(ctx) {
        try {
            const startMessage = `
🎮 <b>Selamat datang di Epic Free Games Bot!</b>

🆓 <b>Bot ini membantu Anda:</b>
 • 🎯 Mendapatkan game gratis Epic Games terbaru
 • 📅 Info game gratis yang akan datang
 • 🔄 Update otomatis saat ada game baru
 • 🖼️ Preview thumbnail game dengan detail

⚡️ <b>Mulai dengan:</b>
 • /epicfree - Cek game gratis saat ini
 • /upcoming - Game yang akan datang
 • /help - Lihat semua perintah

🎁 <b>Jangan sampai terlewat game gratis favorit Anda!</b>

💡 Saran fitur? Kirim ke @contactpixelme_bot`;

            await ctx.reply(startMessage, {
                parse_mode: "HTML", // ✅ CHANGED from Markdown to HTML
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🎮 Game Gratis Sekarang",
                                callback_data: "check_current"
                            },
                            {
                                text: "🔮 Game Upcoming",
                                callback_data: "check_upcoming"
                            }
                        ],
                        [
                            {
                                text: "🌐 Epic Games Store",
                                url: "https://store.epicgames.com/en-US/free-games"
                            }
                        ]
                    ]
                }
            });

            logger.info("User started bot", ctx.from.id);
        } catch (error) {
            logger.error("Error in start handler", ctx.from.id, {
                error: error.message,
                stack: error.stack
            });
            try {
                await ctx.reply(
                    "❌ Terjadi kesalahan saat memulai bot. Silakan coba lagi."
                );
            } catch (replyError) {
                logger.error("Failed to send error reply", ctx.from.id, {
                    error: replyError.message
                });
            }
        }
    }

   async handleHelp(ctx) {
    const helpMessage = `🎮 <b>Epic Free Games Bot - Panduan Lengkap</b>

🎯 <b>Perintah Utama:</b>
├ /epicfree - Game gratis Epic saat ini
├ /upcoming - Game gratis yang akan datang
├ /start - Tampilkan pesan selamat datang
└ /help - Panduan ini

🚀 <b>Fitur Unggulan:</b>
• 🔄 <b>Update Real-time</b> - Data langsung dari Epic Games
• 🖼️ <b>Preview Gambar</b> - Thumbnail dan detail game
• 📅 <b>Schedule Info</b> - Kapan game berakhir/mulai
• 🔗 <b>Quick Access</b> - Klik judul untuk langsung ke Epic Store
• ⚡️ <b>Fast Response</b> - Interface yang responsive

💡 <b>Tips Menggunakan Bot:</b>
• 📱 Gunakan /epicfree secara berkala untuk cek game terbaru
• 🗓️ Manfaatkan /upcoming untuk planning claim game
• 🎮 Klik langsung judul game untuk ke halaman Epic Store
• 📋 Gunakan tombol "Upcoming" dan "Refresh" untuk navigasi cepat

📊 <b>Contoh Penggunaan:</b>
1️⃣ Ketik /epicfree → Lihat game gratis saat ini
2️⃣ Klik judul game → Langsung ke Epic Store
3️⃣ Klaim game sebelum waktu berakhir
4️⃣ Gunakan /upcoming untuk lihat game selanjutnya

🎁 <b>Bot ini 100% gratis dan selalu update!</b>

Need help? Saran fitur? 💬 @contactpixelme_bot
🔄 Update terakhir: ${new Date().toLocaleDateString('id-ID')}`;

    try {
        await ctx.reply(helpMessage, {
            parse_mode: 'HTML', // ✅ CHANGED from Markdown to HTML
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🎮 Game Gratis Sekarang', callback_data: 'check_current' },
                        { text: '🔮 Game Upcoming', callback_data: 'check_upcoming' }
                    ],
                    [
                        { text: '🌐 Epic Games Store', url: 'https://store.epicgames.com/en-US/free-games' }
                    ],
                    [
                        { text: '💬 Saran Fitur', url: 'https://t.me/contactpixelme_bot' }
                    ]
                ]
            }
        });

        logger.info('User requested help', ctx.from.id);
    } catch (error) {
        logger.error('Error in help handler', ctx.from.id, {
            error: error.message
        });
        await ctx.reply('❌ Terjadi kesalahan saat menampilkan bantuan.');
    }
}


    async handleEpicFree(ctx) {
        let loadingMsg;
        try {
            loadingMsg = await ctx.reply(
                "🔍 Mengecek game gratis Epic Games..."
            );
            const data = await epicService.getFreeGames();
            const result = epicService.formatCurrentGamesMessage(
                data.currentGames
            );

            // Delete loading message
            try {
                await ctx.deleteMessage(loadingMsg.message_id);
            } catch (deleteError) {
                // Ignore delete errors
            } // ✅ FIXED missing closing brace

            // Send with photo if available
            if (result.photo) {
                await ctx.replyWithPhoto(result.photo, {
                    caption: result.caption,
                    ...result.extra
                });
            } else {
                await ctx.reply(result.text, result.extra);
            } // ✅ FIXED missing closing brace

            logger.info("User checked free games", ctx.from.id);
        } catch (error) {
            logger.error("Error in handleEpicFree", ctx.from.id, {
                error: error.message,
                stack: error.stack
            });

            try {
                if (loadingMsg) {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        `❌ Gagal mengambil data game gratis Epic Games.

            🔧 **Kemungkinan penyebab:**
            • Server Epic Games sedang bermasalah
            • Koneksi internet tidak stabil
            • API Epic Games sedang maintenance

            💡 **Solusi:**
            • Coba lagi dalam beberapa menit
            • Periksa status Epic Games di Twitter @EpicGames`,
                        {
                            parse_mode: "Markdown"
                        }
                    );
                } else {
                    await ctx.reply(
                        "❌ Terjadi kesalahan saat mengambil data game."
                    );
                } // ✅ FIXED missing closing brace
            } catch (editError) {
                logger.error("Error editing message", ctx.from.id, {
                    error: editError.message
                });
                try {
                    await ctx.reply(
                        "❌ Terjadi kesalahan saat mengambil data game."
                    );
                } catch (replyError) {
                    logger.error("Error sending reply", ctx.from.id, {
                        error: replyError.message
                    });
                } // ✅ FIXED missing closing brace
            } // ✅ FIXED missing closing brace
        } // ✅ FIXED missing closing brace
    } // ✅ FIXED missing closing brace

    async handleUpcoming(ctx) {
        let loadingMsg;
        try {
            loadingMsg = await ctx.reply(
                "🔮 Mengecek game gratis yang akan datang..."
            );
            const data = await epicService.getFreeGames();
            const result = epicService.formatUpcomingGamesMessage(
                data.upcomingGames
            );

            // Delete loading message
            try {
                await ctx.deleteMessage(loadingMsg.message_id);
            } catch (deleteError) {
                // Ignore delete errors
            } // ✅ FIXED missing closing brace

            // Send with photo if available
            if (result.photo) {
                await ctx.replyWithPhoto(result.photo, {
                    caption: result.caption,
                    ...result.extra
                });
            } else {
                await ctx.reply(result.text, result.extra);
            } // ✅ FIXED missing closing brace

            logger.info("User checked upcoming games", ctx.from.id);
        } catch (error) {
            logger.error("Error in handleUpcoming", ctx.from.id, {
                error: error.message,
                stack: error.stack
            });

            try {
                if (loadingMsg) {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        `
❌ Gagal mengambil data game yang akan datang.

🔧 **Kemungkinan penyebab:**
 • Server Epic Games sedang bermasalah
 • API sedang diperbaharui
 • Koneksi tidak stabil

💡 Coba lagi nanti atau gunakan /epicfree untuk game saat ini.`,
                        {
                            parse_mode: "Markdown"
                        }
                    );
                } else {
                    await ctx.reply(
                        "❌ Terjadi kesalahan saat mengambil data upcoming games."
                    );
                } // ✅ FIXED missing closing brace
            } catch (editError) {
                try {
                    await ctx.reply(
                        "❌ Terjadi kesalahan saat mengambil data upcoming games."
                    );
                } catch (replyError) {
                    logger.error("Error sending reply", ctx.from.id, {
                        error: replyError.message
                    });
                } // ✅ FIXED missing closing brace
            } // ✅ FIXED missing closing brace
        } // ✅ FIXED missing closing brace
    } // ✅ FIXED missing closing brace

    async handleCallbackQuery(ctx) {
        try {
            const action = ctx.callbackQuery.data;

            switch (action) {
                case "check_current":
                    await ctx.answerCbQuery("🔄 Memuat game saat ini...");
                    await this.handleEpicFree(ctx);
                    break;

                case "check_upcoming":
                    await ctx.answerCbQuery(
                        "🔄 Memuat game yang akan datang..."
                    );
                    await this.handleUpcoming(ctx);
                    break;

                case "refresh_current":
                    await ctx.answerCbQuery("🔄 Memperbarui data...");
                    // Clear cache untuk force refresh
                    epicService.cache.lastUpdate = null;
                    await this.handleEpicFree(ctx);
                    break;

                case "refresh_upcoming":
                    await ctx.answerCbQuery("🔄 Memperbarui data...");
                    // Clear cache untuk force refresh
                    epicService.cache.lastUpdate = null;
                    await this.handleUpcoming(ctx);
                    break;

                default:
                    if (action.startsWith("remind_")) {
                        await this.handleReminder(ctx, action);
                    } else {
                        await ctx.answerCbQuery("❓ Aksi tidak dikenali");
                    }
            } // ✅ FIXED missing closing brace
        } catch (error) {
            logger.error("Error in callback query handler", ctx.from.id, {
                error: error.message
            });
            try {
                await ctx.answerCbQuery("❌ Terjadi kesalahan");
            } catch (e) {
                // Ignore callback answer errors
            } // ✅ FIXED missing closing brace
        } // ✅ FIXED missing closing brace
    } // ✅ FIXED missing closing brace

    async handleReminder(ctx, action) {
        try {
            // Parse reminder data: remind_0_gameTitle
            const parts = action.split("_");
            const gameIndex = parseInt(parts[1]);
            const game = epicService.getUpcomingGameByIndex(gameIndex);

            if (!game) {
                await ctx.answerCbQuery("❌ Game tidak ditemukan");
                return;
            } // ✅ FIXED missing closing brace

            const startDate = new Date(game.startDate);
            const now = new Date();
            const timeUntil = Math.ceil(
                (startDate - now) / (1000 * 60 * 60 * 24)
            ); // days

            let message = `🔔 Siapkan reminder!\n\n`;
            message += `🎮 Game: ${this.escapeHtml(game.title)}\n`;
            message += `🚀 Mulai: ${startDate.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            })}\n`;

            if (timeUntil > 0) {
                message += `⏰ Tersisa: ${timeUntil} hari lagi\n`;
            } else {
                message += `⚡️ Sudah tersedia!\n`;
            } // ✅ FIXED missing closing brace

            message += `\n💡 Jangan lupa cek /epicfree saat game ini rilis!`;

            await ctx.answerCbQuery(`🔔 Siapkan reminder!`);

            // Send reminder confirmation
            await ctx.reply(message, {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🎮 Game Saat Ini",
                                callback_data: "check_current"
                            },
                            {
                                text: "🔄 Refresh",
                                callback_data: "refresh_upcoming"
                            }
                        ],
                        [
                            {
                                text: "🌐 Epic Games Store",
                                url: "https://store.epicgames.com/en-US/free-games"
                            }
                        ]
                    ] // ✅ FIXED missing closing bracket
                } // ✅ FIXED missing closing brace
            }); // ✅ FIXED missing closing parenthesis

            logger.info("User set reminder", ctx.from.id, {
                gameTitle: game.title
            });
        } catch (error) {
            logger.error("Error in handleReminder", ctx.from.id, {
                error: error.message
            });
            await ctx.answerCbQuery("❌ Gagal mengatur reminder");
        } // ✅ FIXED missing closing brace
    } // ✅ FIXED missing closing brace

    escapeHtml(text) {
        if (typeof text !== "string") return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;");
    } // ✅ FIXED missing closing brace

    async handleUnknownCommand(ctx) {
        const message = `
❓ Perintah tidak dikenali.

Gunakan /help untuk melihat perintah yang tersedia.

**Perintah utama:**
 • /epicfree - Game gratis saat ini
 • /upcoming - Game yang akan datang
 • /help - Bantuan lengkap`;

        try {
            await ctx.reply(message, {
                parse_mode: "Markdown"
            });
        } catch (error) {
            logger.error("Error in unknown command handler", ctx.from.id, {
                error: error.message
            });
        } // ✅ FIXED missing closing brace
    } // ✅ FIXED missing closing brace
} // ✅ FIXED missing closing brace for class

module.exports = new UserHandler();
