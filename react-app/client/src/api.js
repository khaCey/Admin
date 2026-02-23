const API_BASE = '/api';

async function fetchApi(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  getStudents: () => fetchApi('/students'),
  getStudent: (id) => fetchApi(`/students/${id}`),
  getStudentLatestByMonth: (id) => fetchApi(`/students/${id}/latest-by-month`),
  addStudent: (data) => fetchApi('/students', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (id, data) => fetchApi(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStudent: (id) => fetchApi(`/students/${id}`, { method: 'DELETE' }),

  getPayments: () => fetchApi('/payments'),
  addPayment: (data) => fetchApi('/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id, data) => fetchApi(`/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayment: (id) => fetchApi(`/payments/${id}`, { method: 'DELETE' }),

  getNotes: (studentId) => fetchApi(`/notes${studentId ? `?student_id=${studentId}` : ''}`),
  addNote: (data) => fetchApi('/notes', { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id, data) => fetchApi(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (id) => fetchApi(`/notes/${id}`, { method: 'DELETE' }),

  getFeatureFlags: () => fetchApi('/config/feature-flags'),
};
