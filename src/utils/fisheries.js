/**
 * fisheries.js
 * 
 * Logic engine for the Fisheries Intelligence module.
 * Separates decision logic from UI components.
 */

/**
 * Evaluates whether conditions are suitable for fishing a specific species.
 * 
 * @param {Object} species - Species constraints from species.json
 * @param {Object} currentData - Latest ocean data (temp, wave_height)
 * @returns {Object} { suitable: boolean, reason: string }
 */
export function evaluateSuitability(species, currentData) {
  const { temp_range, max_wave_height, season_months, legal_status } = species;
  const temp = currentData.sea_surface_temp;
  const wave = currentData.wave_height;
  const currentMonth = new Date().getMonth() + 1; // 1-12

  if (legal_status === 'Protected') {
    return { suitable: false, reason: 'Species is legally protected. Conservation active.' };
  }

  if (!season_months.includes(currentMonth)) {
    return { suitable: false, reason: 'Outside of legal fishing season.' };
  }

  if (temp < temp_range[0] || temp > temp_range[1]) {
    return { suitable: false, reason: `Water temp (${temp}°C) outside optimal range (${temp_range[0]}-${temp_range[1]}°C).` };
  }

  if (wave > max_wave_height) {
    return { suitable: false, reason: `Wave height (${wave}m) exceeds safety limit (${max_wave_height}m).` };
  }

  return { suitable: true, reason: 'Conditions optimal for sustainable catch.' };
}

/**
 * Calculates a sustainability score (0-100) based on multiple factors.
 * 
 * @param {Array} speciesList - List of all species
 * @param {Object} currentData - Latest ocean data
 * @returns {number} 0-100 score
 */
export function calculateSustainabilityScore(speciesList, currentData) {
  if (!speciesList.length) return 0;

  // 1. Average Stock Health (40%)
  const avgStockHealth = speciesList.reduce((acc, s) => acc + s.stock_health, 0) / speciesList.length;

  // 2. Temp Suitability (40%)
  const suitableTempCount = speciesList.filter(s => {
    const temp = currentData.sea_surface_temp;
    return temp >= s.temp_range[0] && temp <= s.temp_range[1];
  }).length;
  const tempScore = (suitableTempCount / speciesList.length) * 100;

  // 3. Wave Safety (20%)
  const safeWaveCount = speciesList.filter(s => {
    return currentData.wave_height <= s.max_wave_height;
  }).length;
  const waveScore = (safeWaveCount / speciesList.length) * 100;

  const totalScore = (avgStockHealth * 0.4) + (tempScore * 0.4) + (waveScore * 0.2);
  return Math.round(totalScore);
}

/**
 * Generates dynamic alerts based on environment and stocks.
 */
export function generateFisheriesAlerts(speciesList, sustainabilityScore, currentData) {
  const alerts = [];

  if (currentData.wave_height > 3) {
    alerts.push({ type: 'danger', message: 'Rough Sea Warning: High waves pose safety risk for small vessels.' });
  }

  if (sustainabilityScore < 60) {
    alerts.push({ type: 'warning', message: 'Low Sustainability Index: Recommendation to reduce fishing effort.' });
  }

  speciesList.forEach(s => {
    if (s.stock_health < 50) {
      alerts.push({ type: 'warning', message: `Biological Alert: ${s.name} stocks are under pressure (${s.stock_health}%).` });
    }
    if (s.legal_status === 'Protected') {
      alerts.push({ type: 'info', message: `Conservation: ${s.name} is strictly protected this area.` });
    }
  });

  return alerts;
}
