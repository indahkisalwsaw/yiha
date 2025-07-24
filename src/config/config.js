const fs = require('fs');
const path = require('path');

class Config {
    constructor() {
        this.BOT_TOKEN = '7837393222:AAGF40lXYb_A1dcvC65Jw9_lbcevVG1u1ck';
        this.ADMIN_ID = 6312194526;
        this.DB_PATH = path.join(__dirname, '../database');
        this.EXPORTS_PATH = path.join(__dirname, '../../exports');
        this.initializeDirectories();
    }

    initializeDirectories() {
        [this.DB_PATH, this.EXPORTS_PATH].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        
        this.ensureDatabaseFiles();
    }

    ensureDatabaseFiles() {
        const defaultFiles = {
            'users.json': {},
            'groups.json': {},
            'banned.json': {},
            'logs.json': [],
            'admins.json': { [this.ADMIN_ID]: true },
            'settings.json': {
                maintenance: false,
                maintenanceMessage: '🔧 Bot sedang dalam maintenance.',
                autoCheck: false,
                autoCheckInterval: 6,
                groupsEnabled: true
            }
        };

        for (const [filename, defaultContent] of Object.entries(defaultFiles)) {
            const filePath = this.getDbPath(filename);
            
            if (!fs.existsSync(filePath)) {
                try {
                    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
                    console.log(`📄 Created ${filename}`);
                } catch (error) {
                    console.error(`❌ Failed to create ${filename}:`, error.message);
                }
            }
        }
    }

    getDbPath(filename) {
        return path.join(this.DB_PATH, filename);
    }

    getExportPath(filename) {
        return path.join(this.EXPORTS_PATH, filename);
    }
}

// Export instance properly
const configInstance = new Config();
module.exports = configInstance;
