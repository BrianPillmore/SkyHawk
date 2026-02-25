import type { SolarBuildingInsights } from '../types/solar';

export interface EnvironmentalImpact {
  /** Annual CO2 offset in metric tons if solar is installed */
  annualCO2OffsetTons: number;
  /** Lifetime CO2 offset (25 years) in metric tons */
  lifetimeCO2OffsetTons: number;
  /** Equivalent number of trees planted (1 tree = ~48 lbs CO2/year) */
  treeEquivalent: number;
  /** Equivalent miles not driven (1 gallon gas = ~19.6 lbs CO2, avg 25 mpg) */
  milesNotDriven: number;
  /** Equivalent homes powered for a year (avg US home = 10,500 kWh/yr) */
  homesPowered: number;
  /** Annual energy production in kWh */
  annualEnergyKwh: number;
  /** Carbon offset factor from Solar API (kg CO2 per MWh) */
  carbonFactorKgPerMwh: number;
}

/**
 * Calculate environmental impact metrics from Solar API data.
 *
 * Uses Google Solar API's carbonOffsetFactorKgPerMwh for accurate
 * regional grid carbon intensity calculations.
 */
export function calculateEnvironmentalImpact(
  solarInsights: SolarBuildingInsights,
  systemSizeKw: number = 0,
): EnvironmentalImpact {
  const potential = solarInsights.solarPotential;

  // Get annual energy from the best panel config, or estimate from system size
  let annualEnergyKwh = 0;
  if (potential.solarPanelConfigs && potential.solarPanelConfigs.length > 0) {
    // Use the largest config (max panels)
    const bestConfig = potential.solarPanelConfigs[potential.solarPanelConfigs.length - 1];
    annualEnergyKwh = bestConfig.yearlyEnergyDcKwh * 0.85; // DC to AC conversion
  } else if (systemSizeKw > 0) {
    // Estimate: ~1,400 kWh/kW in average US location
    annualEnergyKwh = systemSizeKw * 1400;
  } else {
    // Use max sunshine hours as rough estimate
    const maxPanels = potential.maxArrayPanelsCount;
    const panelWatts = potential.panelCapacityWatts ?? 400;
    annualEnergyKwh = (maxPanels * panelWatts * potential.maxSunshineHoursPerYear) / 1000 * 0.85;
  }

  // Carbon offset factor from Solar API (kg CO2 per MWh of electricity)
  const carbonFactorKgPerMwh = potential.carbonOffsetFactorKgPerMwh || 400; // US avg ~400
  const annualMwh = annualEnergyKwh / 1000;

  // Annual CO2 offset in metric tons
  const annualCO2OffsetKg = annualMwh * carbonFactorKgPerMwh;
  const annualCO2OffsetTons = annualCO2OffsetKg / 1000;

  // Lifetime (25 years with 0.5% annual degradation)
  let lifetimeKwh = 0;
  for (let year = 0; year < 25; year++) {
    lifetimeKwh += annualEnergyKwh * Math.pow(0.995, year);
  }
  const lifetimeCO2OffsetTons = (lifetimeKwh / 1000) * carbonFactorKgPerMwh / 1000;

  // Tree equivalents: 1 mature tree absorbs ~48 lbs (21.8 kg) CO2/year
  const treeEquivalent = Math.round(annualCO2OffsetKg / 21.8);

  // Miles not driven: avg car emits ~404 g CO2/mile
  const milesNotDriven = Math.round(annualCO2OffsetKg / 0.404);

  // Homes powered: avg US home uses ~10,500 kWh/year
  const homesPowered = annualEnergyKwh / 10500;

  return {
    annualCO2OffsetTons: Math.round(annualCO2OffsetTons * 100) / 100,
    lifetimeCO2OffsetTons: Math.round(lifetimeCO2OffsetTons * 100) / 100,
    treeEquivalent,
    milesNotDriven,
    homesPowered: Math.round(homesPowered * 100) / 100,
    annualEnergyKwh: Math.round(annualEnergyKwh),
    carbonFactorKgPerMwh,
  };
}
