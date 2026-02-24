# Calendar Polling API — Spec for Client Apps

Use this spec when building an app that polls the Calendar Webhook for changes. Returns **MonthlySchedule** data (current month's lessons).

---

## Base URL

```
https://script.google.com/macros/s/AKfycbzO_0AOx5ySN_omhkmF14SyanY5A5Wy6m3xK35nO0Ox9i_AAmT4KVWRrs2TD7rsJ4Y3/exec
```

(Use your deployed Web App URL. Deploy as "Anyone" so the other app can call it without auth.)

---

## Authentication

All requests require an API key. Pass it as a query parameter:

```
?key=CALENDAR_APIjQT4itwLlB3OdFN6Z6Na1OiNCidPIlrz
```

- The key is configured in the Calendar Webhook project: **Project Settings → Script properties → `POLL_API_KEY`**
- Share the same key with your client app (env var, config file, etc.)
- If the key is missing or invalid, the response is `200` with `{ "error": "Invalid or missing API key" }` (Apps Script does not support custom status codes; check the `error` field)

---

## Endpoints

### 1. Poll for changes (diff only)

**Request:**
```
GET /exec?key=YOUR_API_KEY
```

**Response when no changes:**
```json
{
  "changed": false
}
```

**Response when changes exist:**
```json
{
  "changed": true,
  "diff": {
    "cacheVersion": 124,
    "lastUpdated": "2025-02-24T10:30:00.000Z",
    "added": [
      {
        "eventID": "abc123...",
        "title": "John Smith (Online)",
        "date": "2025-02-24",
        "start": "2025-02-24 10:00",
        "end": "2025-02-24 10:30",
        "status": "scheduled",
        "studentName": "John Smith",
        "isKidsLesson": "",
        "teacherName": ""
      }
    ],
    "removed": ["eventId456|Jane Doe", "eventId789|Bob Smith"],
    "updated": [
      {
        "eventID": "xyz789...",
        "title": "Jane Doe (Cafe --> Online)",
        "date": "2025-02-24",
        "start": "2025-02-24 11:00",
        "end": "2025-02-24 11:30",
        "status": "scheduled",
        "studentName": "Jane Doe",
        "isKidsLesson": "",
        "teacherName": ""
      }
    ]
  }
}
```

- **added**: New rows (full objects)
- **removed**: Row keys (`eventID|studentName`) that no longer exist (group lessons have multiple rows per event)
- **updated**: Rows that changed (full new object; replace by `eventID` + `studentName`)
- The diff is **consumed once** — the next poll returns `changed: false` until the calendar changes again

---

### 2. Get full data (initial load or refresh)

**Request:**
```
GET /exec?key=YOUR_API_KEY&full=1
```

**Response:**
```json
{
  "cacheVersion": 124,
  "lastUpdated": "2025-02-24T10:30:00.000Z",
  "data": [
    {
      "eventID": "abc123...",
      "title": "John Smith (Online)",
      "date": "2025-02-24",
      "start": "2025-02-24 10:00",
      "end": "2025-02-24 10:30",
      "status": "scheduled",
      "studentName": "John Smith",
      "isKidsLesson": "",
      "teacherName": ""
    }
  ]
}
```

Use this on app startup or when you need the full MonthlySchedule snapshot.

---

## MonthlySchedule row object fields

| Field | Type | Description |
|-------|------|-------------|
| `eventID` | string | Google Calendar event ID |
| `title` | string | Full event title |
| `date` | string | Date (yyyy-MM-dd) |
| `start` | string | Start datetime (yyyy-MM-dd HH:mm) |
| `end` | string | End datetime (yyyy-MM-dd HH:mm) |
| `status` | string | `scheduled`, `reserved`, `rescheduled`, `cancelled`, or `demo` |
| `studentName` | string | Student name (one row per student for group lessons) |
| `isKidsLesson` | string | `子` for kids lessons, empty otherwise |
| `teacherName` | string | Teacher name (e.g. `Sham`) |

---

## Error responses

| Status | Body | Cause |
|--------|------|-------|
| 200 | `{ "error": "Invalid or missing API key" }` | Missing `key` param or wrong key |
| 500 | `{ "error": "..." }` | Server error (check WebhookLog sheet) |

---

## Recommended polling flow

1. **Startup**: Call `?key=X&full=1` to get the full MonthlySchedule data.
2. **Ongoing**: Poll `?key=X` every 1–5 seconds.
3. **When `changed: true`**: Apply the diff (add new, remove by `eventID|studentName`, replace updated by `eventID|studentName`).
4. **When `changed: false`**: No action.

---

## Content-Type

Responses are `application/json` unless an error occurs (may be `text/plain` for some errors).
