import React, { useMemo, memo } from 'react';
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import { computeStats, computeMovingAverage } from '../utils/anomaly';

// ─── Historical chart configuration (stable reference — defined outside component) ─
const HIST_PARAMS = [
    { key: 'WTMP', label: 'Water Temperature', unit: '°C',  color: '#00d4ff' },
    { key: 'WSPD', label: 'Wind Speed',         unit: 'm/s', color: '#4db8e8' },
    { key: 'WVHT', label: 'Wave Height',         unit: 'm',   color: '#38bdf8' },
    { key: 'PRES', label: 'Air Pressure',        unit: 'hPa', color: '#fbbf24' },
];

// Stable axis / grid style objects — defined once, not recreated per render
const GRID_STYLE = { strokeDasharray: '3 3', stroke: 'rgba(36,144,204,0.1)', vertical: false };
const XAXIS_STYLE = { fill: '#4db8e8', fontSize: 9 };
const XAXIS_LINE = { stroke: 'rgba(36,144,204,0.2)' };
const YAXIS_STYLE = { fill: '#4db8e8', fontSize: 10 };
const ACTIVE_DOT = { r: 5, stroke: '#fff', strokeWidth: 1 };

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function HistTooltip({ active, payload, label, unit }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'rgba(4,24,46,0.95)',
            border: '1px solid rgba(0,212,255,0.35)',
            borderRadius: '0.6rem',
            padding: '0.6rem 0.85rem',
            fontSize: '0.78rem',
            backdropFilter: 'blur(12px)',
            minWidth: 180,
        }}>
            <div style={{ color: '#4db8e8', fontWeight: 700, marginBottom: 4, fontSize: '0.7rem' }}>{label}</div>
            {payload.map((entry) => (
                <div
                    key={entry.dataKey}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: entry.color }}
                >
                    <span>{entry.name}</span>
                    <span style={{ fontWeight: 700 }}>
                        {entry.value != null ? `${Number(entry.value).toFixed(2)} ${unit}` : '—'}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Anomaly badge ────────────────────────────────────────────────────────────
function AnomalyBadge({ s }) {
    if (!s || s.anomalyCount === 0) return null;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,77,109,0.12)', border: '1px solid rgba(255,77,109,0.3)',
                borderRadius: 99, padding: '0.2rem 0.6rem',
                fontSize: '0.68rem', color: '#ff4d6d', fontWeight: 700,
            }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff4d6d', display: 'inline-block' }} />
                {s.anomalyCount} anomal{s.anomalyCount === 1 ? 'y' : 'ies'}
            </div>
            {s.moderateCount > 0 && (
                <div style={{
                    background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.28)',
                    borderRadius: 99, padding: '0.2rem 0.5rem',
                    fontSize: '0.65rem', color: '#fb923c', fontWeight: 700,
                }}>{s.moderateCount} mod</div>
            )}
            {s.extremeCount > 0 && (
                <div style={{
                    background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)',
                    borderRadius: 99, padding: '0.2rem 0.5rem',
                    fontSize: '0.65rem', color: '#ef4444', fontWeight: 700,
                }}>{s.extremeCount} extreme</div>
            )}
        </div>
    );
}

// ─── Single parameter chart — memoized ────────────────────────────────────────
const HistParamChart = memo(function HistParamChart({ param, chartData, stats, showMovingAverage }) {
    const s = stats[param.key];

    const validCount = useMemo(
        () => chartData.filter(r => !isNaN(r[param.key])).length,
        [chartData, param.key]
    );

    const activeDot = useMemo(
        () => ({ ...ACTIVE_DOT, fill: param.color }),
        [param.color]
    );

    const maKey = `${param.key}_ma`;

    return (
        <div className="glass-card p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div style={{ width: 3, height: 18, borderRadius: 2, background: param.color }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: param.color }}>
                        {param.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#4db8e8', opacity: 0.7 }}>({param.unit})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AnomalyBadge s={s} />
                    <span style={{
                        background: 'rgba(36,144,204,0.10)',
                        border: '1px solid rgba(36,144,204,0.2)',
                        borderRadius: 99, padding: '0.2rem 0.6rem',
                        fontSize: '0.68rem', color: '#4db8e8',
                    }}>
                        {validCount} pts
                    </span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid {...GRID_STYLE} />
                    <XAxis
                        dataKey="label"
                        tick={XAXIS_STYLE}
                        axisLine={XAXIS_LINE}
                        tickLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        tick={YAXIS_STYLE}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                    />
                    <Tooltip content={<HistTooltip unit={param.unit} />} />

                    {/* Main data line */}
                    <Line
                        type="monotone"
                        dataKey={param.key}
                        name={param.label}
                        stroke={param.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={activeDot}
                        connectNulls={false}
                        isAnimationActive={false}
                    />

                    {/* 24-period moving average overlay */}
                    {showMovingAverage && (
                        <Line
                            type="monotone"
                            dataKey={maKey}
                            name="24h MA"
                            stroke={param.color}
                            strokeWidth={1.5}
                            strokeOpacity={0.45}
                            strokeDasharray="6 3"
                            dot={false}
                            activeDot={false}
                            connectNulls
                            isAnimationActive={false}
                        />
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
});

// ─── Main export ─────────────────────────────────────────────────────────────
const HistoricalChart = memo(function HistoricalChart({ data, showMovingAverage = false }) {
    const chartData = useMemo(() => {
        const rows = data.map((row) => ({
            ...row,
            label: (() => {
                if (row.timestamp instanceof Date && !isNaN(row.timestamp)) {
                    return row.timestamp.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
                }
                return '—';
            })(),
        }));

        // Inject MA columns when toggled on
        if (showMovingAverage) {
            HIST_PARAMS.forEach((p) => {
                const maValues = computeMovingAverage(data, p.key, 24);
                maValues.forEach((v, i) => { rows[i][`${p.key}_ma`] = v; });
            });
        }

        return rows;
    }, [data, showMovingAverage]);

    // Compute stats for anomaly badges — memoized
    const stats = useMemo(
        () => Object.fromEntries(HIST_PARAMS.map((p) => [p.key, computeStats(data, p.key)])),
        [data]
    );

    if (!data.length) {
        return (
            <div className="glass-card flex items-center justify-center" style={{ height: 300, color: '#4db8e8' }}>
                No historical data for this year — try another year.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {HIST_PARAMS.map((param) => (
                <HistParamChart
                    key={param.key}
                    param={param}
                    chartData={chartData}
                    stats={stats}
                    showMovingAverage={showMovingAverage}
                />
            ))}
        </div>
    );
});

export default HistoricalChart;
