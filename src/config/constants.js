const MESSAGES = {
    USER: {
        WELCOME: `🎮 **Selamat datang di Epic Free Games Bot!**

Bot ini membantu Anda mendapatkan informasi game gratis Epic Games terbaru.

Gunakan /help untuk melihat perintah yang tersedia.`,
        
        MAINTENANCE: '🔧 Bot sedang dalam maintenance. Silakan coba lagi nanti.',
        
        ERROR: '❌ Terjadi kesalahan. Silakan coba lagi atau hubungi admin.',
        
        NOT_RECOGNIZED: `❓ Perintah tidak dikenali.

Gunakan /help untuk melihat perintah yang tersedia.

**Perintah utama:**
• /epicfree - Game gratis saat ini
• /upcoming - Game yang akan datang
• /help - Bantuan lengkap`,

        BANNED: '🚫 Anda telah dibanned dari bot ini.',
        
        RATE_LIMIT: '⏳ Tunggu sebentar sebelum menggunakan perintah lagi.',

        HELP_FOOTER: 'Saran fitur? 💬 @contactpixelme_bot'
    },
    
    ADMIN: {
        UNAUTHORIZED: '🚫 Anda tidak memiliki akses administrator.',
        HELP_FOOTER: 'Admin Support: @contactpixelme_bot'
    },
    
    EPIC: {
        NO_GAMES: '😔 Tidak ada game gratis saat ini di Epic Games Store.\n\n💡 Coba lagi nanti atau gunakan /upcoming untuk melihat game yang akan datang.',
        
        NO_UPCOMING: '📅 Belum ada informasi game gratis yang akan datang.\n\n💡 Epic Games biasanya mengumumkan game gratis seminggu sebelumnya.',
        
        API_ERROR: '❌ Gagal mengambil data dari Epic Games. Silakan coba lagi nanti.',
        
        FOOTER: '⚡️ Data dari Epic Games Store'
    }
};

const LIMITS = {
    RATE_LIMIT: 2000, // 2 seconds
    BROADCAST_DELAY: 100, // 100ms delay between messages
    MAX_RETRIES: 3,
    CACHE_TIMEOUT: 5 * 60 * 1000, // 5 minutes
};

const REGEX = {
    COMMAND: /^\/\w+/,
    MENTION: /@\w+/g,
    URL: /(https?:\/\/[^\s]+)/g
};

module.exports = {
    MESSAGES,
    LIMITS,
    REGEX
};
