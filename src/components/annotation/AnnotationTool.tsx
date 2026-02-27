import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../../store/useStore';

// Annotation class definitions
const CLASSES = [
  { id: 0, name: 'Eraser', color: '#000000', shortcut: '0' },
  { id: 1, name: 'Roof Surface', color: '#808080', shortcut: '1' },
  { id: 2, name: 'Ridge', color: '#FF0000', shortcut: '2' },
  { id: 3, name: 'Hip', color: '#FFA500', shortcut: '3' },
  { id: 4, name: 'Valley', color: '#0000FF', shortcut: '4' },
  { id: 5, name: 'Eave/Rake', color: '#00FF00', shortcut: '5' },
  { id: 6, name: 'Flashing', color: '#C0C0C0', shortcut: '6' },
] as const;

type DrawMode = 'line' | 'polygon' | 'erase';

interface Point {
  x: number;
  y: number;
}

interface AnnotationLine {
  start: Point;
  end: Point;
  classId: number;
}

interface AnnotationPolygon {
  points: Point[];
  classId: number;
}

type AnnotationAction =
  | { type: 'line'; line: AnnotationLine }
  | { type: 'polygon'; polygon: AnnotationPolygon };

const IMAGE_SIZE = 640;
const LINE_WIDTH = 3;

export default function AnnotationTool() {
  const token = useStore((s) => s.token);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [currentClass, setCurrentClass] = useState(2); // default: ridge
  const [drawMode, setDrawMode] = useState<DrawMode>('line');
  const [lineStart, setLineStart] = useState<Point | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [actions, setActions] = useState<AnnotationAction[]>([]);
  const [redoStack, setRedoStack] = useState<AnnotationAction[]>([]);
  const [zoom] = useState(1);
  const [pan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning] = useState(false);
  const [panStart] = useState<Point>({ x: 0, y: 0 });
  // TODO: Wire up setZoom, setPan, setIsPanning, setPanStart for zoom/pan controls
  void pan; void panStart; // suppress unused warnings
  const [annotations, setAnnotations] = useState<{ id: string; name: string }[]>([]);
  const [currentName, setCurrentName] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [showMask, setShowMask] = useState(true);

  // Load annotation list
  useEffect(() => {
    if (!token) return;
    fetch('/api/ml/annotations', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAnnotations(data);
      })
      .catch(() => {});
  }, [token]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;

      // Class shortcuts 0-6
      const num = parseInt(e.key);
      if (num >= 0 && num <= 6) {
        setCurrentClass(num);
        return;
      }

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      if (e.key === 'l') setDrawMode('line');
      if (e.key === 'p') setDrawMode('polygon');
      if (e.key === 'e') setDrawMode('erase');
      if (e.key === 'm') setShowMask((v) => !v);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [actions, redoStack]);

  // Get canvas-relative coordinates accounting for zoom/pan
  const getCanvasPoint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = IMAGE_SIZE / rect.width;
      const scaleY = IMAGE_SIZE / rect.height;
      return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY),
      };
    },
    []
  );

  // Redraw everything
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!canvas || !maskCanvas || !overlayCanvas) return;

    const ctx = canvas.getContext('2d')!;
    const maskCtx = maskCanvas.getContext('2d')!;
    const overlayCtx = overlayCanvas.getContext('2d')!;

    // Clear
    ctx.clearRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
    overlayCtx.clearRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);

    // Draw source image
    if (sourceImage) {
      ctx.drawImage(sourceImage, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
    }

    // Replay all actions onto the mask canvas
    for (const action of actions) {
      if (action.type === 'line') {
        const { start, end, classId } = action.line;
        // Draw on mask (class value as grayscale)
        maskCtx.strokeStyle = `rgb(${classId}, ${classId}, ${classId})`;
        maskCtx.lineWidth = LINE_WIDTH;
        maskCtx.lineCap = 'round';
        maskCtx.beginPath();
        maskCtx.moveTo(start.x, start.y);
        maskCtx.lineTo(end.x, end.y);
        maskCtx.stroke();

        // Draw on overlay (class color with transparency)
        const cls = CLASSES.find((c) => c.id === classId);
        if (cls) {
          overlayCtx.strokeStyle = cls.color;
          overlayCtx.lineWidth = LINE_WIDTH;
          overlayCtx.lineCap = 'round';
          overlayCtx.globalAlpha = 0.8;
          overlayCtx.beginPath();
          overlayCtx.moveTo(start.x, start.y);
          overlayCtx.lineTo(end.x, end.y);
          overlayCtx.stroke();
          overlayCtx.globalAlpha = 1.0;
        }
      } else if (action.type === 'polygon') {
        const { points, classId } = action.polygon;
        if (points.length < 3) continue;

        // Fill on mask
        maskCtx.fillStyle = `rgb(${classId}, ${classId}, ${classId})`;
        maskCtx.beginPath();
        maskCtx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          maskCtx.lineTo(points[i].x, points[i].y);
        }
        maskCtx.closePath();
        maskCtx.fill();

        // Fill on overlay
        const cls = CLASSES.find((c) => c.id === classId);
        if (cls) {
          overlayCtx.fillStyle = cls.color;
          overlayCtx.globalAlpha = 0.3;
          overlayCtx.beginPath();
          overlayCtx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            overlayCtx.lineTo(points[i].x, points[i].y);
          }
          overlayCtx.closePath();
          overlayCtx.fill();
          overlayCtx.globalAlpha = 1.0;

          // Outline
          overlayCtx.strokeStyle = cls.color;
          overlayCtx.lineWidth = 1;
          overlayCtx.stroke();
        }
      }
    }

    // Composite: source image + overlay
    if (showMask) {
      ctx.drawImage(overlayCanvas, 0, 0);
    }
  }, [sourceImage, actions, showMask]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Handle image file load
  const handleImageLoad = useCallback((file: File) => {
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      setActions([]);
      setRedoStack([]);
      setCurrentName(file.name.replace('.png', '').replace('.jpg', '').replace('.jpeg', ''));
      setStatusMsg(`Loaded: ${file.name}`);
    };
    img.src = URL.createObjectURL(file);
  }, []);

  // Canvas click handlers
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanning) return;
      const point = getCanvasPoint(e);

      if (drawMode === 'line') {
        if (!lineStart) {
          setLineStart(point);
        } else {
          const newAction: AnnotationAction = {
            type: 'line',
            line: { start: lineStart, end: point, classId: currentClass },
          };
          setActions((prev) => [...prev, newAction]);
          setRedoStack([]);
          setLineStart(null);
        }
      } else if (drawMode === 'polygon') {
        // Double-click to close polygon
        if (e.detail === 2 && polygonPoints.length >= 3) {
          const newAction: AnnotationAction = {
            type: 'polygon',
            polygon: { points: [...polygonPoints], classId: currentClass },
          };
          setActions((prev) => [...prev, newAction]);
          setRedoStack([]);
          setPolygonPoints([]);
        } else if (e.detail === 1) {
          setPolygonPoints((prev) => [...prev, point]);
        }
      }
    },
    [drawMode, lineStart, polygonPoints, currentClass, isPanning, getCanvasPoint]
  );

  // Right-click to cancel current operation
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setLineStart(null);
      setPolygonPoints([]);
    },
    []
  );

  // Undo/Redo
  const undo = useCallback(() => {
    setActions((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((redo) => [...redo, last]);
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setActions((acts) => [...acts, last]);
      return prev.slice(0, -1);
    });
  }, []);

  // Export mask as single-channel PNG
  // @ts-expect-error -- exportMask will be used when save/export UI is wired up
  const exportMask = useCallback((): Blob | null => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return null;

    const maskCtx = maskCanvas.getContext('2d')!;
    const imageData = maskCtx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);

    // Create single-channel export canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = IMAGE_SIZE;
    exportCanvas.height = IMAGE_SIZE;
    const exportCtx = exportCanvas.getContext('2d')!;
    const exportData = exportCtx.createImageData(IMAGE_SIZE, IMAGE_SIZE);

    // Extract R channel (contains class IDs 0-6) and write as grayscale
    for (let i = 0; i < imageData.data.length; i += 4) {
      const classId = imageData.data[i]; // R channel
      // Map class values to visible grayscale for PNG: multiply by ~36 for visibility
      // But store actual class ID in all channels for proper single-channel interpretation
      exportData.data[i] = classId;     // R
      exportData.data[i + 1] = classId; // G
      exportData.data[i + 2] = classId; // B
      exportData.data[i + 3] = 255;     // A
    }

    exportCtx.putImageData(exportData, 0, 0);

    // Convert to blob
    let blob: Blob | null = null;
    exportCanvas.toBlob((b) => { blob = b; }, 'image/png');
    return blob;
  }, []);

  // Save annotation to server
  const handleSave = useCallback(async () => {
    if (!token || !sourceImage || !currentName) {
      setStatusMsg('Error: need image and name');
      return;
    }

    setStatusMsg('Saving...');

    try {
      // Get source image as base64
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = IMAGE_SIZE;
      srcCanvas.height = IMAGE_SIZE;
      const srcCtx = srcCanvas.getContext('2d')!;
      srcCtx.drawImage(sourceImage, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
      const imageBase64 = srcCanvas.toDataURL('image/png').split(',')[1];

      // Get mask as base64
      const maskCanvas = maskCanvasRef.current!;
      const maskCtx = maskCanvas.getContext('2d')!;
      const maskImageData = maskCtx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);

      // Create proper single-channel mask
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = IMAGE_SIZE;
      exportCanvas.height = IMAGE_SIZE;
      const exportCtx = exportCanvas.getContext('2d')!;
      const exportData = exportCtx.createImageData(IMAGE_SIZE, IMAGE_SIZE);

      for (let i = 0; i < maskImageData.data.length; i += 4) {
        const classId = maskImageData.data[i];
        exportData.data[i] = classId;
        exportData.data[i + 1] = classId;
        exportData.data[i + 2] = classId;
        exportData.data[i + 3] = 255;
      }
      exportCtx.putImageData(exportData, 0, 0);
      const maskBase64 = exportCanvas.toDataURL('image/png').split(',')[1];

      const res = await fetch('/api/ml/annotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: currentName,
          imageBase64,
          maskBase64,
          actions,
          metadata: {
            classCount: CLASSES.length,
            lineWidth: LINE_WIDTH,
          },
        }),
      });

      if (!res.ok) throw new Error(`Save failed: ${res.status}`);

      const saved = await res.json();
      setAnnotations((prev) => [...prev, { id: saved.id, name: currentName }]);
      setStatusMsg(`Saved: ${currentName}`);
    } catch (err) {
      setStatusMsg(`Error: ${err instanceof Error ? err.message : 'Save failed'}`);
    }
  }, [token, sourceImage, currentName, actions]);

  // Load annotation from server
  const handleLoadAnnotation = useCallback(
    async (id: string) => {
      if (!token) return;
      setStatusMsg('Loading...');

      try {
        const res = await fetch(`/api/ml/annotations/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Load failed: ${res.status}`);

        const data = await res.json();

        // Load source image
        const img = new Image();
        img.onload = () => {
          setSourceImage(img);
          setActions(data.actions || []);
          setRedoStack([]);
          setCurrentName(data.name || '');
          setStatusMsg(`Loaded: ${data.name}`);
        };
        img.src = `data:image/png;base64,${data.imageBase64}`;
      } catch (err) {
        setStatusMsg(`Error: ${err instanceof Error ? err.message : 'Load failed'}`);
      }
    },
    [token]
  );

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 flex-wrap">
        <span className="text-xs font-semibold text-gray-400 uppercase">ML Training</span>

        {/* File input */}
        <label className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs cursor-pointer">
          Load Image
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageLoad(file);
            }}
          />
        </label>

        <div className="w-px h-5 bg-gray-700" />

        {/* Draw modes */}
        <button
          onClick={() => setDrawMode('line')}
          className={`px-2 py-1 rounded text-xs ${drawMode === 'line' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Line (L)
        </button>
        <button
          onClick={() => setDrawMode('polygon')}
          className={`px-2 py-1 rounded text-xs ${drawMode === 'polygon' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Polygon (P)
        </button>

        <div className="w-px h-5 bg-gray-700" />

        {/* Undo/Redo */}
        <button onClick={undo} disabled={actions.length === 0} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded text-xs">
          Undo
        </button>
        <button onClick={redo} disabled={redoStack.length === 0} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded text-xs">
          Redo
        </button>

        <div className="w-px h-5 bg-gray-700" />

        {/* Toggle mask overlay */}
        <button
          onClick={() => setShowMask((v) => !v)}
          className={`px-2 py-1 rounded text-xs ${showMask ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Mask (M)
        </button>

        <div className="flex-1" />

        {/* Save */}
        <input
          type="text"
          placeholder="Annotation name"
          value={currentName}
          onChange={(e) => setCurrentName(e.target.value)}
          className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs w-32"
        />
        <button
          onClick={handleSave}
          disabled={!sourceImage || !currentName}
          className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-30 rounded text-xs"
        >
          Save
        </button>
      </div>

      {/* Class selector */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-700 overflow-x-auto">
        {CLASSES.map((cls) => (
          <button
            key={cls.id}
            onClick={() => setCurrentClass(cls.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap ${
              currentClass === cls.id ? 'ring-2 ring-white bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <span
              className="w-3 h-3 rounded-sm inline-block border border-gray-600"
              style={{ backgroundColor: cls.color }}
            />
            <span>{cls.name}</span>
            <span className="text-gray-500">({cls.shortcut})</span>
          </button>
        ))}
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Annotation list */}
        <div className="w-40 border-r border-gray-700 overflow-y-auto p-2 shrink-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Saved</h3>
          {annotations.length === 0 && (
            <p className="text-xs text-gray-500">No annotations yet</p>
          )}
          {annotations.map((ann) => (
            <button
              key={ann.id}
              onClick={() => handleLoadAnnotation(ann.id)}
              className="block w-full text-left px-2 py-1 text-xs hover:bg-gray-700 rounded truncate"
            >
              {ann.name}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-950 overflow-hidden p-4">
          {!sourceImage ? (
            <div className="text-center text-gray-500">
              <p className="text-sm mb-2">Load a satellite image to begin annotating</p>
              <p className="text-xs">Accepts 640x640 PNG or JPG images</p>
            </div>
          ) : (
            <div className="relative" style={{ width: IMAGE_SIZE * zoom, height: IMAGE_SIZE * zoom }}>
              <canvas
                ref={canvasRef}
                width={IMAGE_SIZE}
                height={IMAGE_SIZE}
                className="absolute inset-0 cursor-crosshair"
                style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
                onClick={handleCanvasClick}
                onContextMenu={handleContextMenu}
              />
              {/* Hidden canvases for mask and overlay */}
              <canvas ref={maskCanvasRef} width={IMAGE_SIZE} height={IMAGE_SIZE} className="hidden" />
              <canvas ref={overlayCanvasRef} width={IMAGE_SIZE} height={IMAGE_SIZE} className="hidden" />
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-2 py-1 border-t border-gray-700 text-xs text-gray-400">
        <span>{statusMsg || 'Ready'}</span>
        <span className="flex-1" />
        <span>Mode: {drawMode}</span>
        <span>|</span>
        <span>Class: {CLASSES[currentClass].name}</span>
        <span>|</span>
        <span>Actions: {actions.length}</span>
        {lineStart && <span>| Click endpoint to complete line</span>}
        {polygonPoints.length > 0 && <span>| {polygonPoints.length} pts (double-click to close)</span>}
      </div>
    </div>
  );
}
