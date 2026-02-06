import Queue from 'bull';
import ffmpeg from 'fluent-ffmpeg';
import { createClient } from '@deepgram/sdk';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs/promises';
import logger from '../../shared/utils/logger.js';
import { getModels } from '../../shared/database/models/index.js';
import { calculateViralScore } from '../utils/viralScore.js';
import { addSubtitles, addEffects, addBranding } from '../utils/videoEditor.js';
import { convertToVertical } from '../utils/videoConverter.js';
import { redisClient } from '../../shared/cache/redis.js';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const deepgram = process.env.DEEPGRAM_API_KEY 
  ? createClient(process.env.DEEPGRAM_API_KEY)
  : null;

// Create clip processing queue
const clipQueue = new Queue('clip-processing', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
  },
  settings: {
    maxStalledCount: 3,
    stalledInterval: 30000,
  },
});

class ClipProcessor {
  constructor() {
    this.processingClips = new Map();
    this.tempDir = process.env.CLIP_STORAGE_PATH || '/tmp/clips';
  }

  async initialize() {
    // Ensure temp directory exists
    await fs.mkdir(this.tempDir, { recursive: true });

    // Setup queue processors
    clipQueue.process('generate', 5, this.processClipGeneration.bind(this));
    clipQueue.process('edit', 3, this.processClipEditing.bind(this));
    clipQueue.process('convert', 2, this.processClipConversion.bind(this));

    // Event handlers
    clipQueue.on('completed', (job) => {
      logger.info(`✅ Clip job completed: ${job.id}`);
    });

    clipQueue.on('failed', (job, err) => {
      logger.error(`❌ Clip job failed: ${job.id}`, err);
    });

    logger.info('✅ Clip Processor inicializado');
  }

  async queueClipGeneration(streamData, trigger) {
    const job = await clipQueue.add('generate', {
      stream_id: streamData.id,
      streamer_id: streamData.streamer_id,
      trigger,
      timestamp: Date.now(),
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    logger.info(`📝 Clip generation queued: Job ${job.id}`);
    return job;
  }

  async processClipGeneration(job) {
    const { stream_id, streamer_id, trigger } = job.data;

    try {
      logger.info(`🎬 Generando clip para stream ${stream_id}...`);

      // Get stream URL and download segment
      const streamUrl = await this.getStreamUrl(stream_id);
      const duration = parseInt(process.env.CLIP_DEFAULT_DURATION) || 30;
      
      const clipPath = path.join(
        this.tempDir,
        `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
      );

      // Capture clip using FFmpeg
      await this.captureClip(streamUrl, clipPath, duration);

      // Analyze clip content
      const analysis = await this.analyzeClip(clipPath);

      // Calculate viral score
      const viralScore = await calculateViralScore({
        ...analysis,
        duration,
        trigger,
      });

      // Get models
      const { Clip } = getModels();

      // Create clip record in database
      const clip = await Clip.create({
        streamer_id,
        stream_id,
        title: analysis.suggestedTitle || 'Clip sin título',
        description: analysis.description,
        duration,
        file_path: clipPath,
        viral_score: viralScore,
        metadata: {
          trigger,
          analysis,
          detected_actions: analysis.actions || [],
          audio_peaks: analysis.audioPeaks || [],
        },
        status: 'processing',
      });

      logger.info(`✅ Clip generado: ${clip.id} (Viral Score: ${viralScore})`);

      // Queue for editing
      await clipQueue.add('edit', { clip_id: clip.id });

      return clip;
    } catch (error) {
      logger.error('❌ Error generando clip:', error);
      throw error;
    }
  }

  async processClipEditing(job) {
    const { clip_id } = job.data;

    try {
      logger.info(`✂️ Editando clip ${clip_id}...`);

      const { Clip } = getModels();
      const clip = await Clip.findByPk(clip_id);
      if (!clip) throw new Error('Clip no encontrado');

      const inputPath = clip.file_path;
      const outputPath = inputPath.replace('.mp4', '_edited.mp4');

      // Step 1: Transcribe audio for subtitles
      const transcription = await this.transcribeAudio(inputPath);

      // Step 2: Generate subtitles file
      const subtitlesPath = await this.generateSubtitles(transcription, clip.id);

      // Step 3: Add subtitles to video
      let currentPath = await addSubtitles(inputPath, subtitlesPath);

      // Step 4: Add effects (zoom, shake, flashes)
      currentPath = await addEffects(currentPath, clip.metadata.analysis);

      // Step 5: Add branding and overlays
      currentPath = await addBranding(currentPath);

      // Step 6: Generate hook (first 2-3 seconds)
      const hook = await this.generateHook(currentPath);

      // Update clip with edited version
      await clip.update({
        file_path: currentPath,
        edited_file_path: currentPath,
        subtitles_path: subtitlesPath,
        hook_file_path: hook,
        status: 'edited',
        metadata: {
          ...clip.metadata,
          transcription,
          edited: true,
        },
      });

      logger.info(`✅ Clip editado: ${clip.id}`);

      // Queue for conversion to different formats
      await clipQueue.add('convert', { clip_id: clip.id });

      // Emit WebSocket event
      if (global.io) {
        global.io.to('clips').emit('clip:edited', clip.toJSON());
      }

      return clip;
    } catch (error) {
      logger.error('❌ Error editando clip:', error);
      throw error;
    }
  }

  async processClipConversion(job) {
    const { clip_id } = job.data;

    try {
      logger.info(`🔄 Convirtiendo clip ${clip_id}...`);

      const { Clip } = getModels();
      const clip = await Clip.findByPk(clip_id);
      if (!clip) throw new Error('Clip no encontrado');

      const conversions = {
        horizontal: clip.edited_file_path, // Original 16:9
        vertical: null, // 9:16 for TikTok/IG/Shorts
        square: null, // 1:1 for Instagram feed
      };

      // Convert to vertical (9:16)
      conversions.vertical = await convertToVertical(
        clip.edited_file_path,
        '9:16'
      );

      // Convert to square (1:1)
      conversions.square = await convertToVertical(
        clip.edited_file_path,
        '1:1'
      );

      // Update clip with all versions
      await clip.update({
        horizontal_file_path: conversions.horizontal,
        vertical_file_path: conversions.vertical,
        square_file_path: conversions.square,
        status: 'ready',
      });

      logger.info(`✅ Clip convertido: ${clip.id}`);

      // Check if should auto-publish
      await this.checkAutoPublish(clip);

      // Emit WebSocket event
      if (global.io) {
        global.io.to('clips').emit('clip:ready', clip.toJSON());
      }

      return clip;
    } catch (error) {
      logger.error('❌ Error convirtiendo clip:', error);
      throw error;
    }
  }

  async captureClip(streamUrl, outputPath, duration) {
    return new Promise((resolve, reject) => {
      ffmpeg(streamUrl)
        .setDuration(duration)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset medium',
          '-crf 23',
          '-movflags +faststart',
        ])
        .output(outputPath)
        .on('end', () => {
          logger.info('✅ Clip capturado exitosamente');
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('❌ Error capturando clip:', err);
          reject(err);
        })
        .run();
    });
  }

  async analyzeClip(clipPath) {
    try {
      // Extract audio for analysis
      const audioPath = clipPath.replace('.mp4', '.wav');
      
      await new Promise((resolve, reject) => {
        ffmpeg(clipPath)
          .audioCodec('pcm_s16le')
          .output(audioPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Analyze with OpenAI Vision API (for future frame analysis)
      // For now, using basic analysis

      const analysis = {
        suggestedTitle: 'Clip automático',
        description: 'Momento destacado del stream',
        actions: ['general'],
        audioPeaks: [],
        hasHighAction: false,
        hasDialog: true,
        sentiment: 'neutral',
      };

      return analysis;
    } catch (error) {
      logger.error('❌ Error analizando clip:', error);
      return {
        suggestedTitle: 'Clip automático',
        description: 'Clip generado automáticamente',
        actions: [],
        audioPeaks: [],
      };
    }
  }

  async transcribeAudio(videoPath) {
    if (!deepgram) {
      logger.warn('⚠️  Deepgram no configurado, saltando transcripción');
      return null;
    }

    try {
      // Extract audio
      const audioPath = videoPath.replace('.mp4', '.wav');
      
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .audioCodec('pcm_s16le')
          .audioChannels(1)
          .audioFrequency(16000)
          .output(audioPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Transcribe with Deepgram
      const audioBuffer = await fs.readFile(audioPath);
      const { result } = await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          language: 'es',
          punctuate: true,
          utterances: true,
        }
      );

      // Clean up audio file
      await fs.unlink(audioPath);

      return result;
    } catch (error) {
      logger.error('❌ Error transcribiendo audio:', error);
      return null;
    }
  }

  async generateSubtitles(transcription, clipId) {
    if (!transcription) return null;

    try {
      const srtPath = path.join(this.tempDir, `subtitles_${clipId}.srt`);
      let srtContent = '';
      let index = 1;

      for (const utterance of transcription.results.utterances) {
        const start = utterance.start;
        const end = utterance.end;
        const text = utterance.transcript;

        srtContent += `${index}\n`;
        srtContent += `${this.formatSrtTime(start)} --> ${this.formatSrtTime(end)}\n`;
        srtContent += `${text}\n\n`;
        index++;
      }

      await fs.writeFile(srtPath, srtContent);
      return srtPath;
    } catch (error) {
      logger.error('❌ Error generando subtítulos:', error);
      return null;
    }
  }

  formatSrtTime(seconds) {
    const date = new Date(seconds * 1000);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const secs = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${secs},${ms}`;
  }

  async generateHook(videoPath) {
    // Generate a 3-second hook version
    const hookPath = videoPath.replace('.mp4', '_hook.mp4');

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(0)
        .setDuration(3)
        .output(hookPath)
        .on('end', () => resolve(hookPath))
        .on('error', reject)
        .run();
    });
  }

  async checkAutoPublish(clip) {
    const threshold = parseInt(process.env.VIRAL_SCORE_AUTO_PUBLISH_THRESHOLD) || 80;

    if (clip.viral_score >= threshold) {
      logger.info(`🚀 Auto-publicando clip ${clip.id} (Score: ${clip.viral_score})`);
      // Queue for publication (implemented in publicationService)
      const { queuePublication } = await import('./publicationService.js');
      await queuePublication(clip);
    } else if (clip.viral_score >= 50) {
      logger.info(`⏳ Clip ${clip.id} requiere aprobación manual (Score: ${clip.viral_score})`);
      await clip.update({ status: 'pending_approval' });
    } else {
      logger.info(`❌ Clip ${clip.id} rechazado por bajo viral score (${clip.viral_score})`);
      await clip.update({ status: 'rejected' });
    }
  }

  async getStreamUrl(streamId) {
    // This would fetch the actual stream URL from the streaming platform
    // Implementation depends on platform APIs
    return 'https://example.com/stream.m3u8';
  }
}

const clipProcessor = new ClipProcessor();

export const startClipProcessor = async () => {
  await clipProcessor.initialize();
  logger.info('✅ Clip Processor iniciado');
};

export const generateClip = (streamData, trigger) => {
  return clipProcessor.queueClipGeneration(streamData, trigger);
};

export default clipProcessor;
