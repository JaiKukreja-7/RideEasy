export interface LocationInfo {
  lat: number;
  lng: number;
  accuracy: number | null;
  source: "gps" | "ip" | "default";
}

const DEFAULT_CENTER = { lat: 19.0760, lng: 72.8777 }; // Mumbai

export const getReliableLocation = async (): Promise<LocationInfo> => {
  // Layer 1: Browser GPS (High Accuracy)
  try {
    console.log('📍 [Geolocation] Trying Layer 1: High-accuracy GPS...');
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      });
    });
    console.log(`✅ [Geolocation] GPS success: lat=${position.coords.latitude}, lng=${position.coords.longitude}, accuracy=${position.coords.accuracy}m`);
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      source: "gps"
    };
  } catch (gpsError: any) {
    console.warn(`⚠️ [Geolocation] High-accuracy GPS failed (code=${gpsError.code}): ${gpsError.message}`);
    // Layer 1.5: Standard Accuracy
    try {
        console.log('📍 [Geolocation] Trying Layer 1.5: Standard-accuracy GPS...');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 10000
          });
        });
        console.log(`✅ [Geolocation] Standard GPS success: lat=${position.coords.latitude}, lng=${position.coords.longitude}`);
        return {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "gps"
        };
    } catch (stdError: any) {
        console.warn(`⚠️ [Geolocation] Standard GPS also failed (code=${stdError.code}): ${stdError.message} — trying IP fallback`);
    }
  }

  // Layer 2: IP Geolocation (Chain of multiple fallbacks to avoid 429s)
  const ipProviders = [
    { url: 'https://freeipapi.com/api/json', latRef: 'latitude', lngRef: 'longitude' },
    { url: 'https://ip-api.com/json?fields=status,lat,lon', latRef: 'lat', lngRef: 'lon' },
    { url: 'https://ipapi.co/json/', latRef: 'latitude', lngRef: 'longitude' },
    { url: 'https://ipwho.is/', latRef: 'latitude', lngRef: 'longitude' }
  ];

  for (const provider of ipProviders) {
    try {
      console.log(`📍 [Geolocation] Trying Layer 2: IP provider — ${provider.url}`);
      const res = await fetch(provider.url, { signal: AbortSignal.timeout(3000) } as any);
      if (res.status === 429) {
          console.warn(`⚠️ [Geolocation] ${provider.url} rate-limited (429) — skipping`);
          continue;
      }
      if (!res.ok) {
          console.warn(`⚠️ [Geolocation] ${provider.url} returned HTTP ${res.status} — skipping`);
          continue;
      }
      const data = await res.json();
      const lat = data[provider.latRef];
      const lng = data[provider.lngRef];

      if (lat && lng) {
        console.log(`✅ [Geolocation] IP location from ${provider.url}: lat=${lat}, lng=${lng}`);
        return {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          accuracy: null,
          source: "ip"
        };
      } else {
        console.warn(`⚠️ [Geolocation] ${provider.url} responded but lat/lng missing in JSON:`, data);
      }
    } catch (e) {
      console.warn(`⚠️ [Geolocation] ${provider.url} request failed (timeout or network):`, e);
    }
  }

  // Layer 3: Default Center (Mumbai)
  console.warn('⚠️ [Geolocation] All location methods failed — using Mumbai default. Map center will be inaccurate.');
  return {
    ...DEFAULT_CENTER,
    accuracy: null,
    source: "default"
  };
};

