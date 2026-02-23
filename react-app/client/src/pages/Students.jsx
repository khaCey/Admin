import { useState, useEffect } from 'react'
import { api } from '../api'
import StudentDetailsModal from '../components/StudentDetailsModal'

function StatusBadge({ status }) {
  const cls =
    status === 'Active'
      ? 'badge-status-active'
      : status === 'Dormant'
        ? 'badge-status-dormant'
        : 'badge-status-demo'
  return <span className={`badge ${cls}`}>{status || 'Active'}</span>
}

function PaymentBadge({ payment }) {
  const cls = payment === 'NEO' ? 'badge-pay-neo' : 'badge-pay-old'
  return <span className={`badge ${cls}`}>{payment || 'NEO'}</span>
}

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(null)

  useEffect(() => {
    api
      .getStudents()
      .then(setStudents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = students.filter(
    (s) =>
      !search ||
      (s.Name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.漢字 || '').includes(search) ||
      (s.Email || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.Phone || '').includes(search)
  )

  const headerAndSearch = (
    <>
      <div className="flex justify-between items-center pt-3 pb-2 mb-3 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Student List</h2>
      </div>
      <div className="mb-4 search-container">
        <label htmlFor="searchInput" className="sr-only">Search</label>
        <input
          id="searchInput"
          type="search"
          placeholder="Search by name, kana, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          style={{ fontSize: '1.5rem', height: '3.5rem' }}
        />
      </div>
    </>
  );

  return (
    <div className="w-full flex flex-col">
      {headerAndSearch}
      {loading && <div className="py-8 text-slate-500">Loading...</div>}
      {error && (
        <div className="py-4 text-red-600">
          {/postgres|connection|ECONNREFUSED|28P01|password/i.test(error)
            ? 'Database connection failed. Check PostgreSQL is running and .env has correct DATABASE_URL. Restart the API server.'
            : `Error: ${error}`}
        </div>
      )}
      {!loading && !error && (
      <>
      <div className="relative overflow-auto max-h-[70vh] w-full rounded-xl border border-black/5 bg-white shadow-sm">
        <table id="studentTable" className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 bg-green-600 text-white shadow">
            <tr>
              <th className="px-3 py-2 text-center font-semibold">ID</th>
              <th className="px-3 py-2 text-left font-semibold">Name</th>
              <th className="px-3 py-2 text-center font-semibold">漢字</th>
              <th className="px-3 py-2 text-center font-semibold">子</th>
              <th className="px-3 py-2 text-center font-semibold">email</th>
              <th className="px-3 py-2 text-center font-semibold">phone</th>
              <th className="px-3 py-2 text-center font-semibold">当日 Cancellation</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
              <th className="px-3 py-2 text-center font-semibold">Payment</th>
              <th className="px-3 py-2 text-center font-semibold">Group</th>
              <th className="px-3 py-2 text-center font-semibold">人数</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.ID}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedStudentId(s.ID)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedStudentId(s.ID)}
                className="cursor-pointer"
              >
                <td className="text-center px-3 py-2">{s.ID}</td>
                <td className="text-left px-3 py-2">
                  <span className="text-green-700 hover:underline font-medium">
                    {s.Name}
                  </span>
                </td>
                <td className="text-center px-3 py-2">{s.漢字}</td>
                <td className="text-center px-3 py-2">{s.子 ? '子' : ''}</td>
                <td className="text-center px-3 py-2">{s.Email}</td>
                <td className="text-center px-3 py-2">{s.Phone}</td>
                <td className="text-center px-3 py-2">{s.当日}</td>
                <td className="text-center px-3 py-2">
                  <StatusBadge status={s.Status} />
                </td>
                <td className="text-center px-3 py-2">
                  <PaymentBadge payment={s.Payment} />
                </td>
                <td className="text-center px-3 py-2">{s.Group}</td>
                <td className="text-center px-3 py-2">{s.人数}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-slate-600 text-sm">
        {filtered.length} student{filtered.length !== 1 ? 's' : ''}
      </p>
      </>
      )}
      {selectedStudentId && (
        <StudentDetailsModal
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          onStudentDeleted={fetchStudents}
        />
      )}
    </div>
  )
}
