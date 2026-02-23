import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Students from './pages/Students'
import StudentDetail from './pages/StudentDetail'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/students" replace />} />
        <Route path="students" element={<Students />} />
        <Route path="students/new" element={<StudentDetail />} />
        <Route path="students/:id" element={<StudentDetail />} />
      </Route>
    </Routes>
  )
}

export default App
