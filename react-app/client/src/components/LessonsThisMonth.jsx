import { useState, useEffect } from 'react'
import { api } from '../api'
import LessonDetailsModal from './LessonDetailsModal'

const DOW = ['日', '月', '火', '水', '木', '金', '土']

const CARD_STYLES = {
  scheduled: { accent: 'bg-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-600', hoverRing: 'hover:ring-emerald-500/60' },
  cancelled: { accent: 'bg-slate-500', bg: 'bg-slate-50', dot: 'bg-slate-500', hoverRing: 'hover:ring-slate-500/60' },
  rescheduled: { accent: 'bg-amber-500', bg: 'bg-amber-50', dot: 'bg-amber-500', hoverRing: 'hover:ring-amber-500/60' },
  demo: { accent: 'bg-orange-500', bg: 'bg-orange-50', dot: 'bg-orange-500', hoverRing: 'hover:ring-orange-500/60' },
  unscheduled: { accent: 'bg-red-500', bg: 'bg-red-50', dot: 'bg-red-500', hoverRing: 'hover:ring-red-500/60' },
}

function LessonCard({ lesson, year, monthIndex, onClick }) {
  const isUnscheduled = lesson.status === 'unscheduled'
  const dayNum = parseInt(lesson.day, 10)
  const date = !isNaN(dayNum) && year != null && monthIndex >= 0
    ? new Date(year, monthIndex, dayNum)
    : null
  const dow = date && !isNaN(date.getTime()) ? DOW[date.getDay()] : ''
  const dayStr = isUnscheduled ? '--' : (lesson.day && lesson.day !== '--' ? `${parseInt(lesson.day)}日` : '--')
  const timeStr = isUnscheduled ? '--' : (lesson.time ? lesson.time.replace(':', '：') : '--')
  const title = (lesson.status || '').charAt(0).toUpperCase() + (lesson.status || '').slice(1)
  const styles = CARD_STYLES[lesson.status] || CARD_STYLES.cancelled

  return (
    <button
      type="button"
      onClick={() => onClick?.(lesson)}
      className={`lr-card group relative inline-flex items-start gap-2 rounded-xl border border-gray-200 ${styles.bg} px-3 py-2 w-full text-left shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-inset ${styles.hoverRing} cursor-pointer`}
      data-status={lesson.status}
      aria-label={`Lesson ${dayStr} ${timeStr} (${title})`}
    >
      <span className={`absolute left-0 top-0 h-full w-1.5 rounded-l-xl ${styles.accent}`} />
      <span className="mt-0.5 flex-1 min-w-0">
        <span className="block lr-date text-[0.9rem] font-semibold leading-none">
          {dayStr}
          {dow && <span className="lr-dow text-[0.7rem] font-semibold text-gray-500 ml-1.5">{dow}</span>}
        </span>
        <span className="block lr-time text-[0.75rem] leading-tight text-gray-500 mt-0.5 tabular-nums">{timeStr}</span>
        <span className="lr-status inline-flex items-center text-[0.7rem] text-gray-500 mt-1">
          <span className={`mr-1 h-2 w-2 rounded-full ${styles.dot}`} />
          {title}
        </span>
      </span>
    </button>
  )
}

function useLatestByMonth(studentId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeMonth, setActiveMonth] = useState(null)

  const fetchData = () => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    api
      .getStudentLatestByMonth(studentId)
      .then((res) => {
        const latest = res.latestByMonth || {}
        const now = new Date()
        const thisYyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const nextYyyyMm = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
        const ordered = [thisYyyyMm, nextYyyyMm].filter((k) => k in latest)
        const filtered = Object.fromEntries(ordered.map((k) => [k, latest[k]]))
        setData(filtered)
        setActiveMonth((prev) => (prev == null ? thisYyyyMm : prev))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!studentId) return
    fetchData()
  }, [studentId])

  return { data, loading, error, activeMonth, setActiveMonth, refetch: fetchData }
}

export default function LessonsThisMonth({ studentId, student }) {
  const { data, loading, error, activeMonth, setActiveMonth, refetch } = useLatestByMonth(studentId)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [actionError, setActionError] = useState(null)

  const handleCancel = (lesson) => {
    if ((lesson?.eventID || '').startsWith('unscheduled-')) return
    setActionError(null)
    api.cancelScheduleEvent(lesson.eventID).then(refetch).catch((e) => setActionError(e.message))
  }
  const handleUncancel = (lesson) => {
    if ((lesson?.eventID || '').startsWith('unscheduled-')) return
    setActionError(null)
    api.uncancelScheduleEvent(lesson.eventID).then(refetch).catch((e) => setActionError(e.message))
  }
  const handleReschedule = (lesson) => {
    if ((lesson?.eventID || '').startsWith('unscheduled-')) return
    setActionError(null)
    // Reschedule requires new date/time – for now just open a simple prompt; could be a proper modal later
    const newDate = prompt('New date (YYYY-MM-DD):')
    if (!newDate) return
    api.rescheduleScheduleEvent(lesson.eventID, { date: newDate }).then(refetch).catch((e) => setActionError(e.message))
  }
  const handleRemove = (lesson) => {
    if ((lesson?.eventID || '').startsWith('unscheduled-')) {
      setActionError('Cannot remove an unscheduled placeholder.')
      return
    }
    setActionError(null)
    if (!window.confirm('Remove this lesson from the schedule?')) return
    api.removeScheduleEvent(lesson.eventID).then(refetch).catch((e) => setActionError(e.message))
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
        Loading…
      </div>
    )
  }

  if (error) {
    const is404 = /not found|404/i.test(error)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center px-4">
        <span className="text-red-600 text-sm font-medium">{error}</span>
        {is404 && (
          <span className="text-slate-500 text-xs">
            Restart the API server if you recently added the latest-by-month endpoint.
          </span>
        )}
      </div>
    )
  }

  const monthKeys = Object.keys(data || {})
  if (monthKeys.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
        No schedule data
      </div>
    )
  }

  const current = activeMonth || monthKeys[0]
  const monthData = data[current]
  const now = new Date()
  const year = monthData?.year ?? now.getFullYear()
  const monthIndex = monthData?.monthIndex ?? now.getMonth()

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center gap-1 border-b border-gray-200 px-2 py-3">
        {monthKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveMonth(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer ${
              key === current
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {data[key]?.label ?? key}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 px-2">
        {actionError && (
          <div className="text-red-600 text-sm" role="alert">
            {actionError}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Payment:</span>
          <span
            className={`font-semibold ${monthData?.Payment === '済' ? 'text-green-600' : 'text-amber-600'}`}
          >
            {monthData?.Payment === '済' ? '済 (Paid)' : '未 (Unpaid)'}
          </span>
        </div>
        {monthData?.missingCount > 0 && (
          <div className="text-sm font-medium text-red-600">
            {monthData.missingCount} missing lesson{monthData.missingCount !== 1 ? 's' : ''}
          </div>
        )}

        {monthData?.lessons?.length > 0 ? (
          <div className={`lr-cards grid gap-1.5 overflow-x-visible overflow-y-auto max-h-[165px] py-1 pr-1 ${monthData.lessons.length > 6 ? 'grid-cols-[repeat(auto-fill,minmax(95px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(100px,1fr))]'}`}>
            {monthData.lessons.map((lesson, i) => (
              <LessonCard
                key={lesson.eventID || i}
                lesson={lesson}
                year={year}
                monthIndex={monthIndex}
                onClick={setSelectedLesson}
              />
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm py-4">No lessons scheduled</p>
        )}
      </div>

      {selectedLesson && (
        <LessonDetailsModal
          lesson={selectedLesson}
          student={student}
          onClose={() => { setSelectedLesson(null); setActionError(null) }}
          onCancel={handleCancel}
          onUncancel={handleUncancel}
          onReschedule={handleReschedule}
          onRemove={handleRemove}
        />
      )}
    </div>
  )
}
