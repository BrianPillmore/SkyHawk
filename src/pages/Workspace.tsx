import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MapView from '../components/map/MapView';
import AddressSearch from '../components/map/AddressSearch';
import { useStore } from '../store/useStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';

export default function Workspace() {
  useKeyboardShortcuts();
  const { activePropertyId, startNewMeasurement, activeMeasurement } = useStore();

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <Header />

      {/* Address search bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <AddressSearch />
          {activePropertyId && !activeMeasurement && (
            <button
              onClick={startNewMeasurement}
              className="px-4 py-2.5 bg-skyhawk-600 hover:bg-skyhawk-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              New Measurement
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MapView />
      </div>
    </div>
  );
}
