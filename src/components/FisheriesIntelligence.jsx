import React, { useMemo } from 'react';
import speciesData from '../data/species.json';
import { evaluateSuitability, calculateSustainabilityScore, generateFisheriesAlerts } from '../utils/fisheries.js';

/**
 * SustainabilityMeter - Circular highlight for the main score
 */
function SustainabilityMeter({ score }) {
  const getColor = (s) => {
    if (s >= 70) return '#00d4ff';
    if (s >= 50) return '#fbbf24';
    return '#ff4d6d';
  };

  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(36,144,204,0.1)" strokeWidth="8" />
          <circle 
            cx="60" cy="60" r="54" fill="none" 
            stroke={getColor(score)} 
            strokeWidth="8" 
            strokeDasharray="339.29" 
            strokeDashoffset={339.29 - (339.29 * score) / 100}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          fontSize: '1.8rem', fontWeight: 900, color: getColor(score)
        }}>
          {score}
        </div>
      </div>
      <div className="mt-4">
        <div style={{ fontSize: '0.7rem', color: '#4db8e8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Sustainability Index
        </div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2f4ff', marginTop: '0.2rem' }}>
          {score >= 70 ? 'Excellent' : score >= 50 ? 'Moderate' : 'Critical Warning'}
        </div>
      </div>
    </div>
  );
}

/**
 * StockCard - Individual species stock health
 */
function StockCard({ species }) {
  const color = species.stock_health >= 70 ? '#00d4ff' : species.stock_health >= 50 ? '#fbbf24' : '#ff4d6d';
  const trendIcon = species.trend === 'Stable' ? '—' : species.trend === 'Declining' ? '▼' : '⚠';

  return (
    <div className="glass-card p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2f4ff' }}>{species.name}</div>
          <div style={{ fontSize: '0.65rem', color: '#4db8e8', marginTop: '0.1rem' }}>
            Trend: <span style={{ color }}>{species.trend} {trendIcon}</span>
          </div>
        </div>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color }}>{species.stock_health}%</div>
      </div>
      <div style={{ width: '100%', height: 6, background: 'rgba(36,144,204,0.1)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${species.stock_health}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

/**
 * DecisionCard - Sustainability result for a species
 */
function DecisionCard({ species, result }) {
  const color = result.suitable ? '#00d4ff' : '#ff4d6d';
  const bgColor = result.suitable ? 'rgba(0,212,255,0.05)' : 'rgba(255,77,109,0.05)';
  const borderColor = result.suitable ? 'rgba(0,212,255,0.2)' : 'rgba(255,77,109,0.2)';

  return (
    <div style={{ 
      background: bgColor, border: `1px solid ${borderColor}`, borderRadius: '0.8rem', padding: '1rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem'
    }}>
      <div className="flex justify-between items-center">
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{species.name}</span>
        <span style={{ 
          fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', padding: '0.2rem 0.5rem',
          borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#4db8e8'
        }}>
          {species.legal_status}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem' }}>{result.suitable ? '✅' : '🚫'}</span>
        <span style={{ fontSize: '0.75rem', color: result.suitable ? '#c3eafb' : '#ffccd5' }}>
          {result.reason}
        </span>
      </div>
    </div>
  );
}

/**
 * Main FisheriesIntelligence Component
 */
export default function FisheriesIntelligence({ currentData }) {
  // Memoize all heavy logic
  const evaluationResults = useMemo(() => {
    return speciesData.map(s => ({
      species: s,
      result: evaluateSuitability(s, currentData)
    }));
  }, [currentData]);

  const sustainabilityScore = useMemo(() => {
    return calculateSustainabilityScore(speciesData, currentData);
  }, [currentData]);

  const alerts = useMemo(() => {
    return generateFisheriesAlerts(speciesData, sustainabilityScore, currentData);
  }, [sustainabilityScore, currentData]);

  const suitableCount = evaluationResults.filter(r => r.result.suitable).length;

  return (
    <div className="flex flex-col gap-8">
      {/* SECTION 1: OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SustainabilityMeter score={sustainabilityScore} />
        
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-card p-6 flex flex-col justify-center">
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎣</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e2f4ff' }}>{suitableCount} / {speciesData.length}</div>
            <div style={{ fontSize: '0.7rem', color: '#4db8e8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Species Suitable for Fishing
            </div>
          </div>

          <div className="glass-card p-4 overflow-y-auto" style={{ maxHeight: 180 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#4db8e8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Live Alerts
            </div>
            <div className="flex flex-col gap-3">
              {alerts.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#135580' }}>No active fisheries alerts.</div>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} style={{ 
                    fontSize: '0.72rem', display: 'flex', gap: '0.5rem', 
                    color: a.type === 'danger' ? '#ff4d6d' : a.type === 'warning' ? '#fbbf24' : '#00d4ff'
                  }}>
                    <span>{a.type === 'danger' ? '🚨' : a.type === 'warning' ? '⚠' : 'ℹ'}</span>
                    <span>{a.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: STOCK ASSESSMENT */}
      <div>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#4db8e8', textTransform: 'uppercase', marginBottom: '0.8rem' }}>
          Stock Assessment
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {speciesData.map(s => <StockCard key={s.id} species={s} />)}
        </div>
      </div>

      {/* SECTION 3: SPECIES DECISIONS */}
      <div>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#4db8e8', textTransform: 'uppercase', marginBottom: '0.8rem' }}>
          Intelligence Decisions & Suitability
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {evaluationResults.map(r => (
            <DecisionCard key={r.species.id} species={r.species} result={r.result} />
          ))}
        </div>
      </div>
    </div>
  );
}
