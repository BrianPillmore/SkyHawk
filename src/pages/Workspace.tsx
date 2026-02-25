import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MapView from '../components/map/MapView';
import AddressSearch from '../components/map/AddressSearch';
import TabletLayout from '../layouts/TabletLayout';
import { useStore } from '../store/useStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';
import { useIsTablet } from '../hooks/useMediaQuery';

const tabs = [
  { id: 'tools' as const, label: 'Tools', icon: '✏️' },
  { id: 'measurements' as const, label: 'Data', icon: '📐' },
  { id: 'walls' as const, label: 'Walls', icon: '🏠' },
  { id: 'condition' as const, label: 'Condition', icon: '🔍' },
  { id: 'report' as const, label: 'Report', icon: '📄' },
  { id: 'compare' as const, label: 'Compare', icon: '🔄' },
  { id: 'claims' as const, label: 'Claims', icon: '📋' },
  { id: 'schedule' as const, label: 'Schedule', icon: '📅' },
  { id: 'solar' as const, label: 'Solar', icon: '☀️' },
  { id: 'shading' as const, label: 'Shading', icon: '🌤️' },
  { id: 'enterprise' as const, label: 'Team', icon: '👥' },
  { id: 'timeline' as const, label: 'Timeline', icon: '🕐' },
  { id: 'storms' as const, label: 'Storms', icon: '⛈️' },
];

export default function Workspace() {
  useKeyboardShortcuts();
  const isTablet = useIsTablet();
  const { activePropertyId, startNewMeasurement, activeMeasurement, activePanel, setActivePanel, sidebarOpen, toggleSidebar } = useStore();

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <Header />

      {/* Address search bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-2 md:px-4 py-2 md:py-2.5 shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <AddressSearch />
          {activePropertyId && !activeMeasurement && (
            <button
              onClick={startNewMeasurement}
              className="px-3 md:px-4 py-2 md:py-2.5 bg-gotruf-600 hover:bg-gotruf-500 text-white text-xs md:text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              New Measurement
            </button>
          )}
        </div>
      </div>

      {/* Panel tab bar — scrollable on both mobile and desktop */}
      <div className="flex bg-gray-900 border-b border-gray-800 shrink-0 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActivePanel(tab.id);
              // On mobile, open sidebar when clicking a tab
              if (window.innerWidth < 768 && !sidebarOpen) {
                toggleSidebar();
              }
            }}
            className={`px-2.5 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium whitespace-nowrap transition-colors ${
              activePanel === tab.id
                ? 'text-gotruf-400 border-b-2 border-gotruf-500 bg-gray-800/50'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
          >
            <span className="mr-1 md:mr-1.5">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main content — tablet uses split-view; mobile uses bottom sheet overlay; desktop uses sidebar */}
      {isTablet ? (
        <TabletLayout />
      ) : (
        <div className="flex flex-1 overflow-hidden relative">
          <Sidebar />
          <MapView />
        </div>
      )}
    </div>
  );
}
