import express from 'express';
import crypto from 'crypto';
import logger from '../../shared/utils/logger.js';

const router = express.Router();

// Twitch webhook verification
function verifyTwitchSignature(req, secret) {
  const message = req.headers['twitch-eventsub-message-id'] +
                  req.headers['twitch-eventsub-message-timestamp'] +
                  JSON.stringify(req.body);
  
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = 'sha256=' + hmac.update(message).digest('hex');
  const actualSignature = req.headers['twitch-eventsub-message-signature'];

  return expectedSignature === actualSignature;
}

// Twitch EventSub webhook
router.post('/twitch', async (req, res) => {
  try {
    const messageType = req.headers['twitch-eventsub-message-type'];

    // Verify signature
    if (!verifyTwitchSignature(req, process.env.TWITCH_WEBHOOK_SECRET)) {
      logger.warn('⚠️ Firma de webhook Twitch inválida');
      return res.status(403).send('Invalid signature');
    }

    // Handle webhook challenge
    if (messageType === 'webhook_callback_verification') {
      logger.info('✅ Verificación de webhook Twitch recibida');
      return res.status(200).send(req.body.challenge);
    }

    // Handle notifications
    if (messageType === 'notification') {
      const { subscription, event } = req.body;

      switch (subscription.type) {
        case 'stream.online':
          await handleStreamOnline(event);
          break;
        case 'stream.offline':
          await handleStreamOffline(event);
          break;
        default:
          logger.info(`📬 Webhook Twitch recibido: ${subscription.type}`);
      }

      return res.status(200).send('OK');
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('❌ Error procesando webhook Twitch:', error);
    res.status(500).send('Internal Server Error');
  }
});

async function handleStreamOnline(event) {
  logger.info(`🔴 Stream online: ${event.broadcaster_user_name}`);
  // This would trigger the stream monitor to check the stream
}

async function handleStreamOffline(event) {
  logger.info(`⚫ Stream offline: ${event.broadcaster_user_name}`);
  // This would trigger the stream monitor to update status
}

// YouTube webhook (PubSubHubbub)
router.post('/youtube', async (req, res) => {
  try {
    logger.info('📬 Webhook YouTube recibido');
    // YouTube webhook handling
    res.status(200).send('OK');
  } catch (error) {
    logger.error('❌ Error procesando webhook YouTube:', error);
    res.status(500).send('Internal Server Error');
  }
});

// YouTube webhook verification
router.get('/youtube', (req, res) => {
  const challenge = req.query['hub.challenge'];
  if (challenge) {
    res.status(200).send(challenge);
  } else {
    res.status(400).send('No challenge');
  }
});

export default router;
