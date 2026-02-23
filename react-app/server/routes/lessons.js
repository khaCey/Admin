import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { student_id, month } = req.query;
    let sql = 'SELECT * FROM lessons WHERE 1=1';
    const params = [];
    let i = 1;
    if (student_id) {
      sql += ` AND student_id = $${i++}`;
      params.push(student_id);
    }
    if (month) {
      sql += ` AND month = $${i++}`;
      params.push(month);
    }
    sql += ' ORDER BY month DESC';
    const result = await query(sql, params);
    res.json(result.rows.map((r) => ({
      'Student ID': r.student_id,
      Month: r.month,
      Lessons: r.lessons,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body;
    await query(
      `INSERT INTO lessons (student_id, month, lessons)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_id, month) DO UPDATE SET lessons = EXCLUDED.lessons`,
      [
        body['Student ID'] ?? body.student_id,
        body.Month ?? body.month,
        body.Lessons ?? body.lessons ?? 0,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
