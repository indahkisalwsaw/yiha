const fs = require('fs-extra');
const config = require('../config/config');
const logger = require('../utils/logger');

class GroupService {
    constructor() {
        this.groupsFile = config.getDbPath('groups.json');
        this.init();
    }

    init() {
        if (!fs.existsSync(this.groupsFile)) {
            fs.writeJsonSync(this.groupsFile, {});
        }
    }

    async addGroup(ctx) {
        try {
            const groups = fs.readJsonSync(this.groupsFile);
            const chatId = ctx.chat.id;
            const chatType = ctx.chat.type;

            // Only process groups and supergroups
            if (!['group', 'supergroup'].includes(chatType)) {
                return null;
            }

            if (!groups[chatId]) {
                const memberCount = await this.getChatMemberCount(ctx);
                groups[chatId] = {
                    id: chatId,
                    title: ctx.chat.title || 'Unknown Group',
                    type: chatType,
                    memberCount: memberCount,
                    joinDate: new Date().toISOString(),
                    lastActive: new Date().toISOString(),
                    messageCount: 0,
                    isActive: true,
                    addedBy: ctx.from ? ctx.from.id : null
                };

                fs.writeJsonSync(this.groupsFile, groups, { spaces: 2 });
                logger.info('New group added', null, { 
                    chatId, 
                    title: ctx.chat.title,
                    addedBy: ctx.from?.id 
                });
            } else {
                // Update group info
                groups[chatId].lastActive = new Date().toISOString();
                groups[chatId].title = ctx.chat.title || groups[chatId].title;
                groups[chatId].messageCount++;
                fs.writeJsonSync(this.groupsFile, groups, { spaces: 2 });
            }

            return groups[chatId];
        } catch (error) {
            logger.error('Error adding group', null, { 
                chatId: ctx.chat?.id, 
                error: error.message 
            });
            return null;
        }
    }

    async getChatMemberCount(ctx) {
        try {
            const count = await ctx.getChatMembersCount();
            return count;
        } catch (error) {
            return 0;
        }
    }

    removeGroup(chatId, reason = 'Left group') {
        try {
            const groups = fs.readJsonSync(this.groupsFile);
            
            if (groups[chatId]) {
                groups[chatId].isActive = false;
                groups[chatId].leftDate = new Date().toISOString();
                groups[chatId].leftReason = reason;
                
                fs.writeJsonSync(this.groupsFile, groups, { spaces: 2 });
                logger.info('Group removed', null, { chatId, reason });
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error('Error removing group', null, { chatId, error: error.message });
            return false;
        }
    }

    getAllGroups() {
        try {
            return fs.readJsonSync(this.groupsFile);
        } catch (error) {
            return {};
        }
    }

    getActiveGroups() {
        try {
            const groups = this.getAllGroups();
            const activeGroups = {};
            
            for (const [chatId, group] of Object.entries(groups)) {
                if (group.isActive) {
                    activeGroups[chatId] = group;
                }
            }
            
            return activeGroups;
        } catch (error) {
            return {};
        }
    }

    getGroupById(chatId) {
        try {
            const groups = this.getAllGroups();
            return groups[chatId] || null;
        } catch (error) {
            return null;
        }
    }

    updateGroupInfo(chatId, updates) {
        try {
            const groups = fs.readJsonSync(this.groupsFile);
            
            if (groups[chatId]) {
                groups[chatId] = { ...groups[chatId], ...updates };
                groups[chatId].lastActive = new Date().toISOString();
                
                fs.writeJsonSync(this.groupsFile, groups, { spaces: 2 });
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error('Error updating group', null, { chatId, error: error.message });
            return false;
        }
    }

    getGroupStats() {
        try {
            const groups = this.getAllGroups();
            const activeGroups = this.getActiveGroups();
            
            const stats = {
                total: Object.keys(groups).length,
                active: Object.keys(activeGroups).length,
                inactive: Object.keys(groups).length - Object.keys(activeGroups).length,
                totalMembers: 0,
                averageMembers: 0,
                oldestGroup: null,
                newestGroup: null,
                mostActiveGroup: null
            };

            let totalMembers = 0;
            let oldestDate = null;
            let newestDate = null;
            let mostMessages = 0;

            for (const group of Object.values(activeGroups)) {
                totalMembers += group.memberCount || 0;
                
                const joinDate = new Date(group.joinDate);
                if (!oldestDate || joinDate < oldestDate) {
                    oldestDate = joinDate;
                    stats.oldestGroup = group;
                }
                
                if (!newestDate || joinDate > newestDate) {
                    newestDate = joinDate;
                    stats.newestGroup = group;
                }
                
                if (group.messageCount > mostMessages) {
                    mostMessages = group.messageCount;
                    stats.mostActiveGroup = group;
                }
            }

            stats.totalMembers = totalMembers;
            stats.averageMembers = stats.active > 0 ? Math.round(totalMembers / stats.active) : 0;

            return stats;
        } catch (error) {
            logger.error('Error getting group stats', null, { error: error.message });
            return {
                total: 0,
                active: 0,
                inactive: 0,
                totalMembers: 0,
                averageMembers: 0
            };
        }
    }

    cleanInactiveGroups(daysThreshold = 30) {
        try {
            const groups = fs.readJsonSync(this.groupsFile);
            const threshold = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);
            let cleaned = 0;

            for (const [chatId, group] of Object.entries(groups)) {
                const lastActive = new Date(group.lastActive || group.joinDate).getTime();
                
                if (lastActive < threshold && group.isActive) {
                    groups[chatId].isActive = false;
                    groups[chatId].leftReason = 'Inactive cleanup';
                    groups[chatId].leftDate = new Date().toISOString();
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                fs.writeJsonSync(this.groupsFile, groups, { spaces: 2 });
                logger.info('Inactive groups cleaned', null, { cleaned, daysThreshold });
            }

            return cleaned;
        } catch (error) {
            logger.error('Error cleaning inactive groups', null, { error: error.message });
            return 0;
        }
    }

    exportGroups() {
        try {
            const groups = this.getAllGroups();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `groups_export_${timestamp}.json`;
            const exportPath = config.getExportPath(filename);
            
            fs.writeJsonSync(exportPath, groups, { spaces: 2 });
            return { success: true, filename, path: exportPath };
        } catch (error) {
            logger.error('Error exporting groups', null, { error: error.message });
            return { success: false, error: error.message };
        }
    }

    importGroups(filePath) {
        try {
            const importedGroups = fs.readJsonSync(filePath);
            const currentGroups = this.getAllGroups();
            
            const merged = { ...currentGroups, ...importedGroups };
            fs.writeJsonSync(this.groupsFile, merged, { spaces: 2 });
            
            const newGroupsCount = Object.keys(importedGroups).length;
            logger.admin('Groups imported', null, { count: newGroupsCount });
            
            return { success: true, count: newGroupsCount };
        } catch (error) {
            logger.error('Error importing groups', null, { error: error.message });
            return { success: false, error: error.message };
        }
    }

    formatGroupsList(groups, maxGroups = 20) {
        const groupArray = Object.values(groups);
        const activeGroups = groupArray.filter(g => g.isActive);
        
        if (activeGroups.length === 0) {
            return '📭 Tidak ada grup aktif';
        }

        let message = `📋 <b>Daftar Grup (${activeGroups.length}):</b>\n\n`;

        activeGroups.slice(0, maxGroups).forEach((group, index) => {
            const memberText = group.memberCount ? ` (${group.memberCount} members)` : '';
            message += `${index + 1}. <b>${group.title}</b>${memberText}\n`;
            message += `   ID: <code>${group.id}</code>\n`;
            message += `   Join: ${new Date(group.joinDate).toLocaleDateString('id-ID')}\n`;
            message += `   Pesan: ${group.messageCount || 0}\n\n`;
        });

        if (activeGroups.length > maxGroups) {
            message += `... dan ${activeGroups.length - maxGroups} grup lainnya`;
        }

        return message;
    }
}

module.exports = new GroupService();
