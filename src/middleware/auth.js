const userService = require('../services/userService');
const config = require('../config/config');
const { MESSAGES } = require('../config/constants');
const logger = require('../utils/logger');

const adminOnly = () => {
    return async (ctx, next) => {
        const userId = ctx.from.id;
        const MAIN_ADMIN = config.ADMIN_ID;
        
        logger.info('Admin check attempt', userId, {
            configAdminId: MAIN_ADMIN,
            attemptedUserId: userId,
            match: userId === MAIN_ADMIN
        });
        
        // Check main admin first
        if (userId === MAIN_ADMIN) {
            logger.info('Main admin access granted', userId);
            return next();
        }
        
        // Check database admins
        if (userService.isAdmin(userId)) {
            logger.info('Database admin access granted', userId);
            return next();
        }
        
        // 🚨 UNAUTHORIZED ACCESS - Send notification to admin
        const command = ctx.message?.text || 'Unknown command';
        const username = ctx.from.username ? `@${ctx.from.username}` : 'No username';
        const firstName = ctx.from.first_name || 'Unknown';
        
        // Send alert to admin
        try {
            const alertMessage = `🚨 **UNAUTHORIZED ADMIN ACCESS ATTEMPT**

👤 **User Info:**
• Name: ${firstName}
• Username: ${username}  
• User ID: \`${userId}\`

⚠️ **Attempted Command:** \`${command}\`
📅 **Time:** ${new Date().toLocaleString('id-ID')}

🔍 **Action Required:** Check if this user should have admin access.`;

            await ctx.telegram.sendMessage(MAIN_ADMIN, alertMessage, {
                parse_mode: 'Markdown'
            });
        } catch (error) {
            logger.error('Failed to send admin alert', null, { error: error.message });
        }
        
        // REJECT with clean message (NO ADMIN ID EXPOSED!)
        logger.warn('🚨 UNAUTHORIZED ADMIN ACCESS ATTEMPT', userId, {
            username: ctx.from.username,
            firstName: ctx.from.first_name,
            command: command
        });
        
        await ctx.reply(`🚫 **AKSES DITOLAK!**

Anda tidak memiliki akses administrator!

👤 User ID Anda: \`${userId}\`
🚨 Percobaan akses telah dilaporkan ke admin.

Hubungi @pixelme11 jika ini adalah kesalahan.`, {
            parse_mode: 'Markdown'
        });
        
        return; // STOP execution
    };
};

const banCheck = () => {
    return (ctx, next) => {
        const userId = ctx.from.id;
        
        if (userService.isBanned(userId)) {
            logger.warn('Banned user access attempt', userId);
            return; // Silent ignore untuk banned users
        }
        
        return next();
    };
};

const userRegistration = () => {
    return async (ctx, next) => {
        try {
            const userInfo = userService.addUser(ctx);
            
            // Check if this is a new user and send notification to admin
            if (userInfo && userInfo.isNewUser) {
                await sendNewUserNotification(ctx, userInfo);
            }
        } catch (error) {
            logger.error('User registration failed', ctx.from.id, { error: error.message });
            // Continue anyway to not block bot
        }
        return next();
    };
};

// Helper function untuk send new user notification
async function sendNewUserNotification(ctx, userInfo) {
    try {
        const config = require('../config/config');
        const MAIN_ADMIN = config.ADMIN_ID;
        
        // Get current stats
        const allUsers = userService.getAllUsers();
        const bannedUsers = userService.getBannedUsers();
        const admins = userService.getAdmins();
        
        const stats = {
            totalUsers: Object.keys(allUsers).length,
            activeUsers: Object.values(allUsers).filter(u => !u.isBlocked).length,
            blockedUsers: Object.values(allUsers).filter(u => u.isBlocked).length,
            bannedUsers: Object.keys(bannedUsers).length,
            totalAdmins: Object.keys(admins).length
        };
        
        const username = ctx.from.username ? `@${ctx.from.username}` : 'No username';
        const firstName = ctx.from.first_name || 'Unknown';
        const lastName = ctx.from.last_name || '';
        
        const welcomeMessage = `🆕 **NEW USER REGISTERED**

👤 **User Info:**
• Name: ${firstName} ${lastName}
• Username: ${username}
• User ID: \`${ctx.from.id}\`
• Join Date: ${new Date().toLocaleString('id-ID')}

📊 **Current Bot Stats:**
• Total Users: **${stats.totalUsers}**
• Active Users: **${stats.activeUsers}**
• Blocked Users: **${stats.blockedUsers}**
• Banned Users: **${stats.bannedUsers}**
• Total Admins: **${stats.totalAdmins}**

🚀 Bot sedang berkembang!`;

        await ctx.telegram.sendMessage(MAIN_ADMIN, welcomeMessage, {
            parse_mode: 'Markdown'
        });
        
        logger.info('New user notification sent to admin', ctx.from.id);
    } catch (error) {
        logger.error('Failed to send new user notification', ctx.from.id, { error: error.message });
    }
}

module.exports = {
    adminOnly,
    banCheck,
    userRegistration
};
