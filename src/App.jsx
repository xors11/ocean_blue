import React, { useMemo, useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import OceanChart from './components/OceanChart';
import StatsCards from './components/StatsCards';
import LoadingSpinner from './components/LoadingSpinner';
import HistoricalChart from './components/HistoricalChart';
import OceanAnalyticsSummary, { LIVE_ANALYTICS_PARAMS, HIST_ANALYTICS_PARAMS } from './components/OceanAnalyticsSummary';
import { useBuoyData } from './hooks/useBuoyData';
import { useHistoricalBuoyData } from './hooks/useHistoricalBuoyData';
import { LOCATIONS, PARAMETERS } from './data/constants';

const YEARS = Array.from({ length: 2023 - 2012 + 1 }, (_, i) => 2023 - i); // [2023..2012]

// Max rows to pass to charts — prevents the renderer from stalling on huge sets.
const MAX_RENDER_ROWS = 5000;

// ─── Moving Average Toggle ────────────────────────────────────────────────────
function MAToggle({ enabled, onToggle }) {
    return (
        <label
            htmlFor="ma-toggle"
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', userSelect: 'none',
                background: 'rgba(36,144,204,0.08)',
                border: '1px solid rgba(36,144,204,0.2)',
                borderRadius: 99, padding: '0.3rem 0.75rem',
                fontSize: '0.72rem', color: '#4db8e8',
                transition: 'border-color 0.2s',
            }}
        >
            {/* Switch track */}
            <span
                style={{
                    position: 'relative', display: 'inline-block',
                    width: 30, height: 16, flexShrink: 0,
                }}
            >
                <input
                    id="ma-toggle"
                    type="checkbox"
                    checked={enabled}
                    onChange={onToggle}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                {/* Track */}
                <span style={{
                    position: 'absolute', inset: 0, borderRadius: 99,
                    background: enabled ? 'rgba(0,212,255,0.55)' : 'rgba(36,144,204,0.2)',
                    transition: 'background 0.2s',
                }} />
                {/* Thumb */}
                <span style={{
                    position: 'absolute', top: 2,
                    left: enabled ? 16 : 2,
                    width: 12, height: 12, borderRadius: '50%',
                    background: enabled ? '#00d4ff' : '#4db8e8',
                    transition: 'left 0.2s, background 0.2s',
                }} />
            </span>
            Show 24h Trend Line
        </label>
    );
}

export default function App() {
    const [locationId, setLocationId] = useState(LOCATIONS[0].id);
    const [activeParams, setActiveParams] = useState(['sea_surface_temp', 'wind_speed', 'air_pressure']);

    // ── View mode + year filter ── ─────────────────────────────────────────────
    const [viewMode, setViewMode] = useState('live');        // 'live' | 'historical'
    const [selectedYear, setSelectedYear] = useState(2023); // Default latest year

    // ── Moving average toggle ──────────────────────────────────────────────────
    const [showMA, setShowMA] = useState(false);
    const toggleMA = useCallback(() => setShowMA((v) => !v), []);

    const location = LOCATIONS.find((l) => l.id === locationId) || LOCATIONS[0];

    const isHistorical = viewMode === 'historical';

    // ── Live data hook (auto-refresh paused when in historical mode) ──────────
    const { data, loading, error, lastUpdated, refetch, pauseRefresh, resumeRefresh } =
        useBuoyData(location.lat, location.lon);

    // Pause auto-refresh when historical mode is active
    useEffect(() => {
        if (isHistorical) {
            pauseRefresh?.();
        } else {
            resumeRefresh?.();
        }
    }, [isHistorical, pauseRefresh, resumeRefresh]);

    // ── Historical data hook — lazy, cached; never re-fetches ─────────────────
    const { allData: histAllData, hasLoaded, loading: histLoading, error: histError, load: loadHistorical } =
        useHistoricalBuoyData();

    // Trigger fetch exactly once, the first time user opens Historical mode
    useEffect(() => {
        if (isHistorical && !hasLoaded && !histLoading) {
            loadHistorical();
        }
    }, [isHistorical, hasLoaded, histLoading, loadHistorical]);

    // ── Memoized stats (only recalculates when live data or params change) ──────
    const stats = useMemo(
        () => OceanChart.computeStats(data, activeParams),
        [data, activeParams]
    );

    // ── Client-side year filter + render cap (both memoized) ──────────────────
    const filteredHistorical = useMemo(() => {
        const yearRows = histAllData.filter((r) => r.year === selectedYear);
        return yearRows.length > MAX_RENDER_ROWS
            ? yearRows.slice(yearRows.length - MAX_RENDER_ROWS)
            : yearRows;
    }, [histAllData, selectedYear]);

    // ── Stable callbacks ───────────────────────────────────────────────────────
    const toggleParam = useCallback((key) => {
        setActiveParams((prev) =>
            prev.includes(key)
                ? prev.length > 1 ? prev.filter((k) => k !== key) : prev
                : [...prev, key]
        );
    }, []);

    const handleLocationChange = useCallback((id) => {
        setLocationId(id);
    }, []);

    // ── Filter live analytics params to only what is active ───────────────────
    const liveAnalyticsParams = useMemo(
        () => LIVE_ANALYTICS_PARAMS.filter((p) => activeParams.includes(p.key)),
        [activeParams]
    );

    // ── Format last-updated timestamp ─────────────────────────────────────────
    const lastUpdatedStr = useMemo(
        () => lastUpdated
            ? lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : null,
        [lastUpdated]
    );

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* ── Sidebar ──────────────────────────────────────────────────────── */}
            <Sidebar
                locationId={locationId} onLocationChange={handleLocationChange}
                activeParams={activeParams} onToggleParam={toggleParam}
                onRefresh={refetch}
            />

            {/* ── Main Panel ───────────────────────────────────────────────────── */}
            <main
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '2rem 2.5rem',
                    background: 'linear-gradient(160deg, #020d18 0%, #04182e 60%, #071e2b 100%)',
                }}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
                    <div>
                        <h1
                            className="gradient-text"
                            style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}
                        >
                            Ocean Data Explorer
                        </h1>
                        <div style={{ color: '#4db8e8', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {location.label} &nbsp;·&nbsp; {isHistorical ? `Historical Data — ${selectedYear}` : 'Live Hourly Data'}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* ── View Mode Toggle ────────────────────────────────────── */}
                        <div className="view-toggle">
                            <button
                                className={viewMode === 'live' ? 'active' : ''}
                                onClick={() => setViewMode('live')}
                            >
                                📡 Live Forecast
                            </button>
                            <button
                                className={viewMode === 'historical' ? 'active' : ''}
                                onClick={() => setViewMode('historical')}
                            >
                                📊 Historical Data
                            </button>
                        </div>

                        {/* ── Year filter (historical mode only) ─────────────────── */}
                        {isHistorical && (
                            <select
                                className="ocean-select"
                                style={{ width: 'auto', minWidth: 110 }}
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                            >
                                {YEARS.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        )}

                        {/* Live-mode badges */}
                        {!isHistorical && (
                            <>
                                {error && (
                                    <div
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            background: 'rgba(255,77,109,0.1)',
                                            border: '1px solid rgba(255,77,109,0.3)',
                                            borderRadius: 99, padding: '0.25rem 0.7rem',
                                            fontSize: '0.7rem', color: '#ff4d6d',
                                        }}
                                    >
                                        ⚠ {error}
                                    </div>
                                )}
                                {lastUpdatedStr && (
                                    <div
                                        style={{
                                            background: 'rgba(36,144,204,0.1)',
                                            border: '1px solid rgba(36,144,204,0.2)',
                                            borderRadius: 99, padding: '0.25rem 0.7rem',
                                            fontSize: '0.7rem', color: '#4db8e8',
                                        }}
                                    >
                                        ↻ Updated {lastUpdatedStr}
                                    </div>
                                )}
                                {!loading && data.length > 0 && (
                                    <div
                                        style={{
                                            background: 'rgba(36,144,204,0.08)',
                                            border: '1px solid rgba(36,144,204,0.15)',
                                            borderRadius: 99, padding: '0.25rem 0.7rem',
                                            fontSize: '0.7rem', color: '#4db8e8',
                                        }}
                                    >
                                        {data.length} observations
                                    </div>
                                )}
                            </>
                        )}

                        {/* Historical badge */}
                        {isHistorical && !histLoading && !histError && (
                            <div
                                style={{
                                    background: 'rgba(36,144,204,0.08)',
                                    border: '1px solid rgba(36,144,204,0.15)',
                                    borderRadius: 99, padding: '0.25rem 0.7rem',
                                    fontSize: '0.7rem', color: '#4db8e8',
                                }}
                            >
                                {filteredHistorical.length} records
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Content ─────────────────────────────────────────────────────── */}
                {isHistorical ? (
                    /* ── HISTORICAL VIEW ─────────────────────────────────────────── */
                    histLoading ? (
                        <LoadingSpinner message="Loading historical buoy data…" />
                    ) : histError ? (
                        <div
                            className="glass-card flex flex-col items-center justify-center gap-4"
                            style={{ height: 340, textAlign: 'center', padding: '2rem' }}
                        >
                            <div style={{ fontSize: '2rem' }}>📂</div>
                            <div style={{ color: '#ff4d6d', fontWeight: 700 }}>Unable to load historical data</div>
                            <div style={{ color: '#4db8e8', fontSize: '0.8rem', maxWidth: 360 }}>
                                {histError}. Make sure the backend server is running on port 5000.
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {/* Moving Average Toggle */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <MAToggle enabled={showMA} onToggle={toggleMA} />
                            </div>

                            {/* Charts */}
                            <HistoricalChart data={filteredHistorical} showMovingAverage={showMA} />

                            {/* Analytics Summary Panel */}
                            <OceanAnalyticsSummary data={filteredHistorical} params={HIST_ANALYTICS_PARAMS} />
                        </div>
                    )
                ) : (
                    /* ── LIVE VIEW ──────────────────────────────────────────────── */
                    loading ? (
                        <LoadingSpinner message="Fetching live ocean data…" />
                    ) : error && data.length === 0 ? (
                        <div
                            className="glass-card flex flex-col items-center justify-center gap-4"
                            style={{ height: 340, textAlign: 'center', padding: '2rem' }}
                        >
                            <div style={{ fontSize: '2rem' }}>🌊</div>
                            <div style={{ color: '#ff4d6d', fontWeight: 700 }}>Unable to load ocean data</div>
                            <div style={{ color: '#4db8e8', fontSize: '0.8rem', maxWidth: 360 }}>
                                {error}. Make sure the backend server is running on port 5000.
                            </div>
                            <button
                                onClick={refetch}
                                style={{
                                    background: 'rgba(0,212,255,0.1)',
                                    border: '1px solid rgba(0,212,255,0.3)',
                                    borderRadius: '0.5rem',
                                    padding: '0.4rem 1rem',
                                    color: '#00d4ff',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                }}
                            >
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {/* Moving Average Toggle */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <MAToggle enabled={showMA} onToggle={toggleMA} />
                            </div>

                            {/* Charts */}
                            <OceanChart data={data} activeParams={activeParams} showMovingAverage={showMA} />

                            {/* Existing Stats */}
                            <div>
                                <div
                                    style={{
                                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                                        color: '#4db8e8', textTransform: 'uppercase', marginBottom: '0.75rem',
                                    }}
                                >
                                    Summary Statistics
                                </div>
                                <StatsCards stats={stats} activeParams={activeParams} dataCount={data.length} />
                            </div>

                            {/* Analytics Summary Panel */}
                            <OceanAnalyticsSummary data={data} params={liveAnalyticsParams} />
                        </div>
                    )
                )}
            </main>
        </div>
    );
}
