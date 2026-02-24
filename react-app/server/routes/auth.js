/**
 * Auth routes: login, logout, me
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'student-admin-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h'; // 8-hour shift

router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body || {};
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password required' });
    }
    const result = await query(
      'SELECT id, name, password_hash FROM staff WHERE name = $1',
      [String(name).trim()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid name or password' });
    }
    const staff = result.rows[0];
    const ok = await bcrypt.compare(password, staff.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid name or password' });
    }
    const token = jwt.sign(
      { id: staff.id, name: staff.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    res.json({ token, staff: { id: staff.id, name: staff.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await query('SELECT id, name FROM staff WHERE id = $1', [payload.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Staff not found' });
    }
    res.json({ staff: { id: result.rows[0].id, name: result.rows[0].name } });
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
