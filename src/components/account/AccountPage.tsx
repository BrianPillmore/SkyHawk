import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../store/useStore';

interface Upload {
  id: string;
  filename: string;
  address: string | null;
  total_area_sqft: number | null;
  facet_count: number | null;
  predominant_pitch: string | null;
  waste_percent: number | null;
  credits_awarded: number;
  created_at: string;
}

interface ExtractedData {
  address: string | null;
  totalAreaSqFt: number | null;
  facetCount: number | null;
  predominantPitch: string | null;
  pitchBreakdown: Array<{ pitch: string; area: number }>;
  wastePercent: number | null;
}

interface UploadResult {
  id: string;
  filename: string;
  extractedData: ExtractedData;
  creditsAwarded: number;
  reportCredits: number;
}

export default function AccountPage() {
  const { username, reportCredits, token, fetchProfile } = useStore();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadUploads = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/uploads/eagleview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUploads(data.uploads);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
    loadUploads();
  }, [fetchProfile, loadUploads]);

  const handleUpload = async (file: File) => {
    if (!token) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setError('');
    setLastUpload(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/uploads/eagleview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(body.error || 'Upload failed');
      }

      const result: UploadResult = await res.json();
      setLastUpload(result);

      // Refresh credits and uploads list
      await fetchProfile();
      await loadUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Account</h1>
          <p className="text-gray-400">Manage your profile, credits, and EagleView uploads</p>
        </div>

        {/* Profile Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gotruf-600 rounded-full flex items-center justify-center text-2xl font-bold">
              {username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-xl font-bold">{username}</h2>
              <p className="text-sm text-gray-500">Free Plan</p>
            </div>
          </div>
        </div>

        {/* Credits Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">Report Credits</h3>
          <div className="flex items-end gap-4 mb-4">
            <span className="text-4xl font-black text-gotruf-500">{reportCredits}</span>
            <span className="text-gray-400 pb-1">/ 6 free reports remaining</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 mb-3">
            <div
              className="bg-gotruf-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(reportCredits / 6) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            Upload an EagleView PDF below to earn 2 free GotRuf reports (max 6 credits).
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">Upload EagleView Report</h3>

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {lastUpload && (
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-bold text-green-400">+2 credits earned!</span>
              </div>
              <p className="text-sm text-gray-300 mb-2">
                Extracted from <span className="font-medium">{lastUpload.filename}</span>:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {lastUpload.extractedData.address && (
                  <div className="bg-gray-800/50 rounded px-2 py-1.5">
                    <span className="text-gray-500">Address: </span>
                    <span className="text-gray-300">{lastUpload.extractedData.address}</span>
                  </div>
                )}
                {lastUpload.extractedData.totalAreaSqFt && (
                  <div className="bg-gray-800/50 rounded px-2 py-1.5">
                    <span className="text-gray-500">Total Area: </span>
                    <span className="text-gray-300">{lastUpload.extractedData.totalAreaSqFt.toLocaleString()} sq ft</span>
                  </div>
                )}
                {lastUpload.extractedData.facetCount && (
                  <div className="bg-gray-800/50 rounded px-2 py-1.5">
                    <span className="text-gray-500">Facets: </span>
                    <span className="text-gray-300">{lastUpload.extractedData.facetCount}</span>
                  </div>
                )}
                {lastUpload.extractedData.predominantPitch && (
                  <div className="bg-gray-800/50 rounded px-2 py-1.5">
                    <span className="text-gray-500">Pitch: </span>
                    <span className="text-gray-300">{lastUpload.extractedData.predominantPitch}</span>
                  </div>
                )}
                {lastUpload.extractedData.wastePercent != null && (
                  <div className="bg-gray-800/50 rounded px-2 py-1.5">
                    <span className="text-gray-500">Waste: </span>
                    <span className="text-gray-300">{lastUpload.extractedData.wastePercent}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-gotruf-500 bg-gotruf-500/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin w-8 h-8 text-gotruf-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-gray-400">Processing PDF...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div>
                  <p className="text-gray-300 font-medium">Drop your EagleView PDF here</p>
                  <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                </div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={onFileSelect}
          />
        </div>

        {/* Upload History */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">Upload History</h3>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : uploads.length === 0 ? (
            <p className="text-gray-500 text-sm">No uploads yet. Upload an EagleView PDF to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-left py-2 pr-4">File</th>
                    <th className="text-left py-2 pr-4">Address</th>
                    <th className="text-right py-2 pr-4">Area (sq ft)</th>
                    <th className="text-right py-2">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((upload) => (
                    <tr key={upload.id} className="border-b border-gray-800/50">
                      <td className="py-2.5 pr-4 text-gray-400">
                        {new Date(upload.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-300 max-w-[200px] truncate">
                        {upload.filename}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-400 max-w-[200px] truncate">
                        {upload.address || '-'}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-300">
                        {upload.total_area_sqft ? upload.total_area_sqft.toLocaleString() : '-'}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="text-green-400 font-medium">+{upload.credits_awarded}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
