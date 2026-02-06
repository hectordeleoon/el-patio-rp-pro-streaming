import jwt from 'jsonwebtoken';
import logger from '../../shared/utils/logger.js';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('❌ Error de autenticación:', error);
    return res.status(401).json({ error: 'Token inválido' });
  }
};

export default authMiddleware;
