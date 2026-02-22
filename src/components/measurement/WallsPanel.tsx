import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { calculateWallSegment, calculateWallSummary, calculateOpeningArea, estimateSidingMaterials, STANDARD_OPENINGS } from '../../utils/wallCalculations';
import type { WallSegment, WallOpening } from '../../utils/wallCalculations';

export default function WallsPanel() {
  const [segments, setSegments] = useState<WallSegment[]>([]);
  const [wallName, setWallName] = useState('');
  const [wallLength, setWallLength] = useState(30);
  const [wallHeight, setWallHeight] = useState(9);

  const addWall = () => {
    const name = wallName || `Wall ${segments.length + 1}`;
    const segment = calculateWallSegment(uuidv4(), name, wallLength, wallHeight, []);
    setSegments([...segments, segment]);
    setWallName('');
  };

  const removeWall = (id: string) => {
    setSegments(segments.filter(s => s.id !== id));
  };

  const addOpening = (segmentId: string, type: WallOpening['type'], sizeKey: string) => {
    const size = STANDARD_OPENINGS[sizeKey];
    if (!size) return;
    const opening: WallOpening = {
      id: uuidv4(),
      type,
      widthFt: size.widthFt,
      heightFt: size.heightFt,
      areaSqFt: calculateOpeningArea(size.widthFt, size.heightFt),
    };
    setSegments(segments.map(s => {
      if (s.id !== segmentId) return s;
      const openings = [...s.openings, opening];
      return calculateWallSegment(s.id, s.name, s.lengthFt, s.heightFt, openings);
    }));
  };

  const removeOpening = (segmentId: string, openingId: string) => {
    setSegments(segments.map(s => {
      if (s.id !== segmentId) return s;
      const openings = s.openings.filter(o => o.id !== openingId);
      return calculateWallSegment(s.id, s.name, s.lengthFt, s.heightFt, openings);
    }));
  };

  const summary = calculateWallSummary(segments);
  const sidingMaterials = estimateSidingMaterials(summary);

  return (
    <div className="p-3 space-y-4">
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Add Wall</h3>
        <div className="space-y-2">
          <input
            type="text"
            value={wallName}
            onChange={e => setWallName(e.target.value)}
            placeholder="Wall name (optional)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Length (ft)</label>
              <input type="number" value={wallLength} onChange={e => setWallLength(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Height (ft)</label>
              <input type="number" value={wallHeight} onChange={e => setWallHeight(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white" />
            </div>
          </div>
          <button onClick={addWall}
            className="w-full px-3 py-2 bg-skyhawk-600 hover:bg-skyhawk-500 text-white text-sm rounded-lg transition-colors">
            Add Wall Segment
          </button>
        </div>
      </section>

      {/* Wall Segments */}
      {segments.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Wall Segments ({segments.length})
          </h3>
          <div className="space-y-3">
            {segments.map(s => (
              <div key={s.id} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  <button onClick={() => removeWall(s.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-2">
                  <div>{s.lengthFt}' x {s.heightFt}'</div>
                  <div>Gross: {s.grossAreaSqFt} sqft</div>
                  <div className="text-white font-medium">Net: {s.netAreaSqFt} sqft</div>
                </div>
                {/* Openings */}
                {s.openings.map(o => (
                  <div key={o.id} className="flex items-center justify-between text-xs text-gray-400 ml-2 py-0.5">
                    <span className="capitalize">{o.type} ({o.widthFt}'x{o.heightFt}')</span>
                    <button onClick={() => removeOpening(s.id, o.id)} className="text-red-400 hover:text-red-300 text-xs">x</button>
                  </div>
                ))}
                {/* Add opening buttons */}
                <div className="flex flex-wrap gap-1 mt-2">
                  <button onClick={() => addOpening(s.id, 'window', 'window-standard')}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 rounded">+ Window</button>
                  <button onClick={() => addOpening(s.id, 'door', 'door-standard')}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 rounded">+ Door</button>
                  <button onClick={() => addOpening(s.id, 'garage-door', 'garage-single')}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 rounded">+ Garage</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Summary */}
      {segments.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Wall Summary</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-400"><span>Gross Wall Area</span><span className="text-white">{summary.totalGrossAreaSqFt} sqft</span></div>
            <div className="flex justify-between text-gray-400"><span>Openings Area</span><span className="text-orange-400">-{summary.totalOpeningsAreaSqFt} sqft</span></div>
            <div className="flex justify-between text-gray-400 font-medium"><span>Net Wall Area</span><span className="text-white font-bold">{summary.totalNetAreaSqFt} sqft</span></div>
            <div className="flex justify-between text-gray-400"><span>Siding Squares</span><span className="text-white">{summary.sidingSquares}</span></div>
            <div className="flex justify-between text-gray-400"><span>Windows</span><span className="text-white">{summary.totalWindowCount}</span></div>
            <div className="flex justify-between text-gray-400"><span>Doors</span><span className="text-white">{summary.totalDoorCount}</span></div>
            <div className="flex justify-between text-gray-400"><span>Garage Doors</span><span className="text-white">{summary.totalGarageDoorCount}</span></div>
          </div>
        </section>
      )}

      {/* Siding Materials */}
      {segments.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Siding Materials Est.</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-400"><span>Vinyl/Hardie Squares</span><span className="text-white">{sidingMaterials.vinylSidingSquares}</span></div>
            <div className="flex justify-between text-gray-400"><span>J-Channel</span><span className="text-white">{sidingMaterials.jChannelLf} lf</span></div>
            <div className="flex justify-between text-gray-400"><span>Trim Coil Rolls</span><span className="text-white">{sidingMaterials.trimCoilRolls}</span></div>
          </div>
        </section>
      )}

      {segments.length === 0 && (
        <p className="text-xs text-gray-500 text-center">
          Add wall segments to calculate siding measurements.
        </p>
      )}
    </div>
  );
}
