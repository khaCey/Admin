import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  return (
    <>
      <Navbar onToggleSidebar={() => setSidebarCollapsed((c) => !c)} />
      <Sidebar collapsed={sidebarCollapsed} />
      <main
        id="mainContent"
        className={`pt-16 h-screen bg-gray-100 transition-all duration-300 w-full sidebar-content flex flex-col ${
          sidebarCollapsed ? 'ml-0' : 'ml-64'
        }`}
      >
        <div className="p-6 w-full flex flex-col h-full">
          <Outlet />
        </div>
      </main>
    </>
  )
}
