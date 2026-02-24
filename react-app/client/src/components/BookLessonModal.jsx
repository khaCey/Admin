import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../api'

const TIME_SLOTS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function BookLessonModal({ studentId, student, onClose, onBooked }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [slots, setSlots] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingSlot, setPendingSlot] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [breakWarning, setBreakWarning] = useState(null)

  const weekStartStr = formatDateKey(weekStart)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .getWeekSchedule(weekStartStr)
      .then((data) => setSlots(data.slots || {}))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [weekStartStr])

  const goWeek = (delta) => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + delta * 7)
    setWeekStart(next)
  }

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const handleSlotClick = (dateStr, timeStr) => {
    const key = `${dateStr}T${timeStr}`
    if (slots[key]) return
    setPendingSlot({ date: dateStr, time: timeStr })
  }

  const handleConfirmBook = () => {
    if (!pendingSlot || !studentId) return
    setBreakWarning(null)
    setSubmitting(true)
    api
      .getBookingWarning(pendingSlot.date, pendingSlot.time, studentId)
      .then((w) => {
        if (w.warn && w.message) setBreakWarning(w.message)
        return api.bookLesson({
          student_id: studentId,
          date: pendingSlot.date,
          time: pendingSlot.time,
          duration_minutes: 50,
        })
      })
      .then(() => {
        onBooked?.()
        onClose()
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setSubmitting(false)
        setPendingSlot(null)
        setBreakWarning(null)
      })
  }

  const studentName = student?.Name || student?.name || 'Student'
  const studentKanji = student?.['漢字'] || student?.name_kanji || ''

  const modal = (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true" aria-labelledby="bookLessonTitle">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8 overflow-auto">
        <div className="w-full max-w-6xl max-h-[90vh] rounded-2xl bg-white shadow-xl ring-1 ring-black/5 flex flex-col overflow-hidden">
          <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-200">
            <div>
              <h3 id="bookLessonTitle" className="text-lg font-semibold text-gray-900 leading-tight">Book a New Lesson</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                {studentName} {studentKanji ? `(${studentKanji})` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Close
            </button>
          </header>

          <div className="px-5 pt-4 pb-5 flex-1 overflow-hidden flex flex-col min-h-0">
            {error && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => goWeek(-1)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Week
              </button>
              <h4 className="text-base font-semibold text-gray-900">
                Week of {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </h4>
              <button
                type="button"
                onClick={() => goWeek(1)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                Next Week
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200" />
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent absolute top-0 left-0" />
                </div>
                <p className="text-base font-medium text-gray-900">Loading Availability</p>
                <p className="text-sm text-gray-500">Checking schedule...</p>
              </div>
            ) : (
              <div className="bg-white overflow-hidden overflow-y-auto flex-1 min-h-0" style={{ maxHeight: '60vh', minHeight: 320 }}>
                <div className="sticky top-0 z-10 grid grid-cols-8 bg-green-600 text-white shadow-md">
                  <div className="px-3 py-2.5 text-sm font-semibold text-center">Time</div>
                  {weekDates.map((d) => (
                    <div key={d.getTime()} className="px-3 py-2.5 text-sm font-semibold text-center">
                      <div>{DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}</div>
                      <div className="text-xs font-normal text-white/90 mt-0.5">{formatDateKey(d)}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-8 pt-0.5" style={{ gridAutoRows: '60px', minHeight: 528 }}>
                  {TIME_SLOTS.map((timeStr) => (
                    <React.Fragment key={timeStr}>
                      <div className="px-3 py-2 flex items-center justify-center text-sm font-medium text-gray-700 bg-gray-50 border-b border-r border-gray-100">
                        {timeStr}
                      </div>
                      {weekDates.map((d) => {
                        const dateStr = formatDateKey(d)
                        const key = `${dateStr}T${timeStr}`
                        const busy = slots[key]
                        const isPast = new Date(dateStr + 'T' + timeStr) <= new Date()
                        return (
                          <button
                            key={`${dateStr}-${timeStr}`}
                            type="button"
                            disabled={!!busy || isPast}
                            onClick={() => handleSlotClick(dateStr, timeStr)}
                            className={`px-2 py-1 text-xs font-medium border-b border-r border-gray-100 min-h-[60px] flex items-center justify-center cursor-pointer transition-colors ${
                              isPast
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : busy
                                  ? 'bg-amber-50 text-amber-800 cursor-default'
                                  : 'bg-white hover:bg-green-50 text-gray-800 hover:ring-2 hover:ring-green-500 hover:ring-inset'
                            }`}
                          >
                            {isPast ? 'Past' : busy ? `${busy} lesson${busy > 1 ? 's' : ''}` : 'Book'}
                          </button>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

          {pendingSlot && (
            <div className="shrink-0 p-4 border-t border-gray-200 bg-gray-50 flex flex-col gap-2">
              {breakWarning && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  {breakWarning}
                </p>
              )}
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-gray-700">
                  Book on <strong>{pendingSlot.date}</strong> at <strong>{pendingSlot.time}</strong>?
                </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingSlot(null)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBook}
                  disabled={submitting}
                  className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Booking...' : 'Confirm'}
                </button>
              </div>
              </div>
            </div>
          )}

          <footer className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Close
            </button>
          </footer>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
