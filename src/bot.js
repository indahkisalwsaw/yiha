const { Telegraf } = require('telegraf');
const config = require('./config/config');
const logger = require('./utils/logger');

// ✅ ADD MISSING IMPORT
const epicService = require('./services/epicService');

// Middleware
const { adminOnly, banCheck, userRegistration } = require('./middleware/auth');
const maintenanceMiddleware = require('./middleware/maintenance');

// Handlers
const adminHandler = require('./handlers/adminHandler');
const userHandler = require('./handlers/userHandler');

// Services
const userService = require('./services/userService');

// Initialize bot
const bot = new Telegraf(config.BOT_TOKEN);

// Global middleware
bot.use(banCheck());
bot.use(userRegistration());
bot.use(maintenanceMiddleware.middleware());

// Error handling
bot.catch((err, ctx) => {
    logger.error('Bot error', ctx?.from?.id, {
        error: err.message,
        stack: err.stack,
        update: ctx?.update
    });
    try {
        ctx?.reply('❌ Terjadi kesalahan internal. Tim admin telah diberitahu.');
    } catch (e) {
        // Ignore reply errors
    }
});

// User commands
bot.start(userHandler.handleStart.bind(userHandler));
bot.help(userHandler.handleHelp.bind(userHandler));
bot.command('epicfree', userHandler.handleEpicFree.bind(userHandler));
bot.command('upcoming', userHandler.handleUpcoming.bind(userHandler));

// Handle callback queries dari inline keyboard
bot.on('callback_query', userHandler.handleCallbackQuery.bind(userHandler));

// Admin commands dengan STRICT protection
bot.command('adminhelp', adminOnly(), adminHandler.handleAdminHelp.bind(adminHandler));
bot.command('mt', adminOnly(), adminHandler.handleMaintenance.bind(adminHandler));
bot.command('otomatiscek', adminOnly(), adminHandler.handleAutoCheck.bind(adminHandler));
bot.command('setgroup', adminOnly(), adminHandler.handleSetGroup.bind(adminHandler));
bot.command('listuser', adminOnly(), adminHandler.handleListUsers.bind(adminHandler));
bot.command('listblocked', adminOnly(), adminHandler.handleListBlocked.bind(adminHandler));
bot.command('listbanned', adminOnly(), adminHandler.handleListBanned.bind(adminHandler));
bot.command('banuser', adminOnly(), adminHandler.handleBanUser.bind(adminHandler));
bot.command('unbanuser', adminOnly(), adminHandler.handleUnbanUser.bind(adminHandler));
bot.command('deleteuser', adminOnly(), adminHandler.handleDeleteUser.bind(adminHandler));
bot.command('broadcast', adminOnly(), adminHandler.handleBroadcast.bind(adminHandler));
bot.command('broadcastimg', adminOnly(), adminHandler.handleBroadcastImage.bind(adminHandler));
bot.command('addadmin', adminOnly(), adminHandler.handleAddAdmin.bind(adminHandler));
bot.command('deleteadmin', adminOnly(), adminHandler.handleDeleteAdmin.bind(adminHandler));
bot.command('listadmin', adminOnly(), adminHandler.handleListAdmin.bind(adminHandler));
bot.command('stats', adminOnly(), adminHandler.handleStats.bind(adminHandler));
bot.command('formathtml', adminOnly(), adminHandler.handleFormatHTML.bind(adminHandler));
bot.command('listgroup', adminOnly(), adminHandler.handleListGroup.bind(adminHandler));
bot.command('alerts', adminOnly(), adminHandler.handleAlerts.bind(adminHandler));

// ✅ SINGLE DEBUG API COMMAND (removed duplicate)
bot.command('debugapi', adminOnly(), async (ctx) => {
    try {
        const msg = await ctx.reply('🔧 Testing Epic Games API...');
        await epicService.debugAPI();
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            msg.message_id,
            null,
            '✅ API debug selesai. Cek logs untuk detail.'
        );
    } catch (error) {
        ctx.reply('❌ Debug failed: ' + error.message);
    }
});

// Handle unknown commands
bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) {
        userHandler.handleUnknownCommand(ctx);
    }
});

// Group management
bot.on('new_chat_members', (ctx) => {
    const settings = maintenanceMiddleware.getSettings();
    if (!settings.groupsEnabled) {
        return ctx.leaveChat();
    }
    
    logger.info('Bot added to group', null, {
        chatId: ctx.chat.id,
        title: ctx.chat.title
    });
});

// Handle bot blocking
bot.on('my_chat_member', (ctx) => {
    const { new_chat_member } = ctx.myChatMember;
    if (new_chat_member.status === 'kicked') {
        userService.markUserBlocked(ctx.from.id);
        logger.info('User blocked bot', ctx.from.id);
    }
});

// Launch bot
async function startBot() {
    try {
        await bot.launch();
        logger.info('Bot started successfully');
        console.log('🎮 Epic Games Bot is running...');

        // Initialize auto check if enabled
        const settings = maintenanceMiddleware.getSettings();
        if (settings.autoCheck) {
            adminHandler.handleAutoCheck({
                message: {
                    text: `/otomatiscek true ${settings.autoCheckInterval}`
                },
                from: {
                    id: config.ADMIN_ID
                }
            });
        } // ✅ FIXED missing closing brace
    } catch (error) {
        logger.error('Failed to start bot', null, {
            error: error.message
        });
        console.error('❌ Failed to start bot:', error.message);
        process.exit(1);
    } // ✅ FIXED missing closing brace
} // ✅ FIXED missing closing brace

// Graceful shutdown
process.once('SIGINT', () => {
    logger.info('Bot stopping (SIGINT)');
    bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
    logger.info('Bot stopping (SIGTERM)');
    bot.stop('SIGTERM');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', null, {
        error: error.message, 
        stack: error.stack
    });
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', null, {
        reason, 
        promise
    });
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
startBot();

module.exports = bot;
