import { Link } from 'react-router-dom'
import { Menu, UserPlus } from 'lucide-react'

export default function Navbar({ onToggleSidebar }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white shadow-lg">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <button
            type="button"
            className="p-2 hover:bg-green-700 rounded-lg transition-colors mr-3"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/students" className="text-xl font-semibold">
            Green Square
          </Link>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/students/new"
            className="px-4 py-2 border border-white text-white rounded-lg hover:bg-white hover:text-green-600 transition-colors flex items-center space-x-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
