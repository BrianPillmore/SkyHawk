import { useStore } from '../../store/useStore';
import ToolsPanel from '../measurement/ToolsPanel';
import MeasurementsPanel from '../measurement/MeasurementsPanel';
import MeasurementSelector from '../measurement/MeasurementSelector';
import ReportPanel from '../reports/ReportPanel';
import ComparisonPanel from '../comparison/ComparisonPanel';
import ClaimsPanel from '../claims/ClaimsPanel';
import AdjusterPanel from '../claims/AdjusterPanel';
import SolarPanel from '../solar/SolarPanel';
import EnterprisePanel from '../enterprise/EnterprisePanel';

export default function Sidebar() {
  const { sidebarOpen, activePanel, setActivePanel, activeMeasurement, activePropertyId } = useStore();

  if (!sidebarOpen) return null;

  const tabs = [
    { id: 'tools' as const, label: 'Tools', icon: '✏️' },
    { id: 'measurements' as const, label: 'Data', icon: '📐' },
    { id: 'report' as const, label: 'Report', icon: '📄' },
    { id: 'compare' as const, label: 'Compare', icon: '🔄' },
    { id: 'claims' as const, label: 'Claims', icon: '📋' },
    { id: 'schedule' as const, label: 'Schedule', icon: '📅' },
    { id: 'solar' as const, label: 'Solar', icon: '☀️' },
    { id: 'enterprise' as const, label: 'Team', icon: '👥' },
  ];

  return (
    <aside className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 h-full overflow-hidden">
      {/* Tab navigation */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              activePanel === tab.id
                ? 'text-skyhawk-400 border-b-2 border-skyhawk-500 bg-gray-800/50'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Measurement selector */}
      {activePropertyId && <MeasurementSelector />}

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {/* Claims, Compare, and Schedule work without active measurement */}
        {activePanel === 'claims' && <ClaimsPanel />}
        {activePanel === 'compare' && <ComparisonPanel />}
        {activePanel === 'schedule' && <AdjusterPanel />}
        {activePanel === 'enterprise' && <EnterprisePanel />}

        {/* Other panels require active measurement */}
        {activePanel !== 'claims' && activePanel !== 'compare' && activePanel !== 'schedule' && activePanel !== 'enterprise' && (
          !activeMeasurement ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              <p className="mb-2">No active measurement</p>
              <p className="text-xs">Search for a property address to begin, or select an existing property from the dashboard.</p>
            </div>
          ) : (
            <>
              {activePanel === 'tools' && <ToolsPanel />}
              {activePanel === 'measurements' && <MeasurementsPanel />}
              {activePanel === 'report' && <ReportPanel />}
              {activePanel === 'solar' && <SolarPanel />}
            </>
          )
        )}
      </div>
    </aside>
  );
}
