import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    const [studentsResult, paymentsResult, statsResult] = await Promise.all([
      query('SELECT COUNT(*) as count FROM students'),
      query(
        `SELECT COALESCE(SUM(total), 0) as total FROM payments WHERE month = $1 OR (year = $2 AND month = $1)`,
        [thisMonth, String(now.getFullYear())]
      ),
      query('SELECT * FROM stats WHERE month = $1 OR month = $2', [thisMonth, lastMonth]),
    ]);

    const studentCount = parseInt(studentsResult.rows[0]?.count || 0, 10);
    const feesThisMonth = parseFloat(paymentsResult.rows[0]?.total || 0);
    const statsByMonth = {};
    for (const r of statsResult.rows) {
      statsByMonth[r.month] = { lessons: r.lessons, students: r.students };
    }

    res.json({
      studentCount,
      feesThisMonth,
      lessonsThisMonth: statsByMonth[thisMonth]?.lessons ?? 0,
      studentsThisMonth: statsByMonth[thisMonth]?.students ?? 0,
      lessonsLastMonth: statsByMonth[lastMonth]?.lessons ?? 0,
      studentsLastMonth: statsByMonth[lastMonth]?.students ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
