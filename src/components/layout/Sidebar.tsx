import { useStore } from '../../store/useStore';
import ToolsPanel from '../measurement/ToolsPanel';
import MeasurementsPanel from '../measurement/MeasurementsPanel';
import MeasurementSelector from '../measurement/MeasurementSelector';
import ReportPanel from '../reports/ReportPanel';
import ComparisonPanel from '../comparison/ComparisonPanel';
import ClaimsPanel from '../claims/ClaimsPanel';
import AdjusterPanel from '../claims/AdjusterPanel';
import SolarPanel from '../solar/SolarPanel';
import ShadingPanel from '../solar/ShadingPanel';
import EnterprisePanel from '../enterprise/EnterprisePanel';
import ConditionPanel from '../measurement/ConditionPanel';
import WallsPanel from '../measurement/WallsPanel';
import AccuracyDashboard from '../annotation/AccuracyDashboard';

export default function Sidebar() {
  const { sidebarOpen, activePanel, activeMeasurement, activePropertyId, toggleSidebar } = useStore();

  if (!sidebarOpen) return null;

  const panelContent = (
    <>
      {/* Measurement selector */}
      {activePropertyId && <MeasurementSelector />}

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {/* Claims, Compare, Schedule, Condition, Walls, and Shading work without active measurement */}
        {activePanel === 'claims' && <ClaimsPanel />}
        {activePanel === 'compare' && <ComparisonPanel />}
        {activePanel === 'schedule' && <AdjusterPanel />}
        {activePanel === 'enterprise' && <EnterprisePanel />}
        {activePanel === 'condition' && <ConditionPanel />}
        {activePanel === 'walls' && <WallsPanel />}
        {activePanel === 'shading' && <ShadingPanel />}
        {activePanel === 'ml-training' && <AccuracyDashboard />}

        {/* Other panels require active measurement */}
        {activePanel !== 'claims' && activePanel !== 'compare' && activePanel !== 'schedule' && activePanel !== 'enterprise' && activePanel !== 'condition' && activePanel !== 'walls' && activePanel !== 'shading' && activePanel !== 'ml-training' && (
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
    </>
  );

  return (
    <>
      {/* Desktop: fixed-width side panel */}
      <aside className="hidden md:flex w-80 bg-gray-900 border-r border-gray-800 flex-col shrink-0 h-full overflow-hidden">
        {panelContent}
      </aside>

      {/* Mobile: bottom sheet overlay */}
      <div className="md:hidden fixed inset-0 z-40 flex flex-col pointer-events-none">
        {/* Backdrop — tap to dismiss */}
        <div
          className="flex-1 pointer-events-auto"
          onClick={toggleSidebar}
        />
        {/* Bottom sheet */}
        <div className="pointer-events-auto bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[70vh] flex flex-col shadow-2xl">
          {/* Drag handle */}
          <div className="flex justify-center py-2 shrink-0 cursor-pointer" onClick={toggleSidebar}>
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>
          {panelContent}
        </div>
      </div>
    </>
  );
}
