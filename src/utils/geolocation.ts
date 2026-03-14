export interface LocationInfo {
  lat: number;
  lng: number;
  accuracy: number | null;
  source: "gps" | "ip" | "default";
}

const DEFAULT_CENTER = { lat: 19.0760, lng: 72.8777 }; // Mumbai

export const getReliableLocation = async (): Promise<LocationInfo> => {
  // Layer 1: Browser GPS
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      source: "gps"
    };
  } catch (gpsError) {
    console.warn("GPS failed, trying IP fallback:", gpsError);
  }

  // Layer 2: IP Geolocation
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return {
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude),
        accuracy: null,
        source: "ip"
      };
    }
  } catch (ipError) {
    console.error("IP fallback failed:", ipError);
  }

  // Layer 3: Default Center
  return {
    ...DEFAULT_CENTER,
    accuracy: null,
    source: "default"
  };
};
