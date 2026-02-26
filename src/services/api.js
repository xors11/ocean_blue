/**
 * services/api.js
 * All API calls go through this module. Components never fetch directly.
 */

const API_BASE = "";

/**
 * Fetch buoy data for a given location.
 * Handles both response shapes:
 *   - new server: { lat, lon, data: [...] }
 *   - old server (pre-refactor): [...]
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Array>} array of hourly observation objects
 */
export async function fetchBuoyData(lat, lon) {
    const url = `${API_BASE}/api/buoy?lat=${lat}&lon=${lon}`;
    const res = await fetch(url);

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
    }

    const json = await res.json();

    // New server: { lat, lon, data: [...] }
    if (json && Array.isArray(json.data)) return json.data;

    // Old server / flat array
    if (Array.isArray(json)) return json;

    throw new Error("Unexpected API response format — restart the backend server.");
}

/**
 * Fetch all historical buoy data from the local Express server.
 * Returns raw rows as-is; parsing is done in the hook.
 *
 * @returns {Promise<Array>} array of raw CSV row objects (string fields)
 */
export async function fetchHistoricalBuoyData() {
    const url = `${API_BASE}/api/buoy-historical`;
    const res = await fetch(url);

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
    }

    const json = await res.json();

    if (Array.isArray(json)) return json;
    throw new Error('Unexpected response from /api/buoy-historical');
}
