import { Link, useLocation } from 'react-router-dom'
import { Users } from 'lucide-react'

export default function Sidebar({ collapsed }) {
  const location = useLocation()

  return (
    <aside
      id="sidebar"
      className={`fixed top-16 left-0 h-screen w-64 bg-gray-50 border-r border-gray-200 transition-transform duration-300 z-40 ${
        collapsed ? '-translate-x-full' : 'translate-x-0'
      }`}
    >
      <div className="p-4">
        <ul>
          <li>
            <Link
              to="/students"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname.startsWith('/students')
                  ? 'bg-green-600 text-white'
                  : 'text-gray-700 hover:bg-green-100 hover:text-green-700'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Students</span>
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  )
}
