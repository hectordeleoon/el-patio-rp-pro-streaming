import logger from '../../shared/utils/logger.js';

/**
 * Validate if a stream meets RP requirements
 */
export async function validateRPStream(streamData) {
  try {
    const {
      game,
      title,
      tags = [],
      language,
    } = streamData;

    // 1. Check allowed games
    const allowedGames = (process.env.RP_ALLOWED_GAMES || 'Grand Theft Auto V,GTA V')
      .split(',')
      .map((g) => g.trim().toLowerCase());

    const gameNormalized = (game || '').toLowerCase();
    const isAllowedGame = allowedGames.some((allowed) =>
      gameNormalized.includes(allowed)
    );

    if (!isAllowedGame) {
      logger.warn(`⚠️ Juego no permitido: ${game}`);
      return false;
    }

    // 2. Check banned categories (e.g., Just Chatting)
    const bannedCategories = (process.env.RP_BANNED_CATEGORIES || 'Just Chatting')
      .split(',')
      .map((c) => c.trim().toLowerCase());

    const isBannedCategory = bannedCategories.some((banned) =>
      gameNormalized.includes(banned)
    );

    if (isBannedCategory) {
      logger.warn(`⚠️ Categoría baneada detectada: ${game}`);
      return false;
    }

    // 3. Check required keywords in title
    const requiredKeywords = (process.env.RP_REQUIRED_KEYWORDS || 'El Patio,Patio RP')
      .split(',')
      .map((k) => k.trim().toLowerCase());

    const titleNormalized = (title || '').toLowerCase();
    const hasRequiredKeyword = requiredKeywords.some((keyword) =>
      titleNormalized.includes(keyword)
    );

    if (!hasRequiredKeyword && requiredKeywords.length > 0) {
      logger.warn(`⚠️ Título sin palabras clave requeridas: ${title}`);
      return false;
    }

    // 4. Optional: Check tags
    const rpTags = ['roleplay', 'rp', 'gta rp', 'gtarp'];
    const tagsNormalized = tags.map((t) => t.toLowerCase());
    const hasRPTag = rpTags.some((rpTag) =>
      tagsNormalized.some((tag) => tag.includes(rpTag))
    );

    logger.info(`✅ Stream validado: ${streamData.streamer_name}`, {
      game,
      hasRequiredKeyword,
      hasRPTag,
    });

    return true;
  } catch (error) {
    logger.error('❌ Error validando stream RP:', error);
    return false; // Fail closed - don't process if validation fails
  }
}

/**
 * Check if game changed to non-RP
 */
export function isGameChangeInvalid(previousGame, newGame) {
  const allowedGames = (process.env.RP_ALLOWED_GAMES || 'Grand Theft Auto V,GTA V')
    .split(',')
    .map((g) => g.trim().toLowerCase());

  const previousValid = allowedGames.some((allowed) =>
    (previousGame || '').toLowerCase().includes(allowed)
  );

  const newValid = allowedGames.some((allowed) =>
    (newGame || '').toLowerCase().includes(allowed)
  );

  // If was valid RP and now isn't, it's invalid
  return previousValid && !newValid;
}

export default {
  validateRPStream,
  isGameChangeInvalid,
};
