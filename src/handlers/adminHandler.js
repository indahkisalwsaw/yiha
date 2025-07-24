const userService = require('../services/userService');
const broadcastService = require('../services/broadcastService');
const maintenanceMiddleware = require('../middleware/maintenance');
const epicService = require('../services/epicService');
const logger = require('../utils/logger');
const { MESSAGES } = require('../config/constants');
const cron = require('node-cron');

// ✅ ADD MISSING IMPORTS
const fs = require('fs-extra');
const config = require('../config/config');
const groupService = require('../services/groupService');

class AdminHandler {
    constructor() {
        this.autoCheckJob = null;
    }

    async handleMaintenance(ctx) {
        const args = ctx.message.text.split(' ');
        const mode = args[1];
        const message = args.slice(2).join(' ');

        if (mode === '1') {
            const maintenanceMsg = message || MESSAGES.USER.MAINTENANCE;
            maintenanceMiddleware.updateSettings({
                maintenance: true,
                maintenanceMessage: maintenanceMsg
            });
            ctx.reply('🔧 Mode maintenance diaktifkan\n\nPesan: ' + maintenanceMsg);
            logger.admin('Maintenance mode enabled', ctx.from.id);
        } else if (mode === '0') {
            maintenanceMiddleware.updateSettings({ maintenance: false });
            ctx.reply('✅ Mode maintenance dinonaktifkan');
            logger.admin('Maintenance mode disabled', ctx.from.id);
        } else {
            ctx.reply('❌ Format: /mt 1 [pesan] atau /mt 0');
        }
    }

    async handleAutoCheck(ctx) {
        const args = ctx.message.text.split(' ');
        const mode = args[1];
        const interval = parseInt(args[2]) || 6;

        if (mode === 'true') {
            maintenanceMiddleware.updateSettings({
                autoCheck: true,
                autoCheckInterval: interval
            });

            if (this.autoCheckJob) {
                this.autoCheckJob.stop();
            }

            this.autoCheckJob = cron.schedule(`0 */${interval} * * *`, async () => {
                try {
                    const data = await epicService.getFreeGames();
                    if (data.currentGames && data.currentGames.length > 0) {
                        const result = epicService.formatCurrentGamesMessage(data.currentGames);
                        const message = result.text || result.caption;
                        await this.broadcastToUsers(ctx.telegram, message);
                    }
                } catch (error) {
                    logger.error('Auto check failed', null, { error: error.message });
                }
            });

            ctx.reply(`✅ Auto check diaktifkan dengan interval ${interval} jam`);
            logger.admin('Auto check enabled', ctx.from.id, { interval });
        } else if (mode === 'false') {
            maintenanceMiddleware.updateSettings({ autoCheck: false });

            if (this.autoCheckJob) {
                this.autoCheckJob.stop();
                this.autoCheckJob = null;
            }

            ctx.reply('❌ Auto check dinonaktifkan');
            logger.admin('Auto check disabled', ctx.from.id);
        } else {
            ctx.reply('❌ Format: /otomatiscek true [interval] atau /otomatiscek false');
        }
    }

    async handleSetGroup(ctx) {
        const args = ctx.message.text.split(' ');
        const mode = args[1];

        if (mode === '1') {
            maintenanceMiddleware.updateSettings({ groupsEnabled: true });
            ctx.reply('✅ Bot diaktifkan di grup');
        } else if (mode === '0') {
            maintenanceMiddleware.updateSettings({ groupsEnabled: false });
            ctx.reply('❌ Bot dinonaktifkan di grup');
        } else {
            ctx.reply('❌ Format: /setgroup 1 atau /setgroup 0');
        }
    }

    async handleListGroup(ctx) {
        try {
            const groups = groupService.getActiveGroups();
            const groupCount = Object.keys(groups).length;

            if (groupCount === 0) {
                return ctx.reply('📭 Bot tidak ada di grup manapun');
            }

            const groupsList = groupService.formatGroupsList(groups);
            await ctx.reply(groupsList, { parse_mode: 'HTML' });
            logger.admin('Admin checked groups list', ctx.from.id);
        } catch (error) {
            logger.error('Error in handleListGroup', ctx.from.id, { error: error.message });
            ctx.reply('❌ Gagal mengambil daftar grup');
        }
    }

    async handleListUsers(ctx) {
        const users = userService.getAllUsers();
        const userCount = Object.keys(users).length;

        if (userCount === 0) {
            return ctx.reply('📭 Tidak ada pengguna terdaftar');
        }

        let message = `👥 <b>Daftar Pengguna (${userCount}):</b>\n\n`;
        let count = 0;

        for (const [userId, user] of Object.entries(users)) {
            if (count >= 20) {
                message += `\n... dan ${userCount - 20} pengguna lainnya`;
                break;
            }

            const status = user.isBlocked ? '🚫' : '✅';
            const username = user.username ? `@${user.username}` : 'No username';
            message += `${status} ${user.firstName || 'Unknown'} (${username})\n`;
            message += `   ID: <code>${userId}</code>\n`;
            message += `   Join: ${new Date(user.joinDate).toLocaleDateString('id-ID')}\n\n`;
            count++;
        }

        ctx.reply(message, { parse_mode: 'HTML' });
    }

    async handleListBlocked(ctx) {
        const users = userService.getAllUsers();
        const blockedUsers = Object.entries(users).filter(([_, user]) => user.isBlocked);

        if (blockedUsers.length === 0) {
            return ctx.reply('✅ Tidak ada pengguna yang memblokir bot');
        }

        let message = `🚫 <b>Pengguna yang Memblokir Bot (${blockedUsers.length}):</b>\n\n`;

        blockedUsers.slice(0, 20).forEach(([userId, user]) => {
            const username = user.username ? `@${user.username}` : 'No username';
            message += `• ${user.firstName || 'Unknown'} (${username})\n`;
            message += `  ID: <code>${userId}</code>\n\n`;
        });

        if (blockedUsers.length > 20) {
            message += `... dan ${blockedUsers.length - 20} pengguna lainnya`;
        }

        ctx.reply(message, { parse_mode: 'HTML' });
    }

    async handleListBanned(ctx) {
        const bannedUsers = userService.getBannedUsers();
        const bannedCount = Object.keys(bannedUsers).length;

        if (bannedCount === 0) {
            return ctx.reply('✅ Tidak ada pengguna yang dibanned');
        }

        let message = `🚫 <b>Pengguna yang Dibanned (${bannedCount}):</b>\n\n`;

        Object.entries(bannedUsers).slice(0, 20).forEach(([userId, data]) => {
            message += `• ID: <code>${userId}</code>\n`;
            message += `  Alasan: ${data.reason}\n`;
            message += `  Tanggal: ${new Date(data.bannedAt).toLocaleDateString('id-ID')}\n\n`;
        });

        if (bannedCount > 20) {
            message += `... dan ${bannedCount - 20} pengguna lainnya`;
        }

        ctx.reply(message, { parse_mode: 'HTML' });
    }

    async handleBanUser(ctx) {
        const args = ctx.message.text.split(' ');
        const userId = args[1];
        const reason = args.slice(2).join(' ') || 'No reason provided';

        if (!userId) {
            return ctx.reply('❌ Format: /banuser [user_id] [alasan]');
        }

        if (userService.banUser(userId, reason, ctx.from.id)) {
            ctx.reply(`✅ Pengguna <code>${userId}</code> berhasil dibanned\nAlasan: ${reason}`, { parse_mode: 'HTML' });
        } else {
            ctx.reply('❌ Gagal mem-ban pengguna');
        }
    }

    async handleUnbanUser(ctx) {
        const args = ctx.message.text.split(' ');
        const userId = args[1];

        if (!userId) {
            return ctx.reply('❌ Format: /unbanuser [user_id]');
        }

        if (userService.unbanUser(userId, ctx.from.id)) {
            ctx.reply(`✅ Pengguna <code>${userId}</code> berhasil di-unban`, { parse_mode: 'HTML' });
        } else {
            ctx.reply('❌ Gagal meng-unban pengguna');
        }
    }

    async handleDeleteUser(ctx) {
        const args = ctx.message.text.split(' ');
        const userId = args[1];

        if (!userId) {
            return ctx.reply('❌ Format: /deleteuser [user_id]');
        }

        if (userService.deleteUser(userId, ctx.from.id)) {
            ctx.reply(`✅ Pengguna <code>${userId}</code> berhasil dihapus dari database`, { parse_mode: 'HTML' });
        } else {
            ctx.reply('❌ Gagal menghapus pengguna');
        }
    }

    async handleBroadcast(ctx) {
        const message = ctx.message.text.replace('/broadcast', '').trim();

        if (!message) {
            return ctx.reply(`❌ Format: /broadcast [pesan]

<b>Contoh:</b>
<code>/broadcast Hello &lt;b&gt;semua&lt;/b&gt;! Game baru tersedia.</code>

<b>Support HTML Tags:</b>
• &lt;b&gt;Bold&lt;/b&gt;
• &lt;i&gt;Italic&lt;/i&gt;
• &lt;code&gt;Code&lt;/code&gt;
• &lt;a href="URL"&gt;Link&lt;/a&gt;`, { parse_mode: 'HTML' });
        }

        if (broadcastService.isCurrentlyRunning()) {
            return ctx.reply('⏳ Broadcast sedang berjalan. Tunggu sampai selesai.');
        }

        try {
            await broadcastService.broadcast(ctx.telegram, message, ctx.from.id, {
                parse_mode: 'HTML'
            });
        } catch (error) {
            logger.error('Error in handleBroadcast', ctx.from.id, { error: error.message });
            ctx.reply(`❌ Error: ${error.message}`);
        }
    }

    async handleBroadcastImage(ctx) {
        if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.photo) {
            return ctx.reply(`❌ Reply ke gambar dengan caption /broadcastimg [caption]

<b>Cara penggunaan:</b>
1. Upload/forward gambar ke chat
2. Reply ke gambar tersebut dengan: <code>/broadcastimg Caption disini</code>

<b>Support HTML dalam caption:</b>
• &lt;b&gt;Bold&lt;/b&gt;
• &lt;i&gt;Italic&lt;/i&gt;
• &lt;a href="URL"&gt;Link&lt;/a&gt;`, { parse_mode: 'HTML' });
        }

        const caption = ctx.message.text.replace('/broadcastimg', '').trim();
        const photo = ctx.message.reply_to_message.photo[ctx.message.reply_to_message.photo.length - 1].file_id;

        if (broadcastService.isCurrentlyRunning()) {
            return ctx.reply('⏳ Broadcast sedang berjalan. Tunggu sampai selesai.');
        }

        try {
            await broadcastService.broadcast(ctx.telegram, caption, ctx.from.id, { 
                photo,
                parse_mode: 'HTML'
            });
        } catch (error) {
            ctx.reply(`❌ Error: ${error.message}`);
        }
    }

    async handleAddAdmin(ctx) {
        const args = ctx.message.text.split(' ');
        const userId = args[1];

        if (!userId) {
            return ctx.reply('❌ Format: /addadmin [user_id]');
        }

        if (userService.addAdmin(userId, ctx.from.id)) {
            ctx.reply(`✅ <code>${userId}</code> berhasil ditambahkan sebagai admin`, { parse_mode: 'HTML' });
        } else {
            ctx.reply('❌ Gagal menambahkan admin');
        }
    }

    async handleDeleteAdmin(ctx) {
        const args = ctx.message.text.split(' ');
        const userId = args[1];

        if (!userId) {
            return ctx.reply('❌ Format: /deleteadmin [user_id]');
        }

        if (userService.removeAdmin(userId, ctx.from.id)) {
            ctx.reply(`✅ <code>${userId}</code> berhasil dihapus dari admin`, { parse_mode: 'HTML' });
        } else {
            ctx.reply('❌ Gagal menghapus admin (mungkin main admin)');
        }
    }

    async handleListAdmin(ctx) {
        const admins = userService.getAdmins();
        const adminIds = Object.keys(admins);

        let message = `👑 <b>Daftar Admin (${adminIds.length}):</b>\n\n`;

        adminIds.forEach(adminId => {
            message += `• <code>${adminId}</code>\n`;
        });

        ctx.reply(message, { parse_mode: 'HTML' });
    }

    async handleStats(ctx) {
        try {
            const users = userService.getAllUsers();
            const bannedUsers = userService.getBannedUsers();
            const admins = userService.getAdmins();
            const settings = maintenanceMiddleware.getSettings();

            const totalUsers = Object.keys(users).length;
            const activeUsers = Object.values(users).filter(u => !u.isBlocked).length;
            const blockedUsers = Object.values(users).filter(u => u.isBlocked).length;
            const totalBanned = Object.keys(bannedUsers).length;
            const totalAdmins = Object.keys(admins).length;

            const message = `📊 <b>Statistik Bot Epic Games</b>

👥 <b>Pengguna:</b>
• Total: ${totalUsers}
• Aktif: ${activeUsers}
• Diblokir: ${blockedUsers}
• Dibanned: ${totalBanned}

👑 <b>Admin:</b> ${totalAdmins}

⚙️ <b>Status:</b>
• Maintenance: ${settings.maintenance ? '🔧 ON' : '✅ OFF'}
• Auto Check: ${settings.autoCheck ? '✅ ON' : '❌ OFF'}
• Groups: ${settings.groupsEnabled ? '✅ ON' : '❌ OFF'}

📅 <b>Update:</b> ${new Date().toLocaleString('id-ID')}`;

            ctx.reply(message, { parse_mode: 'HTML' });
            logger.admin('Admin checked stats', ctx.from.id);
        } catch (error) {
            logger.error('Error in handleStats', ctx.from.id, { error: error.message });
            ctx.reply('❌ Error mengambil statistik bot');
        }
    }

    async handleAlerts(ctx) {
        try {
            const logsFile = config.getDbPath('logs.json');

            if (!fs.existsSync(logsFile)) {
                return ctx.reply('📝 Belum ada log alerts. File logs.json tidak ditemukan.');
            }

            const logs = fs.readJsonSync(logsFile);
            const alerts = logs.filter(log =>
                log.level === 'WARN' &&
                log.message.includes('UNAUTHORIZED ADMIN ACCESS ATTEMPT')
            ).slice(-10);

            if (alerts.length === 0) {
                return ctx.reply('✅ Tidak ada alert unauthorized access dalam log terbaru.');
            }

            let message = `🚨 <b>Recent Unauthorized Access Attempts (${alerts.length}):</b>\n\n`;

            alerts.forEach((alert, index) => {
                const date = new Date(alert.timestamp).toLocaleString('id-ID');
                message += `${index + 1}. <b>User ID:</b> <code>${alert.userId}</code>\n`;
                message += `   <b>Time:</b> ${date}\n`;
                if (alert.extra?.username) {
                    message += `   <b>Username:</b> @${alert.extra.username}\n`;
                }
                if (alert.extra?.command) {
                    message += `   <b>Command:</b> <code>${alert.extra.command}</code>\n`;
                }
                message += '\n';
            });

            ctx.reply(message, { parse_mode: 'HTML' });
            logger.admin('Admin checked alerts', ctx.from.id);
        } catch (error) {
            logger.error('Error in handleAlerts', ctx.from.id, { error: error.message });
            ctx.reply('❌ Gagal mengambil data alerts');
        }
    }

    async handleAdminHelp(ctx) {
        const helpMessage = `🎮 <b>Epic Games Bot - Panel Admin</b>

🛠 <b>Maintenance</b>
├ /mt 1 [pesan] - Aktifkan mode maintenance
└ /mt 0 - Nonaktifkan mode maintenance

♻️ <b>Otomatis Cek Game</b>
├ /otomatiscek true [interval] - Aktifkan auto check Epic Games
└ /otomatiscek false - Nonaktifkan auto check

👥 <b>Manajemen Grup</b>
├ /setgroup 1 - Aktifkan bot di grup
├ /setgroup 0 - Nonaktifkan bot di grup
└ /listgroup - Lihat daftar grup

👤 <b>Manajemen Pengguna</b>
├ /listuser - Lihat daftar pengguna
├ /listblocked - Lihat pengguna yang memblokir bot
├ /listbanned - Lihat pengguna yang dibanned
├ /banuser [id] [alasan] - Ban pengguna
├ /unbanuser [id] - Unban pengguna
├ /deleteuser [id] - Hapus pengguna
├ /broadcast [pesan] - Kirim pesan ke semua pengguna
└ /broadcastimg [caption] - Kirim gambar

⚡️ <b>Manajemen Admin</b>
├ /addadmin [user_id] - Tambah admin baru
├ /deleteadmin [user_id] - Hapus admin
└ /listadmin - Lihat daftar admin

🚨 <b>Security &amp; Monitoring</b>
├ /stats - Statistik bot detail
├ /alerts - Lihat percobaan akses ilegal
├ /adminhelp - Tampilkan bantuan ini
└ /formathtml - Tampilkan format HTML yang didukung

🎯 <b>Focus: Epic Games Only</b>
• Auto check Epic Games free games only
• Reliable Epic Games API integration
• Clean and focused feature set

💡 <b>Admin Support:</b> @contactpixelme_bot`;

        ctx.reply(helpMessage, { parse_mode: 'HTML' });
    }

    async handleFormatHTML(ctx) {
        const formatMessage = `📝 <b>Format HTML yang Didukung:</b>

<b>Bold Text</b>
<code>Monospace</code>
<i>Italic Text</i>
<a href="https://example.com">Link Text</a>

<b>Contoh:</b>
/broadcast Halo <b>semua</b>! Game Epic Games baru tersedia <a href="https://epicgames.com">di sini</a>

<b>Note:</b> Gunakan HTML format untuk broadcast`;

        ctx.reply(formatMessage, { parse_mode: 'HTML' });
    }

    async broadcastToUsers(telegram, message) {
        const users = userService.getAllUsers();
        const userIds = Object.keys(users).filter(id => !userService.isBanned(id));

        for (const userId of userIds.slice(0, 100)) {
            const user = users[userId];
            try {
                await telegram.sendMessage(user.chatId, message, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                });
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                if (error.code === 403) {
                    userService.markUserBlocked(userId);
                }
            }
        }
    }
}

module.exports = new AdminHandler();
