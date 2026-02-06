import express from 'express';

const router = express.Router();

// Admin routes placeholder
router.get('/dashboard', (req, res) => {
  res.json({ message: 'Admin dashboard' });
});

router.get('/settings', (req, res) => {
  res.json({ message: 'Admin settings' });
});

export default router;
