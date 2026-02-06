import ffmpeg from 'fluent-ffmpeg';
import logger from '../../shared/utils/logger.js';

/**
 * Convert video to vertical format (9:16 for TikTok, Instagram Reels, YouTube Shorts)
 */
export async function convertToVertical(videoPath, aspectRatio = '9:16') {
  return new Promise((resolve, reject) => {
    const outputPath = videoPath.replace('.mp4', `_${aspectRatio.replace(':', 'x')}.mp4`);

    let dimensions;
    if (aspectRatio === '9:16') {
      dimensions = '1080:1920'; // Vertical
    } else if (aspectRatio === '1:1') {
      dimensions = '1080:1080'; // Square
    } else {
      dimensions = '1920:1080'; // Horizontal (default)
    }

    logger.info(`🔄 Convirtiendo video a formato ${aspectRatio}...`);

    ffmpeg(videoPath)
      .outputOptions([
        // Smart reframing: crop and scale to center the action
        `-vf scale=${dimensions}:force_original_aspect_ratio=increase,crop=${dimensions}`,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart'
      ])
      .output(outputPath)
      .on('end', () => {
        logger.info(`✅ Video convertido a ${aspectRatio}: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error(`❌ Error convirtiendo a ${aspectRatio}:`, err);
        reject(err);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          logger.debug(`Progreso: ${Math.round(progress.percent)}%`);
        }
      })
      .run();
  });
}

/**
 * Optimize video for web (compression)
 */
export async function optimizeForWeb(videoPath) {
  return new Promise((resolve, reject) => {
    const outputPath = videoPath.replace('.mp4', '_optimized.mp4');

    ffmpeg(videoPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '26', // Higher CRF = more compression
        '-c:a', 'aac',
        '-b:a', '96k',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p'
      ])
      .output(outputPath)
      .on('end', () => {
        logger.info('✅ Video optimizado para web');
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Generate thumbnail from video
 */
export async function generateThumbnail(videoPath, timestamp = '00:00:02') {
  return new Promise((resolve, reject) => {
    const outputPath = videoPath.replace('.mp4', '_thumb.jpg');

    ffmpeg(videoPath)
      .screenshots({
        timestamps: [timestamp],
        filename: outputPath,
        size: '1920x1080'
      })
      .on('end', () => {
        logger.info('✅ Thumbnail generado');
        resolve(outputPath);
      })
      .on('error', reject);
  });
}

export default {
  convertToVertical,
  optimizeForWeb,
  generateThumbnail,
};
