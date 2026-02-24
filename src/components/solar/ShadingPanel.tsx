import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { analyzeShadingProfile } from '../../utils/shadingAnalysis';
import { calculateSunPath, calculateAnnualSunPaths } from '../../utils/sunPath';

export default function ShadingPanel() {
  const { activePropertyId, properties } = useStore();
  const property = activePropertyId ? properties.find(p => p.id === activePropertyId) : null;

  const [activeTab, setActiveTab] = useState<'shading' | 'sunpath'>('shading');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [obstructionAngle, setObstructionAngle] = useState(15);

  const latitude = property?.lat ?? 39.7;
  const longitude = property?.lng ?? -104.9;

  const shadingResult = useMemo(
    () => analyzeShadingProfile(latitude, obstructionAngle),
    [latitude, obstructionAngle]
  );

  const annualPaths = useMemo(
    () => calculateAnnualSunPaths(latitude, longitude),
    [latitude, longitude]
  );

  const selectedSunPath = useMemo(
    () => calculateSunPath(latitude, longitude, new Date(new Date().getFullYear(), selectedMonth, 15)),
    [latitude, longitude, selectedMonth]
  );

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (!property) {
    return <div className="p-3 text-xs text-gray-500 text-center">Select a property to view shading analysis.</div>;
  }

  return (
    <div className="p-3 space-y-4">
      {/* Tab selector */}
      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('shading')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'shading' ? 'bg-gotruf-600 text-white' : 'text-gray-400 hover:text-white'
          }`}>Shading</button>
        <button
          onClick={() => setActiveTab('sunpath')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'sunpath' ? 'bg-gotruf-600 text-white' : 'text-gray-400 hover:text-white'
          }`}>Sun Path</button>
      </div>

      {activeTab === 'shading' && (
        <>
          {/* Obstruction angle slider */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Obstruction Angle: {obstructionAngle}°
            </label>
            <input type="range" min={0} max={45} value={obstructionAngle}
              onChange={e => setObstructionAngle(Number(e.target.value))}
              className="w-full accent-gotruf-500" />
            <p className="text-xs text-gray-600 mt-1">Average horizon angle from nearby trees/buildings</p>
          </div>

          {/* Annual summary */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Annual Summary</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-gray-400">Avg Shade Factor</span><span className="text-white">{Math.round(shadingResult.annualShadeFraction * 100)}%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Effective Sun Hours/yr</span><span className="text-white">{shadingResult.annualEffectiveSunHours.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Production Impact</span><span className="text-orange-400">-{shadingResult.shadingImpactPercent}%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Best Month</span><span className="text-green-400">{shadingResult.bestMonth.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Worst Month</span><span className="text-red-400">{shadingResult.worstMonth.name}</span></div>
            </div>
          </div>

          {/* Monthly breakdown */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Monthly Effective Sun Hours</h4>
            <div className="space-y-1">
              {shadingResult.monthlyAnalysis.map(m => {
                const maxHours = Math.max(...shadingResult.monthlyAnalysis.map(x => x.peakSunHours));
                const barWidth = maxHours > 0 ? (m.peakSunHours / maxHours) * 100 : 0;
                return (
                  <div key={m.month} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 w-8">{monthNames[m.month]}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="text-gray-300 w-10 text-right">{m.peakSunHours}h</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {activeTab === 'sunpath' && (
        <>
          {/* Month selector */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Month</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white">
              {monthNames.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>

          {/* Sun path info */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              {monthNames[selectedMonth]} Sun Data
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-gray-400">Sunrise</span><span className="text-yellow-400">{selectedSunPath.sunrise.hour}:{String(selectedSunPath.sunrise.minute).padStart(2, '0')}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Sunset</span><span className="text-orange-400">{selectedSunPath.sunset.hour}:{String(selectedSunPath.sunset.minute).padStart(2, '0')}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Solar Noon Alt.</span><span className="text-white">{selectedSunPath.solarNoon.altitude}°</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Daylight Hours</span><span className="text-white">{selectedSunPath.daylightHours}h</span></div>
            </div>
          </div>

          {/* Sun altitude chart (text-based) */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Sun Altitude (Hourly)</h4>
            <div className="space-y-0.5">
              {selectedSunPath.positions.filter(p => p.minute === 0 && p.hour >= 5 && p.hour <= 20).map(p => {
                const maxAlt = selectedSunPath.solarNoon.altitude || 1;
                const barWidth = (p.altitude / maxAlt) * 100;
                return (
                  <div key={p.hour} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-10">{p.hour}:00</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${p.altitude > 0 ? 'bg-yellow-400' : 'bg-gray-700'}`}
                        style={{ width: `${Math.max(0, barWidth)}%` }} />
                    </div>
                    <span className="text-gray-400 w-8 text-right">{Math.round(p.altitude)}°</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key dates comparison */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Seasonal Comparison</h4>
            <div className="space-y-2 text-xs">
              <div className="bg-gray-800/50 rounded-lg p-2">
                <p className="text-yellow-400 font-medium">Summer Solstice (Jun 21)</p>
                <p className="text-gray-400">Daylight: {annualPaths.solsticeSummer.daylightHours}h | Peak: {annualPaths.solsticeSummer.solarNoon.altitude}°</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2">
                <p className="text-green-400 font-medium">Equinox (Mar 20)</p>
                <p className="text-gray-400">Daylight: {annualPaths.equinox.daylightHours}h | Peak: {annualPaths.equinox.solarNoon.altitude}°</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2">
                <p className="text-blue-400 font-medium">Winter Solstice (Dec 21)</p>
                <p className="text-gray-400">Daylight: {annualPaths.solsticeWinter.daylightHours}h | Peak: {annualPaths.solsticeWinter.solarNoon.altitude}°</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
