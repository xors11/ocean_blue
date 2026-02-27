const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(cors());

// ─── /api/buoy (Live forecast via Open-Meteo Marine API) ────────────────────
app.get("/api/buoy", async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: "lat and lon query params are required" });
    }

    try {
        const url = "https://marine-api.open-meteo.com/v1/marine";
        const params = {
            latitude: lat,
            longitude: lon,
            hourly: [
                "wave_height",
                "wind_wave_height",
                "swell_wave_height",
                "sea_surface_temperature",
            ].join(","),
            current: [
                "wave_height",
                "wave_direction",
                "wave_period",
            ].join(","),
            past_days: 2,
            forecast_days: 3,
            timezone: "auto",
        };

        const marineRes = await axios.get(url, { params, timeout: 10000 });
        const marine = marineRes.data;

        const weatherUrl = "https://api.open-meteo.com/v1/forecast";
        const weatherParams = {
            latitude: lat,
            longitude: lon,
            hourly: [
                "temperature_2m",
                "wind_speed_10m",
                "surface_pressure",
                "sea_surface_temperature",
            ].join(","),
            past_days: 2,
            forecast_days: 3,
            timezone: "auto",
        };
        const weatherRes = await axios.get(weatherUrl, { params: weatherParams, timeout: 10000 });
        const weather = weatherRes.data;

        const times = weather.hourly?.time ?? [];
        const rows = times.map((t, i) => ({
            timestamp: t,
            sea_surface_temp: marine.hourly?.sea_surface_temperature?.[i] ?? weather.hourly?.sea_surface_temperature?.[i] ?? null,
            wind_speed: weather.hourly.wind_speed_10m?.[i] ?? null,
            air_pressure: weather.hourly.surface_pressure?.[i] ?? null,
            wave_height: marine.hourly?.wave_height?.[i] ?? null,
        }));

        res.json({ lat, lon, data: rows });
    } catch (err) {
        console.error("Open-Meteo error:", err.message);
        res.status(502).json({ error: "Failed to fetch live data: " + err.message });
    }
});

// ─── /api/buoy-historical (CSV) ─────────────────────────────────────────────
app.get("/api/buoy-historical", (req, res) => {
    const filePath = path.join(process.cwd(), "data", "46042_master_2012_2023.csv");
    const results = [];

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Historical data file not found" });
    }

    fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", () => {
            res.json(results);
        })
        .on("error", (err) => {
            console.error("CSV error:", err);
            res.status(500).json({ error: "Failed to read CSV" });
        });
});

// ─── /api/fisheries (Unified Risk Framework) ───────────────────────────────
app.get("/api/fisheries", async (req, res) => {
    const filePath = path.join(process.cwd(), "data", "fisheries_indian_region_2023.csv");
    const regionQuery = req.query.region?.toLowerCase();
    const results = [];

    // 1. Fetch live SST for Climate Stress Score
    let climateStressData = { sst_avg: 28.5 };
    try {
        const sstRes = await axios.get(`https://marine-api.open-meteo.com/v1/marine?latitude=-2&longitude=81&hourly=sea_surface_temperature&past_days=1&forecast_days=1`);
        const sstData = sstRes.data.hourly?.sea_surface_temperature || [];
        const validSst = sstData.filter(v => v !== null);
        if (validSst.length > 0) {
            climateStressData.sst_avg = validSst.reduce((a, b) => a + b, 0) / validSst.length;
        }
        // Simulation: Make Indian Ocean warmer for demo consistency
        if (regionQuery === 'indian ocean') climateStressData.sst_avg += 2.5;
    } catch (err) {
        console.error("SST Fetch fail:", err.message);
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Data file not found" });
    }

    fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => {
            const record = {
                id: Number(row.id),
                region: row.region,
                species: row.species,
                stock_health_percent: Number(row.stock_health_percent),
                trend: row.trend,
                msy_tonnes: Number(row.msy_tonnes),
                current_catch_tonnes: Number(row.current_catch_tonnes),
                protected: row.protected === "true"
            };
            if (!regionQuery || record.region.toLowerCase() === regionQuery) {
                results.push(record);
            }
        })
        .on("end", () => {
            if (results.length === 0) return res.json({ count: 0 });

            const sst = climateStressData.sst_avg;

            const avgStockHealth = results.reduce((sum, s) => sum + s.stock_health_percent, 0) / results.length;
            const avgMSY = results.reduce((sum, s) => sum + ((s.current_catch_tonnes / s.msy_tonnes) * 100), 0) / results.length;
            const msyPressureScore = Math.min(avgMSY, 120);
            const decliningCount = results.filter(s => s.trend === "Declining" || s.trend === "Critical").length;
            const decliningPercent = (decliningCount / results.length) * 100;

            let climateScore = 20;
            if (sst > 30) climateScore = 90;
            else if (sst > 28) climateScore = 60;
            else if (sst > 26) climateScore = 40;

            const sustainabilityIndex = (avgStockHealth * 0.5) + ((100 - msyPressureScore) * 0.25) + ((100 - decliningPercent) * 0.15) + ((100 - climateScore) * 0.10);
            const finalIndex = Math.max(0, Math.min(100, Math.round(sustainabilityIndex)));
            const collapseRisk = (msyPressureScore * 0.35) + (decliningPercent * 0.25) + ((100 - avgStockHealth) * 0.25) + (climateScore * 0.15);
            const finalCollapseRisk = Math.max(0, Math.min(100, Math.round(collapseRisk)));
            const projectedIndex = finalIndex - (finalCollapseRisk * 0.05);

            let sustLevel = "Caution";
            if (finalIndex >= 70) sustLevel = "Sustainable";
            else if (finalIndex < 50) sustLevel = "Critical";

            let riskLevel = "Moderate";
            if (finalCollapseRisk < 30) riskLevel = "Low";
            else if (finalCollapseRisk > 60) riskLevel = "High";

            res.json({
                region: regionQuery || "All Regions",
                sustainability_index: finalIndex,
                sustainability_level: sustLevel,
                collapse_risk: { score: finalCollapseRisk, level: riskLevel },
                climate_stress: { sst: parseFloat(sst.toFixed(1)), score: climateScore },
                projection: { index_6_month: Math.max(0, Math.round(projectedIndex)), change: Math.round(projectedIndex - finalIndex) },
                stats: {
                    count: results.length,
                    avg_stock_health: Math.round(avgStockHealth),
                    msy_utilization: Math.round(avgMSY),
                    declining_percent: Math.round(decliningPercent),
                    critical_species_count: results.filter(r => r.stock_health_percent < 40).length
                },
                data: results
            });
        });
});

module.exports = app;
