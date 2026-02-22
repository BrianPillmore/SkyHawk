import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { capturePropertyImage, analyzeRoofCondition } from '../../services/visionApi';
import type { RoofConditionAssessment, RoofMaterialType, DamageType, DamageSeverity } from '../../types';
import {
  calculateConditionCategory,
  estimateRemainingLife,
  generateFindings,
  generateRecommendations,
} from '../../utils/roofCondition';

export default function AnalyzeConditionButton() {
  const { apiKey } = useGoogleMaps();
  const { activePropertyId, properties, setRoofCondition, setActivePanel } = useStore();

  const activeProperty = properties.find((p) => p.id === activePropertyId);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = !activeProperty || !apiKey || isAnalyzing;

  const handleClick = async () => {
    if (!activeProperty || !apiKey) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Capture property image
      const { base64 } = await capturePropertyImage(
        activeProperty.lat,
        activeProperty.lng,
        apiKey,
        20,
        640
      );

      // Analyze roof condition
      const response = await analyzeRoofCondition(base64);

      // Build assessment
      const materialType = response.materialType as RoofMaterialType;
      const overallScore = response.overallScore;
      const estimatedAgeYears = response.estimatedAgeYears;
      const category = calculateConditionCategory(overallScore);
      const estimatedRemainingLifeYears = estimateRemainingLife(
        materialType,
        estimatedAgeYears,
        overallScore
      );

      const damageDetected = response.damages.map((d) => ({
        type: d.type as DamageType,
        severity: d.severity as DamageSeverity,
        description: d.description,
        confidence: d.confidence,
      }));

      const assessment: RoofConditionAssessment = {
        overallScore,
        category,
        estimatedAgeYears,
        estimatedRemainingLifeYears,
        materialType,
        materialConfidence: response.materialConfidence,
        findings: [],
        recommendations: [],
        damageDetected,
        assessedAt: new Date().toISOString(),
      };

      // Generate findings and recommendations
      assessment.findings = generateFindings(assessment);
      assessment.recommendations = generateRecommendations(assessment);

      // Store assessment
      setRoofCondition(assessment);

      // Switch to condition panel
      setActivePanel('condition');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze roof condition');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mb-4">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
          isDisabled
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-900/30'
        }`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        {isAnalyzing ? 'Analyzing...' : 'AI Condition Assessment'}
      </button>

      {/* Loading indicator */}
      {isAnalyzing && (
        <div className="mt-2">
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Analyzing roof condition, material, and damage...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-2 p-2.5 bg-red-900/30 border border-red-700/50 rounded-lg">
          <p className="text-xs text-red-300">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-400 hover:text-red-300 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Info text when no property */}
      {!activeProperty && (
        <p className="text-xs text-gray-500 mt-2">
          Search for an address to enable AI condition analysis.
        </p>
      )}

    </div>
  );
}
