import { Router } from 'express';
import jwt         from 'jsonwebtoken';

export const router = Router();

/**
 * POST /api/auth/login
 * Body: { pin: "1234" }
 * Returns: { token }
 *
 * The PIN is stored in .env as APP_PIN.  A JWT is issued on success.
 */
router.post('/login', (req, res) => {
  const { pin } = req.body;
  const correct = process.env.APP_PIN || '1234';

  if (!pin || String(pin) !== String(correct)) {
    return res.status(401).json({ error: 'Wrong PIN' });
  }

  const secret = process.env.JWT_SECRET || 'winny_secret';
  const token  = jwt.sign({ sub: 'winny_user' }, secret, { expiresIn: '30d' });

  res.json({ token });
});
