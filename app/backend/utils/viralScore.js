import logger from '../../shared/utils/logger.js';

/**
 * Calculate viral score (0-100) based on multiple factors
 */
export async function calculateViralScore(clipData) {
  try {
    let score = 0;
    const weights = {
      action: 25,
      audio: 20,
      duration: 15,
      dialog: 15,
      timing: 10,
      keywords: 15,
    };

    // 1. Action Score (0-25 points)
    const actionScore = calculateActionScore(clipData);
    score += actionScore * (weights.action / 100);

    // 2. Audio Score (0-20 points)
    const audioScore = calculateAudioScore(clipData);
    score += audioScore * (weights.audio / 100);

    // 3. Duration Score (0-15 points)
    const durationScore = calculateDurationScore(clipData.duration);
    score += durationScore * (weights.duration / 100);

    // 4. Dialog Score (0-15 points)
    const dialogScore = calculateDialogScore(clipData);
    score += dialogScore * (weights.dialog / 100);

    // 5. Timing Score (0-10 points)
    const timingScore = calculateTimingScore(clipData);
    score += timingScore * (weights.timing / 100);

    // 6. Keywords Score (0-15 points)
    const keywordsScore = calculateKeywordsScore(clipData);
    score += keywordsScore * (weights.keywords / 100);

    // Normalize to 0-100
    score = Math.round(Math.max(0, Math.min(100, score * 100)));

    logger.info(`📊 Viral Score calculado: ${score}/100`, {
      actionScore,
      audioScore,
      durationScore,
      dialogScore,
      timingScore,
      keywordsScore,
    });

    return score;
  } catch (error) {
    logger.error('❌ Error calculando viral score:', error);
    return 50; // Default score
  }
}

function calculateActionScore(clipData) {
  const { analysis } = clipData;
  if (!analysis) return 0.5;

  let score = 0;

  // High action keywords
  const highActionKeywords = [
    'chase', 'persecución', 'robo', 'robbery', 'shoot', 'disparo',
    'crash', 'accidente', 'fight', 'pelea', 'explosion', 'escape'
  ];

  const detectedActions = analysis.actions || [];
  const hasHighAction = detectedActions.some(action =>
    highActionKeywords.some(keyword => action.toLowerCase().includes(keyword))
  );

  if (hasHighAction) {
    score += 0.6;
  } else if (detectedActions.length > 0) {
    score += 0.3;
  }

  // Movement analysis
  if (analysis.hasHighAction) {
    score += 0.4;
  }

  return Math.min(1, score);
}

function calculateAudioScore(clipData) {
  const { analysis } = clipData;
  if (!analysis) return 0.5;

  let score = 0;

  // Audio peaks indicate exciting moments
  const audioPeaks = analysis.audioPeaks || [];
  if (audioPeaks.length >= 3) {
    score += 0.5;
  } else if (audioPeaks.length > 0) {
    score += 0.3;
  }

  // Dialog presence
  if (analysis.hasDialog) {
    score += 0.3;
  }

  // Sentiment (excitement, humor, surprise)
  if (analysis.sentiment === 'positive' || analysis.sentiment === 'excited') {
    score += 0.2;
  }

  return Math.min(1, score);
}

function calculateDurationScore(duration) {
  // Optimal duration: 20-40 seconds for social media
  // Perfect: 30 seconds
  const optimal = 30;
  const deviation = Math.abs(duration - optimal);

  if (deviation === 0) return 1;
  if (deviation <= 5) return 0.9;
  if (deviation <= 10) return 0.7;
  if (deviation <= 15) return 0.5;
  return 0.3;
}

function calculateDialogScore(clipData) {
  const { analysis, transcription } = clipData;
  if (!analysis) return 0.5;

  let score = 0;

  // Has clear dialog
  if (analysis.hasDialog) {
    score += 0.4;
  }

  // Transcription quality
  if (transcription && transcription.results) {
    const words = transcription.results.channels?.[0]?.alternatives?.[0]?.words || [];
    const confidence = words.reduce((acc, w) => acc + (w.confidence || 0), 0) / words.length;
    
    if (confidence >= 0.8) {
      score += 0.3;
    } else if (confidence >= 0.6) {
      score += 0.2;
    }
  }

  // Interesting phrases
  const interestingPhrases = [
    'no mames', 'qué pasa', 'cuidado', 'vamos', 'dale', 'corre',
    'policía', 'está loco', 'increíble'
  ];

  if (transcription) {
    const transcript = transcription.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const hasInteresting = interestingPhrases.some(phrase =>
      transcript.toLowerCase().includes(phrase)
    );
    
    if (hasInteresting) {
      score += 0.3;
    }
  }

  return Math.min(1, score);
}

function calculateTimingScore(clipData) {
  const { trigger } = clipData;
  
  // Manual triggers (commands) tend to catch better moments
  if (trigger === 'command') {
    return 0.8;
  }

  // AI-detected action moments
  if (trigger === 'action_detection') {
    return 0.9;
  }

  // Audio-based triggers
  if (trigger === 'audio_peak') {
    return 0.7;
  }

  // Automatic periodic captures
  if (trigger === 'periodic') {
    return 0.4;
  }

  return 0.5;
}

function calculateKeywordsScore(clipData) {
  const { analysis, transcription } = clipData;
  let score = 0;

  // Viral keywords for GTA RP
  const viralKeywords = [
    // Spanish
    'robo', 'policía', 'persecución', 'escape', 'tiroteo', 'accidente',
    'loco', 'increíble', 'épico', 'fail', 'win',
    // English
    'robbery', 'police', 'chase', 'escape', 'shooting', 'crash',
    'crazy', 'amazing', 'epic', 'fail', 'win'
  ];

  if (transcription) {
    const transcript = transcription.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const lowerTranscript = transcript.toLowerCase();

    let keywordCount = 0;
    viralKeywords.forEach(keyword => {
      if (lowerTranscript.includes(keyword)) {
        keywordCount++;
      }
    });

    // More keywords = better
    if (keywordCount >= 3) {
      score += 0.7;
    } else if (keywordCount >= 2) {
      score += 0.5;
    } else if (keywordCount >= 1) {
      score += 0.3;
    }
  }

  // Check title/description
  const title = analysis?.suggestedTitle || '';
  const description = analysis?.description || '';
  const combined = `${title} ${description}`.toLowerCase();

  viralKeywords.forEach(keyword => {
    if (combined.includes(keyword)) {
      score += 0.05;
    }
  });

  return Math.min(1, score);
}

/**
 * Get score category
 */
export function getScoreCategory(score) {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 50) return 'average';
  if (score >= 35) return 'below_average';
  return 'poor';
}

/**
 * Get recommendation based on score
 */
export function getScoreRecommendation(score) {
  if (score >= 80) {
    return {
      action: 'auto_publish',
      message: '¡Excelente clip! Auto-publicación recomendada.',
    };
  }
  if (score >= 50) {
    return {
      action: 'manual_review',
      message: 'Clip decente. Revisar manualmente antes de publicar.',
    };
  }
  return {
    action: 'reject',
    message: 'Clip de bajo rendimiento. No se recomienda publicar.',
  };
}

export default {
  calculateViralScore,
  getScoreCategory,
  getScoreRecommendation,
};
