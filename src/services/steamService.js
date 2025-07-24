const axios = require('axios');
const logger = require('../utils/logger');

class SteamService {
    constructor() {
        this.cache = {
            freeGames: null,
            salesGames: null,
            lastUpdate: null
        };
        this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
    }

    async getFreeAndSaleGames() {
        try {
            if (this.isCacheValid()) {
                logger.info('Using cached Steam data');
                return this.cache;
            }

            logger.info('Fetching REAL Steam games data');
            
            // ✅ Use REAL Steam APIs dari search results
            const [freeGames, salesGames] = await Promise.all([
                this.getRealFreeGames(),
                this.getRealSalesGames()
            ]);

            this.cache = {
                freeGames,
                salesGames,
                lastUpdate: Date.now()
            };

            logger.info('Steam data fetched successfully', null, {
                freeGames: freeGames.length,
                salesGames: salesGames.length
            });

            return this.cache;

        } catch (error) {
            logger.error('Error fetching Steam data', null, { error: error.message });
            
            // Return fallback data
            return {
                freeGames: this.getFallbackFreeGames(),
                salesGames: this.getFallbackSalesGames()
            };
        }
    }

    async getRealFreeGames() {
        try {
            // ✅ Method 1: FreeToGame API (dari search results)
            const freeToPlayResponse = await axios.get('https://www.freetogame.com/api/games?platform=pc', {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Epic-Games-Bot/1.0'
                }
            });

            const freeGames = [];
            
            if (freeToPlayResponse.data && Array.isArray(freeToPlayResponse.data)) {
                // Get top 10 popular free games
                freeToPlayResponse.data.slice(0, 10).forEach(game => {
                    freeGames.push({
                        id: game.id,
                        title: game.title,
                        description: game.short_description || 'Free-to-play game',
                        originalPrice: 'Free',
                        currentPrice: 'Free',
                        discount: 0,
                        url: game.game_url || `https://store.steampowered.com/search/?term=${encodeURIComponent(game.title)}`,
                        image: game.thumbnail,
                        genre: game.genre,
                        platform: 'PC',
                        endDate: 'Permanent',
                        type: 'Free-to-Play'
                    });
                });
            }

            // ✅ Method 2: Steam Featured API untuk weekend free games
            try {
                const steamResponse = await axios.get('https://store.steampowered.com/api/featured/', {
                    timeout: 10000
                });

                if (steamResponse.data && steamResponse.data.specials) {
                    steamResponse.data.specials.items.forEach(game => {
                        if (game.discount_percent >= 95) { // Almost free
                            freeGames.push({
                                id: game.id,
                                title: game.name,
                                originalPrice: `$${(game.original_price / 100).toFixed(2)}`,
                                currentPrice: `$${(game.final_price / 100).toFixed(2)}`,
                                discount: game.discount_percent,
                                url: `https://store.steampowered.com/app/${game.id}/`,
                                image: game.header_image,
                                endDate: 'Limited Time',
                                type: 'Almost Free',
                                savings: `$${((game.original_price - game.final_price) / 100).toFixed(2)}`
                            });
                        }
                    });
                }
            } catch (steamError) {
                logger.warn('Steam featured API failed', null, { error: steamError.message });
            }

            return freeGames;

        } catch (error) {
            logger.error('Error fetching real free games', null, { error: error.message });
            return this.getFallbackFreeGames();
        }
    }

    async getRealSalesGames() {
        try {
            // ✅ Steam Store Featured API untuk real sales (dari search results)
            const response = await axios.get('https://store.steampowered.com/api/featured/', {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Epic-Games-Bot/1.0',
                    'Accept': 'application/json'
                }
            });

            const salesGames = [];
            
            if (response.data && response.data.specials && response.data.specials.items) {
                response.data.specials.items.forEach(game => {
                    if (game.discount_percent >= 80 && game.discount_percent < 95) {
                        const originalPrice = game.original_price / 100;
                        const currentPrice = game.final_price / 100;
                        
                        salesGames.push({
                            id: game.id,
                            title: game.name,
                            originalPrice: `$${originalPrice.toFixed(2)}`,
                            currentPrice: `$${currentPrice.toFixed(2)}`,
                            discount: game.discount_percent,
                            url: `https://store.steampowered.com/app/${game.id}/`,
                            image: game.header_image,
                            savings: `$${(originalPrice - currentPrice).toFixed(2)}`,
                            type: 'Big Sale'
                        });
                    }
                });
            }

            // Sort by discount (highest first)
            return salesGames.sort((a, b) => b.discount - a.discount).slice(0, 15);

        } catch (error) {
            logger.error('Error fetching real sales games', null, { error: error.message });
            return this.getFallbackSalesGames();
        }
    }

    getFallbackFreeGames() {
        return [
            {
                title: "Counter-Strike 2",
                description: "Legendary FPS game",
                originalPrice: "Free",
                currentPrice: "Free",
                url: "https://store.steampowered.com/app/730/",
                endDate: "Permanent",
                type: "Free-to-Play",
                genre: "FPS"
            },
            {
                title: "Dota 2",
                description: "Popular MOBA game",
                originalPrice: "Free", 
                currentPrice: "Free",
                url: "https://store.steampowered.com/app/570/",
                endDate: "Permanent",
                type: "Free-to-Play",
                genre: "MOBA"
            },
            {
                title: "Apex Legends",
                description: "Battle Royale game",
                originalPrice: "Free",
                currentPrice: "Free", 
                url: "https://store.steampowered.com/app/1172470/",
                endDate: "Permanent",
                type: "Free-to-Play",
                genre: "Battle Royale"
            }
        ];
    }

    getFallbackSalesGames() {
        return [
            {
                title: "Steam Store Manual Check",
                originalPrice: "$XX.XX",
                currentPrice: "Check Steam",
                discount: 80,
                url: "https://store.steampowered.com/specials",
                savings: "Real deals available",
                type: "Manual Check"
            }
        ];
    }

    formatSteamGamesMessage(freeGames, salesGames) {
        let message = '🎮 **STEAM GAMES SPECIAL!**\n\n';
        
        // Free Games Section
        if (freeGames && freeGames.length > 0) {
            message += '🆓 **FREE GAMES:**\n\n';
            freeGames.slice(0, 8).forEach((game, index) => {
                message += `${index + 1}. [${this.escapeMarkdown(game.title)}](${game.url})\n`;
                if (game.genre) {
                    message += `🎯 ${game.genre}\n`;
                }
                message += `💰 ${game.originalPrice}`;
                if (game.type) {
                    message += ` (${game.type})`;
                }
                message += `\n⏰ ${game.endDate}\n\n`;
            });
        }

        // Sales Section
        if (salesGames && salesGames.length > 0) {
            message += '🔥 **MEGA DISCOUNTS (80%+ OFF):**\n\n';
            salesGames.slice(0, 10).forEach((game, index) => {
                message += `${index + 1}. [${this.escapeMarkdown(game.title)}](${game.url})\n`;
                message += `💸 **${game.discount}% OFF** - ${game.originalPrice} → ${game.currentPrice}\n`;
                if (game.savings && game.savings !== game.currentPrice) {
                    message += `💰 Save: ${game.savings}\n`;
                }
                message += '\n';
            });
        }

        if (freeGames.length === 0 && salesGames.length === 0) {
            message += '😔 No major Steam deals right now.\n\n';
            message += '💡 **Try these alternatives:**\n';
            message += '• [Steam Specials Page](https://store.steampowered.com/specials)\n';
            message += '• [SteamDB Sales](https://steamdb.info/sales/)\n';
            message += '• Use /epicfree for Epic Games deals';
        } else {
            message += '⚡️ **Grab them while they last!**\n\n';
            message += `📊 **Data from:** Steam Store API & FreeToGame API\n`;
            message += `🔄 Updated: ${new Date().toLocaleString('id-ID')}`;
        }

        return {
            text: message,
            extra: {
                parse_mode: 'Markdown',
                disable_web_page_preview: false,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎮 Steam Store', url: 'https://store.steampowered.com/specials' }],
                        [{ text: '📊 SteamDB Sales', url: 'https://steamdb.info/sales/' }],
                        [{ text: '🆓 Free Games', url: 'https://store.steampowered.com/genre/Free%20to%20Play/' }],
                        [
                            { text: '🎯 Epic Games', callback_data: 'check_epic' },
                            { text: '🔄 Refresh Steam', callback_data: 'refresh_steam' }
                        ]
                    ]
                }
            }
        };
    }

    escapeMarkdown(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/[*_`\[\]()]/g, '\\$&');
    }

    isCacheValid() {
        return this.cache.lastUpdate &&
               (Date.now() - this.cache.lastUpdate) < this.cacheTimeout;
    }

    clearCache() {
        this.cache.lastUpdate = null;
    }
}

module.exports = new SteamService();
