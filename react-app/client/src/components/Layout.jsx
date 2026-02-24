import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import FeatureListModal from './FeatureListModal'

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [featureModalMode, setFeatureModalMode] = useState(null)

  return (
    <>
      <Navbar
        onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        onOpenUnpaid={() => setFeatureModalMode('unpaid')}
        onOpenUnscheduled={() => setFeatureModalMode('unscheduled')}
      />
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
      {featureModalMode && (
        <FeatureListModal
          mode={featureModalMode}
          onClose={() => setFeatureModalMode(null)}
        />
      )}
    </>
  )
}
