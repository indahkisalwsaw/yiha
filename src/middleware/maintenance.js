const fs = require('fs-extra');
const config = require('../config/config');
const userService = require('../services/userService');
const { MESSAGES } = require('../config/constants');

class MaintenanceMiddleware {
    constructor() {
        this.settingsFile = config.getDbPath('settings.json');
        this.initSettings();
    }

    initSettings() {
        if (!fs.existsSync(this.settingsFile)) {
            fs.writeJsonSync(this.settingsFile, {
                maintenance: false,
                maintenanceMessage: MESSAGES.USER.MAINTENANCE,
                autoCheck: false,
                autoCheckInterval: 6,
                groupsEnabled: true
            });
        }
    }

    getSettings() {
        try {
            return fs.readJsonSync(this.settingsFile);
        } catch (error) {
            return {
                maintenance: false,
                maintenanceMessage: MESSAGES.USER.MAINTENANCE,
                autoCheck: false,
                autoCheckInterval: 6,
                groupsEnabled: true
            };
        }
    }

    updateSettings(updates) {
        try {
            const settings = this.getSettings();
            const newSettings = { ...settings, ...updates };
            fs.writeJsonSync(this.settingsFile, newSettings, { spaces: 2 });
            return true;
        } catch (error) {
            return false;
        }
    }

    middleware() {
        return (ctx, next) => {
            const settings = this.getSettings();
            
            // Skip maintenance for admins
            if (userService.isAdmin(ctx.from.id)) {
                return next();
            }
            
            if (settings.maintenance) {
                return ctx.reply(settings.maintenanceMessage);
            }
            
            return next();
        };
    }
}

module.exports = new MaintenanceMiddleware();
