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
const path = require('path');

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

            // Stop existing job
            if (this.autoCheckJob) {
                this.autoCheckJob.stop();
            }

            // Start new job
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

    // ✅ ADD MISSING METHOD
    async handleListGroup(ctx) {
        try {
            const groups = groupService.getActiveGroups();
            const groupCount = Object.keys(groups).length;

            if (groupCount === 0) {
                return ctx.reply('📭 Bot tidak ada di grup manapun');
            }

            const groupsList = groupService.formatGroupsList(groups);
            await ctx.reply(groupsList, { parse_mode: 'Markdown' });
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

        let message = `👥 *Daftar Pengguna (${userCount}):*\n\n`;
        let count = 0;

        for (const [userId, user] of Object.entries(users)) {
            if (count >= 20) {
                message += `\n... dan ${userCount - 20} pengguna lainnya`;
                break;
            }

            const status = user.isBlocked ? '🚫' : '✅';
            const username = user.username ? `@${user.username}` : 'No username';
            message += `${status} ${user.firstName || 'Unknown'} (${username})\n`;
            message += `   ID: \`${userId}\`\n`;
            message += `   Join: ${new Date(user.joinDate).toLocaleDateString('id-ID')}\n\n`;
            count++;
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
    }

    async handleListBlocked(ctx) {
        const users = userService.getAllUsers();
        const blockedUsers = Object.entries(users).filter(([_, user]) => user.isBlocked);

        if (blockedUsers.length === 0) {
            return ctx.reply('✅ Tidak ada pengguna yang memblokir bot');
        }

        let message = `🚫 *Pengguna yang Memblokir Bot (${blockedUsers.length}):*\n\n`;

        blockedUsers.slice(0, 20).forEach(([userId, user]) => {
            const username = user.username ? `@${user.username}` : 'No username';
            message += `• ${user.firstName || 'Unknown'} (${username})\n`;
            message += `  ID: \`${userId}\`\n\n`;
        });

        if (blockedUsers.length > 20) {
            message += `... dan ${blockedUsers.length - 20} pengguna lainnya`;
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
    }

    async handleListBanned(ctx) {
        const bannedUsers = userService.getBannedUsers();
        const bannedCount = Object.keys(bannedUsers).length;

        if (bannedCount === 0) {
            return ctx.reply('✅ Tidak ada pengguna yang dibanned');
        }

        let message = `🚫 *Pengguna yang Dibanned (${bannedCount}):*\n\n`;

        Object.entries(bannedUsers).slice(0, 20).forEach(([userId, data]) => {
            message += `• ID: \`${userId}\`\n`;
            message += `  Alasan: ${data.reason}\n`;
            message += `  Tanggal: ${new Date(data.bannedAt).toLocaleDateString('id-ID')}\n\n`;
        });

        if (bannedCount > 20) {
            message += `... dan ${bannedCount - 20} pengguna lainnya`;
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
    }

    async handleBanUser(ctx) {
        const args = ctx.message.text.split(' ');
        const userId = args[1];
        const reason = args.slice(2).join(' ') || 'No reason provided';

        if (!userId) {
            return ctx.reply('❌ Format: /banuser [user_id] [alasan]');
        }

        if (userService.banUser(userId, reason, ctx.from.id)) {
            ctx.reply(`✅ Pengguna ${userId} berhasil dibanned\nAlasan: ${reason}`);
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
            ctx.reply(`✅ Pengguna ${userId} berhasil di-unban`);
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
            ctx.reply(`✅ Pengguna ${userId} berhasil dihapus dari database`);
        } else {
            ctx.reply('❌ Gagal menghapus pengguna');
        }
    }

   async handleBroadcast(ctx) {
    const message = ctx.message.text.replace('/broadcast', '').trim();

    if (!message) {
        return ctx.reply(`❌ Format: /broadcast [pesan]

*Contoh:*
\`/broadcast Hello *semua*! Game baru tersedia.\`

*Support HTML Tags:*
• \`<b>Bold</b>\`
• \`<i>Italic</i>\`
• \`<code>Code</code>\`
• \`<a href="URL">Link</a>\``, { parse_mode: 'Markdown' });
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

*Cara penggunaan:*
1. Upload/forward gambar ke chat
2. Reply ke gambar tersebut dengan: \`/broadcastimg Caption disini\`

*Support HTML dalam caption:*
• \`<b>Bold</b>\`
• \`<i>Italic</i>\`
• \`<a href="URL">Link</a>\``, { parse_mode: 'Markdown' });
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
        logger.error('Error in handleBroadcastImage', ctx.from.id, { error: error.message });
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
            ctx.reply(`✅ ${userId} berhasil ditambahkan sebagai admin`);
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
            ctx.reply(`✅ ${userId} berhasil dihapus dari admin`);
        } else {
            ctx.reply('❌ Gagal menghapus admin (mungkin main admin)');
        }
    }

    async handleListAdmin(ctx) {
        const admins = userService.getAdmins();
        const adminIds = Object.keys(admins);

        let message = `👑 *Daftar Admin (${adminIds.length}):*\n\n`;

        adminIds.forEach(adminId => {
            message += `• \`${adminId}\`\n`;
        });

        ctx.reply(message, { parse_mode: 'Markdown' });
    }

    async handleStats(ctx) {
        try {
            const users = userService.getAllUsers();
            const bannedUsers = userService.getBannedUsers();
            const admins = userService.getAdmins();
            const groups = groupService.getActiveGroups();
            const settings = maintenanceMiddleware.getSettings();

            const totalUsers = Object.keys(users).length;
            const activeUsers = Object.values(users).filter(u => !u.isBlocked).length;
            const blockedUsers = Object.values(users).filter(u => u.isBlocked).length;
            const totalBanned = Object.keys(bannedUsers).length;
            const totalAdmins = Object.keys(admins).length;
            const totalGroups = Object.keys(groups).length;

            const message = `📊 *Statistik Bot Epic Games*\n\n` +
                           `👥 *Pengguna:*\n` +
                           `• Total: ${totalUsers}\n` +
                           `• Aktif: ${activeUsers}\n` +
                           `• Diblokir: ${blockedUsers}\n` +
                           `• Dibanned: ${totalBanned}\n\n` +
                           `👑 *Admin:* ${totalAdmins}\n` +
                           `🏢 *Grup:* ${totalGroups}\n\n` +
                           `⚙️ *Status:*\n` +
                           `• Maintenance: ${settings.maintenance ? '🔧 ON' : '✅ OFF'}\n` +
                           `• Auto Check: ${settings.autoCheck ? '✅ ON' : '❌ OFF'}\n` +
                           `• Groups: ${settings.groupsEnabled ? '✅ ON' : '❌ OFF'}\n\n` +
                           `📅 *Update:* ${new Date().toLocaleString('id-ID')}`;

            ctx.reply(message, { parse_mode: 'Markdown' });
            logger.admin('Admin checked stats', ctx.from.id);
        } catch (error) {
            logger.error('Error in handleStats', ctx.from.id, { error: error.message });
            ctx.reply('❌ Error mengambil statistik bot');
        }
    }

    // ✅ ADD MISSING EXPORT DATABASE METHOD
    async handleExportDatabase(ctx) {
        try {
            const exportData = {
                users: userService.getAllUsers(),
                banned: userService.getBannedUsers(),
                admins: userService.getAdmins(),
                groups: groupService.getAllGroups(),
                settings: maintenanceMiddleware.getSettings(),
                exportDate: new Date().toISOString(),
                botVersion: '1.0.0'
            };

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `epic-bot-database-${timestamp}.json`;
            const filePath = config.getExportPath(filename);

            // Write to file
            fs.writeJsonSync(filePath, exportData, { spaces: 2 });

            // Send file to admin
            await ctx.replyWithDocument({
                source: filePath,
                filename: filename
            }, {
                caption: `📤 *Database Export*\n\n` +
                        `📅 Export Date: ${new Date().toLocaleString('id-ID')}\n` +
                        `👥 Users: ${Object.keys(exportData.users).length}\n` +
                        `🏢 Groups: ${Object.keys(exportData.groups).length}\n` +
                        `👑 Admins: ${Object.keys(exportData.admins).length}\n\n` +
                        `💾 File: \`${filename}\``,
                parse_mode: 'Markdown'
            });

            // Cleanup temp file
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }, 60000); // Delete after 1 minute

            logger.admin('Database exported', ctx.from.id, { filename });
        } catch (error) {
            logger.error('Error in handleExportDatabase', ctx.from.id, { error: error.message });
            ctx.reply('❌ Gagal export database');
        }
    }

    // ✅ ADD MISSING IMPORT DATABASE METHOD
    async handleImportDatabase(ctx) {
        try {
            if (!ctx.message.document) {
                return ctx.reply(`📥 *Import Database*

*Cara penggunaan:*
1. Upload file .json database
2. Gunakan caption: \`/importdb\`

*Format file:*
• File harus format .json
• File harus berisi data export dari bot ini
• Import akan merge dengan data existing

⚠️ *Peringatan:* Import akan mengganti data yang ada!`, { parse_mode: 'Markdown' });
            }

            const document = ctx.message.document;
            
            // Validate file
            if (!document.file_name.endsWith('.json')) {
                return ctx.reply('❌ File harus berformat .json');
            }

            if (document.file_size > 10 * 1024 * 1024) { // 10MB limit
                return ctx.reply('❌ File terlalu besar (maksimal 10MB)');
            }

            const processingMsg = await ctx.reply('⏳ Memproses import database...');

            // Download file
            const fileLink = await ctx.telegram.getFileLink(document.file_id);
            const axios = require('axios');
            const response = await axios.get(fileLink.href);
            const importData = response.data;

            // Validate import data structure
            if (!importData.users || !importData.admins) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    processingMsg.message_id,
                    null,
                    '❌ Format file tidak valid. File harus berisi data export dari bot ini.'
                );
                return;
            }

            // Backup current data
            const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = config.getExportPath(`backup-before-import-${backupTimestamp}.json`);
            const currentData = {
                users: userService.getAllUsers(),
                banned: userService.getBannedUsers(),
                admins: userService.getAdmins(),
                groups: groupService.getAllGroups(),
                settings: maintenanceMiddleware.getSettings()
            };
            fs.writeJsonSync(backupPath, currentData, { spaces: 2 });

            // Import data
            let importedCounts = {
                users: 0,
                admins: 0,
                groups: 0,
                banned: 0
            };

            // Import users
            if (importData.users) {
                const currentUsers = userService.getAllUsers();
                const mergedUsers = { ...currentUsers, ...importData.users };
                fs.writeJsonSync(userService.usersFile, mergedUsers, { spaces: 2 });
                importedCounts.users = Object.keys(importData.users).length;
            }

            // Import admins
            if (importData.admins) {
                const currentAdmins = userService.getAdmins();
                const mergedAdmins = { ...currentAdmins, ...importData.admins };
                fs.writeJsonSync(userService.adminsFile, mergedAdmins, { spaces: 2 });
                importedCounts.admins = Object.keys(importData.admins).length;
            }

            // Import groups
            if (importData.groups) {
                const currentGroups = groupService.getAllGroups();
                const mergedGroups = { ...currentGroups, ...importData.groups };
                fs.writeJsonSync(groupService.groupsFile, mergedGroups, { spaces: 2 });
                importedCounts.groups = Object.keys(importData.groups).length;
            }

            // Import banned users
            if (importData.banned) {
                const currentBanned = userService.getBannedUsers();
                const mergedBanned = { ...currentBanned, ...importData.banned };
                fs.writeJsonSync(userService.bannedFile, mergedBanned, { spaces: 2 });
                importedCounts.banned = Object.keys(importData.banned).length;
            }

            await ctx.telegram.editMessageText(
                ctx.chat.id,
                processingMsg.message_id,
                null,
                `✅ *Database berhasil diimport!*\n\n` +
                `📊 *Data yang diimport:*\n` +
                `👥 Users: ${importedCounts.users}\n` +
                `👑 Admins: ${importedCounts.admins}\n` +
                `🏢 Groups: ${importedCounts.groups}\n` +
                `🚫 Banned: ${importedCounts.banned}\n\n` +
                `💾 Backup saved: \`${path.basename(backupPath)}\`\n` +
                `📅 Import Date: ${new Date().toLocaleString('id-ID')}`,
                { parse_mode: 'Markdown' }
            );

            logger.admin('Database imported', ctx.from.id, { 
                filename: document.file_name,
                importedCounts
            });

        } catch (error) {
            logger.error('Error in handleImportDatabase', ctx.from.id, { error: error.message });
            ctx.reply('❌ Gagal import database: ' + error.message);
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

            let message = `🚨 *Recent Unauthorized Access Attempts (${alerts.length}):*\n\n`;

            alerts.forEach((alert, index) => {
                const date = new Date(alert.timestamp).toLocaleString('id-ID');
                message += `${index + 1}. *User ID:* \`${alert.userId}\`\n`;
                message += `   *Time:* ${date}\n`;
                if (alert.extra?.username) {
                    message += `   *Username:* @${alert.extra.username}\n`;
                }
                if (alert.extra?.command) {
                    message += `   *Command:* \`${alert.extra.command}\`\n`;
                }
                message += '\n';
            });

            ctx.reply(message, { parse_mode: 'Markdown' });
            logger.admin('Admin checked alerts', ctx.from.id);
        } catch (error) {
            logger.error('Error in handleAlerts', ctx.from.id, { error: error.message });
            ctx.reply('❌ Gagal mengambil data alerts');
        }
    }

    async handleAdminHelp(ctx) {
        const helpMessage = `🎮 *Epic Games Bot - Panel Admin*

🛠 *Maintenance*
├ /mt 1 [pesan] - Aktifkan mode maintenance
└ /mt 0 - Nonaktifkan mode maintenance

♻️ *Otomatis Cek Game*
├ /otomatiscek true [interval] - Aktifkan mode otomatis cek game terbaru dengan interval dalam format jam
└ /otomatiscek false - Nonaktifkan mode otomatis cek game terbaru

👥 *Manajemen Grup*
├ /setgroup 1 - Aktifkan bot di grup
├ /setgroup 0 - Nonaktifkan bot di grup
└ /listgroup - Lihat daftar grup

👤 *Manajemen Pengguna*
├ /listuser - Lihat daftar pengguna
├ /listblocked - Lihat pengguna yang memblokir bot
├ /listbanned - Lihat pengguna yang dibanned
├ /banuser [id] [alasan] - Ban pengguna
├ /unbanuser [id] - Unban pengguna
├ /deleteuser [id] - Hapus pengguna dari database
├ /broadcast [pesan] - Kirim pesan ke semua pengguna
└ /broadcastimg [caption] - Kirim gambar + caption ke semua pengguna (reply ke gambar)

⚡️ *Manajemen Admin*
├ /addadmin [user_id] - Tambah admin baru
├ /deleteadmin [user_id] - Hapus admin
└ /listadmin - Lihat daftar admin

🚨 *Security & Monitoring*
├ /stats - Statistik bot detail
├ /alerts - Lihat percobaan akses ilegal
├ /adminhelp - Tampilkan bantuan ini
└ /formathtml - Tampilkan format HTML yang didukung

💾 *Database Management*
├ /exportdb - Export database ke file JSON
└ /importdb - Import database dari file JSON (upload file)

💡 *Tips:*
• Bot akan otomatis kirim notif ke admin untuk user baru & unauthorized access
• Gunakan /stats untuk memonitor performa bot
• Cek /alerts secara berkala untuk security monitoring

Need help? Contact @pixelme11`;

        ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    }

    async handleFormatHTML(ctx) {
        const formatMessage = `📝 *Format HTML yang Didukung:*

*Bold Text*
\`Monospace\`
_Italic Text_
[Link Text](URL)

\`\`\`
Code Block
\`\`\`

*Contoh:*
/broadcast Halo *semua*! Game baru tersedia [di sini](https://epicgames.com)

*Note:* Gunakan Markdown format untuk broadcast`;

        ctx.reply(formatMessage, { parse_mode: 'Markdown' });
    }

    async broadcastToUsers(telegram, message) {
        // Helper method for auto broadcast
        const users = userService.getAllUsers();
        const userIds = Object.keys(users).filter(id => !userService.isBanned(id));

        for (const userId of userIds.slice(0, 100)) { // Limit for auto broadcast
            const user = users[userId];
            try {
                await telegram.sendMessage(user.chatId, message, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                });
                await new Promise(resolve => setTimeout(resolve, 100)); // Delay
            } catch (error) {
                if (error.code === 403) {
                    userService.markUserBlocked(userId);
                }
            }
        }
    }
}

module.exports = new AdminHandler();
