import axios from 'axios';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: "lat and lon query params are required" });
    }

    try {
        const url = "https://marine-api.open-meteo.com/v1/marine";
        const params = {
            latitude,
            longitude,
            hourly: [
                "wave_height",
                "wind_wave_height",
                "swell_wave_height",
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

        // Fetch marine data
        const marineRes = await axios.get(url, { params, timeout: 10000 });
        const marine = marineRes.data;

        // Fetch atmospheric + SST
        const weatherUrl = "https://api.open-meteo.com/v1/forecast";
        const weatherParams = {
            latitude,
            longitude,
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

        // Merge sequences
        const times = weather.hourly?.time ?? [];
        const rows = times.map((t, i) => ({
            timestamp: t,
            sea_surface_temp: weather.hourly.sea_surface_temperature?.[i] ?? null,
            wind_speed: weather.hourly.wind_speed_10m?.[i] ?? null,
            air_pressure: weather.hourly.surface_pressure?.[i] ?? null,
            wave_height: marine.hourly?.wave_height?.[i] ?? null,
        }));

        res.status(200).json({ lat: latitude, lon: longitude, data: rows });
    } catch (err) {
        console.error("Open-Meteo error:", err.message);
        res.status(502).json({ error: "Failed to fetch live data: " + err.message });
    }
}
