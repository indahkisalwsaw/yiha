const fs = require('fs-extra');
const config = require('../config/config');

function resetDatabase() {
    const files = {
        'logs.json': [],
        'users.json': {},
        'groups.json': {},
        'banned.json': {},
        'admins.json': { [config.ADMIN_ID]: true },
        'settings.json': {
            maintenance: false,
            maintenanceMessage: '🔧 Bot sedang dalam maintenance. Silakan coba lagi nanti.',
            autoCheck: false,
            autoCheckInterval: 6,
            groupsEnabled: true
        }
    };

    try {
        for (const [filename, defaultContent] of Object.entries(files)) {
            const filePath = config.getDbPath(filename);
            fs.writeJsonSync(filePath, defaultContent, { spaces: 2 });
            console.log(`✅ Reset ${filename}`);
        }
        console.log('🎉 Database reset complete!');
    } catch (error) {
        console.error('❌ Reset failed:', error.message);
    }
}

// Run if called directly
if (require.main === module) {
    resetDatabase();
}

module.exports = resetDatabase;
