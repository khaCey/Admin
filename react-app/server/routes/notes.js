import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { student_id } = req.query;
    let sql = 'SELECT * FROM notes';
    const params = [];
    if (student_id) {
      sql += ' WHERE student_id = $1';
      params.push(student_id);
    }
    sql += ' ORDER BY date DESC';
    const result = await query(sql, params);
    res.json(result.rows.map((r) => ({
      ID: r.id,
      'Student ID': r.student_id,
      Staff: r.staff,
      Date: r.date,
      Note: r.note,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const result = await query(
      `INSERT INTO notes (student_id, staff, note, date)
       VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()))
       RETURNING id`,
      [
        body['Student ID'] ?? body.student_id,
        body.Staff ?? body.staff ?? '',
        body.Note ?? body.note ?? '',
        body.Date ?? body.date ?? null,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    await query(
      `UPDATE notes SET staff = COALESCE($2, staff), note = COALESCE($3, note), date = COALESCE($4::timestamptz, date)
       WHERE id = $1`,
      [
        id,
        body.Staff ?? body.staff,
        body.Note ?? body.note,
        body.Date ?? body.date,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM notes WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
