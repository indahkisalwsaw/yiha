const {
  Markup
} = require('telegraf');
const axios = require('axios');
const logger = require('../utils/logger');

class EpicService {
  constructor() {
    this.cache = {
      currentGames: null,
      upcomingGames: null,
      lastUpdate: null
    };
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.apiEndpoints = [
      'https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions',
      'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions'
    ];
  }

  async getFreeGames() {
    try {
      if (this.isCacheValid()) {
        logger.info('Using cached Epic Games data');
        return this.cache;
      }

      logger.info('Fetching Epic Games data from API');
      const response = await this.fetchFromAPI();

      if (!response.data) {
        throw new Error('No data received from API');
      }

      const games = response.data?.data?.Catalog?.searchStore?.elements || [];
      const result = this.processGames(games);

      this.cache = {
        ...result,
        lastUpdate: Date.now()
      };

      logger.info('Epic Games data fetched successfully', null, {
        currentGames: result.currentGames?.length || 0,
        upcomingGames: result.upcomingGames?.length || 0
      });

      return this.cache;

    } catch (error) {
      logger.error('Error fetching Epic Games data', null, {
        error: error.message,
        stack: error.stack
      });

      // Return cached data if available
      if (this.cache.currentGames || this.cache.upcomingGames) {
        logger.warn('Using stale cached data due to API error');
        return this.cache;
      }

      // Return empty data as fallback
      return {
        currentGames: [],
        upcomingGames: [],
        lastUpdate: Date.now()
      };
    }
  }

  async fetchFromAPI() {
    let lastError;

    // Try multiple endpoints
    for (const endpoint of this.apiEndpoints) {
      try {
        logger.info(`Trying API endpoint: ${endpoint}`);

        const response = await axios.get(endpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          timeout: 15000,
          validateStatus: (status) => status < 500
        });

        if (response.status === 200 && response.data) {
          logger.info('Successfully fetched from API', null, {
            endpoint
          });
          return response;
        }

      } catch (error) {
        logger.warn(`Failed to fetch from ${endpoint}`, null, {
          error: error.message
        });
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error('All API endpoints failed');
  }

  processGames(games) {
    const now = new Date();
    const currentGames = [];
    const upcomingGames = [];

    if (!Array.isArray(games)) {
      logger.warn('Games data is not an array', null, {
        gamesType: typeof games
      });
      return {
        currentGames,
        upcomingGames
      };
    }

    games.forEach(game => {
      try {
        if (!game || !game.promotions) return;

        const promotions = game.promotions.promotionalOffers || [];
        const upcomingPromotions = game.promotions.upcomingPromotionalOffers || [];

        // Current free games
        promotions.forEach(promo => {
          if (!promo.promotionalOffers) return;

          promo.promotionalOffers.forEach(offer => {
            const startDate = new Date(offer.startDate);
            const endDate = new Date(offer.endDate);

            if (now >= startDate && now <= endDate &&
              offer.discountSetting?.discountPercentage === 0) {
              currentGames.push(this.formatGame(game, offer));
            }
          });
        });

        // Upcoming free games
        upcomingPromotions.forEach(promo => {
          if (!promo.promotionalOffers) return;

          promo.promotionalOffers.forEach(offer => {
            const startDate = new Date(offer.startDate);

            if (now < startDate &&
              offer.discountSetting?.discountPercentage === 0) {
              upcomingGames.push(this.formatGame(game, offer));
            }
          });
        });

      } catch (error) {
        logger.warn('Error processing individual game', null, {
          gameTitle: game?.title,
          error: error.message
        });
      }
    });

    return {
      currentGames, upcomingGames
    };
  }

  formatGame(game, offer) {
    try {
      const images = game.keyImages || [];
      const thumbnail = images.find(img => img.type === 'Thumbnail')?.url ||
      images.find(img => img.type === 'DieselStoreFrontWide')?.url ||
      images.find(img => img.type === 'OfferImageWide')?.url ||
      images[0]?.url || '';

      // Build URL
      let gameUrl = '';
      if (game.catalogNs?.mappings?.[0]?.pageSlug) {
        gameUrl = `https://store.epicgames.com/en-US/p/${game.catalogNs.mappings[0].pageSlug}`;
      } else if (game.productSlug) {
        gameUrl = `https://store.epicgames.com/en-US/p/${game.productSlug}`;
      } else if (game.urlSlug) {
        gameUrl = `https://store.epicgames.com/en-US/p/${game.urlSlug}`;
      }

      return {
        title: game.title || 'Unknown Game',
        description: game.description || 'No description available',
        seller: game.seller?.name || 'Epic Games',
        originalPrice: game.price?.totalPrice?.fmtPrice?.originalPrice || 'Free',
        thumbnail: thumbnail,
        url: gameUrl,
        startDate: offer.startDate,
        endDate: offer.endDate,
        effectiveDate: game.effectiveDate
      };
    } catch (error) {
      logger.warn('Error formatting game', null, {
        gameTitle: game?.title,
        error: error.message
      });

      return {
        title: game?.title || 'Unknown Game',
        description: 'Error loading game details',
        seller: 'Epic Games',
        originalPrice: 'Free',
        thumbnail: '',
        url: 'https://store.epicgames.com',
        startDate: offer?.startDate,
        endDate: offer?.endDate,
        effectiveDate: game?.effectiveDate
      };
    }
  }

  isCacheValid() {
    return this.cache.lastUpdate &&
    (Date.now() - this.cache.lastUpdate) < this.cacheTimeout;
  }

  formatCurrentGamesMessage(games) {
    if (!games || games.length === 0) {
      return {
        text: '😔 Tidak ada game gratis saat ini di Epic Games Store.\n\n💡 Coba lagi nanti atau gunakan /upcoming untuk melihat game yang akan datang.\n\n🔍 Saran fitur? @contactpixelme_bot',
        extra: {
          reply_markup: {
            inline_keyboard: [
              [{
                text: '🔮 Game Upcoming',
                callback_data: 'check_upcoming'
              },
                {
                  text: '🔄 Refresh',
                  callback_data: 'refresh_current'
                }],
              [{
                text: '🌐 Epic Games Store',
                url: 'https://store.epicgames.com/en-US/free-games'
              }]
            ]
          }
        }
      };
    }

    let message = '🎮 <b>Game Gratis Epic Games Saat Ini:</b>\n\n';

    games.forEach((game, index) => {
      const endDate = new Date(game.endDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Clean formatting untuk judul game dengan link
      const gameTitle = game.url ?
      `<a href="${game.url}">${this.escapeHtml(game.title)}</a>`:
      `<b>${this.escapeHtml(game.title)}</b>`;

      message += `${index + 1}. ${gameTitle}\n`;
      message += `📅 Berakhir: ${endDate}\n`;
      message += `💰 Harga Normal: ${game.originalPrice}\n`;

      if (game.description && game.description !== 'No description available') {
        const shortDesc = game.description.length > 100
        ? game.description.substring(0, 100) + '...': game.description;
        message += `📝 ${this.escapeHtml(shortDesc)}\n`;
      }
      message += '\n';
    });

    message += '⚡️ <b>Klaim sebelum berakhir!</b>';

    // Button layout yang compact seperti di screenshot
    const buttons = [];

    // Add game claim buttons jika ada
    games.forEach((game) => {
      if (game.url) {
        const buttonText = game.title.length > 12 ?
        `🎮 ${game.title.substring(0, 9)}...`:
        `🎮 ${game.title}`;
        buttons.push({
          text: buttonText, url: game.url
        });
      }
    });

    // Organize buttons: 2 per row untuk game buttons
    const gameButtonRows = [];
    for (let i = 0; i < buttons.length; i += 2) {
      gameButtonRows.push(buttons.slice(i, i + 2));
    }

    // Navigation buttons layout seperti di screenshot
    const navigationButtons = [
      [{
        text: '🔮 Game Upcoming',
        callback_data: 'check_upcoming'
      },
        {
          text: '🔄 Refresh',
          callback_data: 'refresh_current'
        }],
      [{
        text: '🌐 Epic Games Store',
        url: 'https://store.epicgames.com/en-US/free-games'
      }]
    ];

    const allButtons = [...gameButtonRows,
      ...navigationButtons];

    // Check if we can send with photo
    const firstGame = games[0];
    if (firstGame && firstGame.thumbnail) {
      return {
        photo: firstGame.thumbnail,
        caption: message,
        extra: {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: allButtons
          }
        }
      };
    }

    return {
      text: message,
      extra: {
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: allButtons
        }
      }
    };
  }

  formatUpcomingGamesMessage(games) {
    if (!games || games.length === 0) {
      return {
       text: '📅 Belum ada informasi game gratis yang akan datang.\n\n💡 Epic Games biasanya mengumumkan game gratis seminggu sebelumnya.\n\n🔍 Saran fitur? @contactpixelme_bot',
        extra: {
          reply_markup: {
            inline_keyboard: [
              [{
                text: '🎮 Game Saat Ini',
                callback_data: 'check_current'
              },
                {
                  text: '🔄 Refresh',
                  callback_data: 'refresh_upcoming'
                }],
              [{
                text: '🌐 Epic Games Store',
                url: 'https://store.epicgames.com/en-US/free-games'
              }]
            ]
          }
        }
      };
    }

    let message = '🔮 <b>Game Gratis Epic Games Yang Akan Datang:</b>\n\n';

    games.forEach((game, index) => {
      const startDate = new Date(game.startDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Clean formatting untuk upcoming games
      const storeUrl = game.url || `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(game.title)}`;
      const gameTitle = `<a href="${storeUrl}">${this.escapeHtml(game.title)}</a>`;

      message += `${index + 1}. ${gameTitle}\n`;
      message += `🚀 Mulai: ${startDate}\n`;
      message += `💰 Harga Normal: ${game.originalPrice}\n`;

      if (game.description && game.description !== 'No description available') {
        const shortDesc = game.description.length > 100
        ? game.description.substring(0, 100) + '...': game.description;
        message += `📝 ${this.escapeHtml(shortDesc)}\n`;
      }
      message += '\n';
    });

    message += '⏰ <b>Siapkan reminder!</b>';

    // Reminder buttons seperti di screenshot
    const reminderButtons = [];
    games.forEach((game, index) => {
      const buttonText = game.title.length > 10 ?
      `⚠️ Ingatkan ${game.title.substring(0, 7)}...`:
      `⚠️ Ingatkan ${game.title}`;
      reminderButtons.push({
        text: buttonText,
        callback_data: `remind_${index}_${Buffer.from(game.title).toString('base64').substring(0, 15)}`
      });
    });

    // Organize reminder buttons: 1 per row untuk readability
    const reminderButtonRows = reminderButtons.map(btn => [btn]);

    // Navigation buttons
    const navigationButtons = [
      [{
        text: '🎮 Game Saat Ini', callback_data: 'check_current'
      }, {
        text: '🔄 Refresh', callback_data: 'refresh_upcoming'
      }],
      [{
        text: '🌐 Epic Games Store', url: 'https://store.epicgames.com/en-US/free-games'
      }]
    ];

    const allButtons = [...reminderButtonRows, ...navigationButtons];

    // Check if we can send with photo
    const firstGame = games[0];
    if (firstGame && firstGame.thumbnail) {
      return {
        photo: firstGame.thumbnail,
        caption: message,
        extra: {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: allButtons
          }
        }
      };
    }

    return {
      text: message,
      extra: {
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: allButtons
        }
      }
    };
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  }

  // Store upcoming games untuk reminder functionality
  getUpcomingGameByIndex(index) {
    if (this.cache.upcomingGames && this.cache.upcomingGames[index]) {
      return this.cache.upcomingGames[index];
    }
    return null;
  }

  // Debug method untuk testing API
  async debugAPI() {
    try {
      logger.info('Starting API debug...');

      for (const endpoint of this.apiEndpoints) {
        try {
          const response = await axios.get(endpoint, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          logger.info(`API Debug: ${endpoint}`, null, {
            status: response.status,
            dataType: typeof response.data,
            hasData: !!response.data?.data,
            hasCatalog: !!response.data?.data?.Catalog,
            hasElements: !!response.data?.data?.Catalog?.searchStore?.elements
          });

        } catch (error) {
          logger.error(`API Debug Failed: ${endpoint}`, null, {
            error: error.message
          });
        }
      }

    } catch (error) {
      logger.error('Debug API failed', null, {
        error: error.message
      });
    }
  }
}

module.exports = new EpicService();