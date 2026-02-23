import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../api'
import { formatMonth, formatDate } from '../utils/format'

function AddStudentForm({ navigate }) {
  const [form, setForm] = useState({
    Name: '', 漢字: '', Email: '', Phone: '', Status: 'Active', Payment: 'NEO',
    Group: 'Single', 人数: '', 子: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setErr(null)
    try {
      const { id } = await api.addStudent({
        ...form,
        子: form.子 ? '子' : '',
      })
      navigate(`/students/${id}`)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4">
      <Link to="/students" className="flex items-center gap-2 text-green-600 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Students
      </Link>
      <div className="details-card max-w-xl">
        <h1 className="text-2xl font-bold mb-4">Add Student</h1>
        {err && <p className="text-red-600 mb-4">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              required
              className="w-full border rounded px-3 py-2"
              value={form.Name}
              onChange={(e) => setForm((f) => ({ ...f, Name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">漢字</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.漢字}
              onChange={(e) => setForm((f) => ({ ...f, 漢字: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={form.Email}
              onChange={(e) => setForm((f) => ({ ...f, Email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.Phone}
              onChange={(e) => setForm((f) => ({ ...f, Phone: e.target.value }))}
            />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                className="border rounded px-3 py-2"
                value={form.Status}
                onChange={(e) => setForm((f) => ({ ...f, Status: e.target.value }))}
              >
                <option value="Active">Active</option>
                <option value="Dormant">Dormant</option>
                <option value="DEMO">DEMO</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment</label>
              <select
                className="border rounded px-3 py-2"
                value={form.Payment}
                onChange={(e) => setForm((f) => ({ ...f, Payment: e.target.value }))}
              >
                <option value="NEO">NEO</option>
                <option value="OLD">OLD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
              <select
                className="border rounded px-3 py-2"
                value={form.Group}
                onChange={(e) => setForm((f) => ({ ...f, Group: e.target.value }))}
              >
                <option value="Single">Single</option>
                <option value="Group">Group</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">人数</label>
              <input
                type="number"
                min="2"
                max="4"
                className="w-20 border rounded px-3 py-2"
                value={form.人数}
                onChange={(e) => setForm((f) => ({ ...f, 人数: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isChild"
              checked={form.子}
              onChange={(e) => setForm((f) => ({ ...f, 子: e.target.checked }))}
            />
            <label htmlFor="isChild">子 (Child)</label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Add Student'}
          </button>
        </form>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const cls =
    status === 'Active'
      ? 'badge-status-active'
      : status === 'Dormant'
        ? 'badge-status-dormant'
        : 'badge-status-demo'
  return <span className={`badge ${cls}`}>{status || 'Active'}</span>
}

export default function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [payments, setPayments] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id || id === 'new') {
      setLoading(false)
      return
    }
    Promise.all([
      api.getStudent(id),
      api.getPayments(),
      api.getNotes(id),
    ])
      .then(([s, p, n]) => {
        setStudent(s)
        setPayments((p || []).filter((x) => String(x['Student ID']) === String(id)))
        setNotes(n || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-4">Loading...</div>
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>
  if (!id || id === 'new') {
    return <AddStudentForm navigate={navigate} />
  }
  if (!student) return <div className="p-4">Student not found</div>

  return (
    <div className="p-4">
      <Link
        to="/students"
        className="inline-flex items-center gap-2 text-green-600 hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Students
      </Link>
      <div className="details-card">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {student.Name}
              {student.子 && <span className="badge-child ml-2">子</span>}
            </h1>
            <p className="text-slate-600">{student.漢字}</p>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={student.Status} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-slate-600 text-sm">Email</p>
            <p>{student.Email}</p>
          </div>
          <div>
            <p className="text-slate-600 text-sm">Phone</p>
            <p>{student.Phone}</p>
          </div>
          <div>
            <p className="text-slate-600 text-sm">Payment</p>
            <p>{student.Payment}</p>
          </div>
          <div>
            <p className="text-slate-600 text-sm">Group</p>
            <p>{student.Group} {student.人数 && `(${student.人数})`}</p>
          </div>
        </div>
        <div className="mb-6">
          <h2 className="font-semibold mb-2">Payments</h2>
          <div className="payments-scroll max-h-40 overflow-auto border rounded">
            <table className="table w-full text-sm">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="min-w-[7rem] whitespace-nowrap">Date</th>
                  <th>Month</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 10).map((p) => (
                  <tr key={p['Transaction ID']}>
                    <td className="min-w-[7rem] whitespace-nowrap">{formatDate(p.Date)}</td>
                    <td>{formatMonth(p.Month)}</td>
                    <td>¥{Number(p.Total).toLocaleString()}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-slate-500 text-center py-4">
                      No payments
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="font-semibold mb-2">Notes</h2>
          <div className="notes-scroll max-h-40 overflow-auto border rounded">
            <table className="table w-full text-sm">
              <thead>
                <tr className="bg-green-600 text-white">
                  <th className="min-w-[7rem] whitespace-nowrap">Date</th>
                  <th>Staff</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {notes.slice(0, 10).map((n) => (
                  <tr key={n.ID}>
                    <td className="min-w-[7rem] whitespace-nowrap">{formatDate(n.Date)}</td>
                    <td>{n.Staff}</td>
                    <td>{n.Note}</td>
                  </tr>
                ))}
                {notes.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-slate-500 text-center py-4">
                      No notes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
