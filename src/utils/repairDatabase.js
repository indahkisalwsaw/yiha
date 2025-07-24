const fs = require('fs-extra');
const config = require('../config/config');

function repairDatabase() {
    console.log('🔧 Repairing database files...');
    
    const files = {
        'users.json': {},
        'groups.json': {},
        'banned.json': {},
        'logs.json': [],
        'admins.json': { [config.ADMIN_ID]: true },
        'settings.json': {
            maintenance: false,
            maintenanceMessage: '🔧 Bot sedang dalam maintenance. Silakan coba lagi nanti.',
            autoCheck: false,
            autoCheckInterval: 6,
            groupsEnabled: true
        }
    };

    let repaired = 0;

    for (const [filename, defaultContent] of Object.entries(files)) {
        const filePath = config.getDbPath(filename);
        
        try {
            // Check if file exists and is valid
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size === 0) {
                    throw new Error('File is empty');
                }
                
                const content = fs.readFileSync(filePath, 'utf8').trim();
                if (!content) {
                    throw new Error('File has no content');
                }
                
                JSON.parse(content); // Validate JSON
                console.log(`✅ ${filename} is valid`);
            } else {
                throw new Error('File does not exist');
            }
        } catch (error) {
            console.log(`🔧 Repairing ${filename}: ${error.message}`);
            fs.writeJsonSync(filePath, defaultContent, { spaces: 2 });
            repaired++;
        }
    }

    console.log(`🎉 Database repair complete! ${repaired} files repaired.`);
    return repaired;
}

if (require.main === module) {
    repairDatabase();
}

module.exports = repairDatabase;
