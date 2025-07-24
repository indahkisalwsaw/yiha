const fs = require('fs-extra');
const config = require('../config/config');
const logger = require('../utils/logger');

class UserService {
  constructor() {
    this.usersFile = config.getDbPath('users.json');
    this.bannedFile = config.getDbPath('banned.json');
    this.adminsFile = config.getDbPath('admins.json');
    this.init();
  }

  init() {
    // Initialize files
    if (!fs.existsSync(this.usersFile)) {
      fs.writeJsonSync(this.usersFile, {});
    }
    if (!fs.existsSync(this.bannedFile)) {
      fs.writeJsonSync(this.bannedFile, {});
    }
    if (!fs.existsSync(this.adminsFile)) {
      fs.writeJsonSync(this.adminsFile, {
        [config.ADMIN_ID]: true
      });
    }
  }

 addUser(ctx) {
    try {
        const users = fs.readJsonSync(this.usersFile);
        const userId = ctx.from.id;
        const chatId = ctx.chat.id;
        let isNewUser = false;

        if (!users[userId]) {
            isNewUser = true; // Flag untuk new user
            users[userId] = {
                id: userId,
                chatId: chatId,
                username: ctx.from.username || null,
                firstName: ctx.from.first_name || null,
                lastName: ctx.from.last_name || null,
                joinDate: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                messageCount: 0,
                isBlocked: false
            };
            
            fs.writeJsonSync(this.usersFile, users, { spaces: 2 });
            logger.info('New user added', userId, { username: ctx.from.username });
        } else {
            // Update existing user
            users[userId].lastActive = new Date().toISOString();
            users[userId].messageCount = (users[userId].messageCount || 0) + 1;
            
            // Update user info if changed
            users[userId].username = ctx.from.username || users[userId].username;
            users[userId].firstName = ctx.from.first_name || users[userId].firstName;
            users[userId].lastName = ctx.from.last_name || users[userId].lastName;
            
            fs.writeJsonSync(this.usersFile, users, { spaces: 2 });
        }

        // Return user info with new user flag
        return {
            ...users[userId],
            isNewUser: isNewUser
        };
    } catch (error) {
        logger.error('Error adding user', ctx.from.id, { error: error.message });
        return null;
    }
}



  isAdmin(userId) {
    const config = require('../config/config');
    const MAIN_ADMIN = config.ADMIN_ID; // Get from config - NO HARDCODE!

    logger.info('isAdmin check', userId, {
      configAdminId: MAIN_ADMIN,
      checkingUserId: userId,
      isMainAdmin: userId === MAIN_ADMIN
    });

    // Check main admin first
    if (userId === MAIN_ADMIN) {
      logger.info('Main admin verified from config', userId);
      return true;
    }

    // Check database admins
    try {
      const admins = fs.readJsonSync(this.adminsFile);
      const isDbAdmin = !!admins[userId];

      logger.info('Database admin check', userId, {
        isDbAdmin: isDbAdmin,
        totalAdmins: Object.keys(admins).length,
        adminsList: Object.keys(admins)
      });

      return isDbAdmin;
    } catch (error) {
      logger.error('Error checking admin status', userId, {
        error: error.message
      });
      return false; // Fail-safe: tidak admin jika error
    }
  }


  isBanned(userId) {
    try {
      const banned = fs.readJsonSync(this.bannedFile);
      return !!banned[userId];
    } catch (error) {
      return false;
    }
  }

  banUser(userId, reason = 'No reason provided', adminId) {
    try {
      const banned = fs.readJsonSync(this.bannedFile);
      banned[userId] = {
        reason,
        bannedBy: adminId,
        bannedAt: new Date().toISOString()
      };
      fs.writeJsonSync(this.bannedFile, banned, {
        spaces: 2
      });
      logger.admin('User banned', adminId, {
        targetUser: userId, reason
      });
      return true;
    } catch (error) {
      logger.error('Error banning user', adminId, {
        error: error.message
      });
      return false;
    }
  }

  unbanUser(userId, adminId) {
    try {
      const banned = fs.readJsonSync(this.bannedFile);
      delete banned[userId];
      fs.writeJsonSync(this.bannedFile, banned, {
        spaces: 2
      });
      logger.admin('User unbanned', adminId, {
        targetUser: userId
      });
      return true;
    } catch (error) {
      logger.error('Error unbanning user', adminId, {
        error: error.message
      });
      return false;
    }
  }

  deleteUser(userId, adminId) {
    try {
      const users = fs.readJsonSync(this.usersFile);
      delete users[userId];
      fs.writeJsonSync(this.usersFile, users, {
        spaces: 2
      });
      logger.admin('User deleted', adminId, {
        targetUser: userId
      });
      return true;
    } catch (error) {
      logger.error('Error deleting user', adminId, {
        error: error.message
      });
      return false;
    }
  }

  getAllUsers() {
    try {
      return fs.readJsonSync(this.usersFile);
    } catch (error) {
      return {};
    }
  }

  getBannedUsers() {
    try {
      return fs.readJsonSync(this.bannedFile);
    } catch (error) {
      return {};
    }
  }

  getAdmins() {
    try {
      return fs.readJsonSync(this.adminsFile);
    } catch (error) {
      return {
        [config.ADMIN_ID]: true
      };
    }
  }

  addAdmin(userId, adminId) {
    try {
      const admins = fs.readJsonSync(this.adminsFile);
      admins[userId] = true;
      fs.writeJsonSync(this.adminsFile, admins, {
        spaces: 2
      });
      logger.admin('Admin added', adminId, {
        newAdmin: userId
      });
      return true;
    } catch (error) {
      logger.error('Error adding admin', adminId, {
        error: error.message
      });
      return false;
    }
  }

  removeAdmin(userId, adminId) {
    try {
      if (userId === config.ADMIN_ID) return false; // Cannot remove main admin

      const admins = fs.readJsonSync(this.adminsFile);
      delete admins[userId];
      fs.writeJsonSync(this.adminsFile, admins, {
        spaces: 2
      });
      logger.admin('Admin removed', adminId, {
        removedAdmin: userId
      });
      return true;
    } catch (error) {
      logger.error('Error removing admin', adminId, {
        error: error.message
      });
      return false;
    }
  }

  markUserBlocked(userId) {
    try {
      const users = fs.readJsonSync(this.usersFile);
      if (users[userId]) {
        users[userId].isBlocked = true;
        fs.writeJsonSync(this.usersFile, users, {
          spaces: 2
        });
      }
    } catch (error) {
      logger.error('Error marking user blocked', null, {
        userId, error: error.message
      });
    }
  }

  exportUsers() {
    try {
      const users = this.getAllUsers();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `users_export_${timestamp}.json`;
      const exportPath = config.getExportPath(filename);

      fs.writeJsonSync(exportPath, users, {
        spaces: 2
      });
      return {
        success: true,
        filename,
        path: exportPath
      };
    } catch (error) {
      logger.error('Error exporting users', null, {
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  importUsers(filePath) {
    try {
      const importedUsers = fs.readJsonSync(filePath);
      const currentUsers = this.getAllUsers();

      const merged = {
        ...currentUsers,
        ...importedUsers
      };
      fs.writeJsonSync(this.usersFile, merged, {
        spaces: 2
      });

      const newUsersCount = Object.keys(importedUsers).length;
      logger.admin('Users imported', null, {
        count: newUsersCount
      });

      return {
        success: true,
        count: newUsersCount
      };
    } catch (error) {
      logger.error('Error importing users', null, {
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new UserService();