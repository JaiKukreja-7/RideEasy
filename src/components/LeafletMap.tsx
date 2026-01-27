import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import { Button } from './ui/button';
import { Navigation, Loader2, MapPin } from 'lucide-react';
import { toast } from "sonner";

// Fix for default marker icon missing in React Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to center map
function RecenterAutomatically({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng]);
    }, [lat, lng, map]);
    return null;
}

// Helper for clicks
function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onPick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

interface LeafletMapProps {
    height?: string;
    onLocationSelect?: (address: string, lat?: number, lng?: number) => void;
    selectingMode?: "pickup" | "destination" | null;
    drivers?: DriverLocation[];
    route?: [number, number][]; // Array of LatLng tuples
}

const LeafletMap = ({ height = "200px", onLocationSelect, selectingMode, drivers = [], route }: LeafletMapProps) => {
    // Default: Mumbai [19.0760, 72.8777]
    const [position, setPosition] = useState<[number, number]>([19.0760, 72.8777]);
    const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(false);

    // Initial Geolocation
    useEffect(() => {
        handleLocateMe();
    }, []);

    const handleLocateMe = () => {
        setLoading(true);

        // Timeout for native geolocation
        const geoOptions = { enableHighAccuracy: true, timeout: 5000 };

        const onSuccess = async (pos: GeolocationPosition) => {
            const { latitude, longitude } = pos.coords;
            setPosition([latitude, longitude]);
            setMyLocation([latitude, longitude]);
            setLoading(false);

            if (onLocationSelect) {
                toast.info("Fetching address...");
                await handlePickLocation(latitude, longitude);
            }
        };

        const onError = async (err: GeolocationPositionError) => {
            console.error(err);
            // Fallback to IP Geolocation
            toast.warning("GPS unavailable, trying IP location...");

            try {
                // Using a free IP Geolocation API (ipapi.co or ip-api.com)
                const res = await fetch('https://ipapi.co/json/');
                const data = await res.json();

                if (data.latitude && data.longitude) {
                    const lat = parseFloat(data.latitude);
                    const lng = parseFloat(data.longitude);
                    setPosition([lat, lng]);
                    setMyLocation([lat, lng]);
                    setLoading(false);
                    toast.success(`Broad location found: ${data.city}`);

                    if (onLocationSelect) {
                        // Use reverse geocoding to get a clean address string
                        await handlePickLocation(lat, lng);
                    }
                } else {
                    throw new Error("IP location failed");
                }
            } catch (fallbackErr) {
                console.error("Fallback failed", fallbackErr);
                setLoading(false);
                toast.error("Could not determine location. Please select manually on map.");
            }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(onSuccess, onError, geoOptions);
        } else {
            // Trigger error to use fallback
            onError({ code: 0, message: "Not supported", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
        }
    };

    const handlePickLocation = async (lat: number, lng: number) => {
        if (!onLocationSelect) return;

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();

            if (data && data.display_name) {
                // Formatting address
                const parts = data.display_name.split(',');
                const addr = parts.slice(0, 3).join(', '); // Taking first 3 parts
                onLocationSelect(addr, lat, lng);
                // toast.dismiss();
            } else {
                onLocationSelect(`${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng);
            }
        } catch (err) {
            console.error("Geocoding error", err);
            onLocationSelect(`${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng);
        }
    };

    return (
        <div className="relative isolate h-full w-full">
            <MapContainer
                center={position}
                zoom={14}
                style={{ height: height, width: "100%", borderRadius: "1rem" }}
            >
                <TileLayer
                    attribution='&copy; OSM'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <RecenterAutomatically lat={position[0]} lng={position[1]} />

                {onLocationSelect && <LocationPicker onPick={handlePickLocation} />}

                {myLocation && (
                    <Marker position={myLocation}>
                        <Popup>You are here</Popup>
                    </Marker>
                )}

                {/* Render Route Polyline */}
                {route && route.length > 0 && (
                    <Polyline
                        positions={route}
                        pathOptions={{ color: 'black', weight: 5, opacity: 0.8 }}
                    />
                )}
            </MapContainer>

            {/* Floating Locate Button */}
            <div className="absolute right-4 bottom-8 z-[500] pointer-events-auto">
                <Button
                    size="icon"
                    className="rounded-full shadow-lg h-12 w-12 bg-white hover:bg-gray-100 text-black border border-gray-200"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleLocateMe();
                    }}
                    disabled={loading}
                >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Navigation className="w-6 h-6 text-primary" />}
                </Button>
            </div>

            {selectingMode && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[500] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-md border border-primary/20 pointer-events-none">
                    <p className="text-xs font-bold text-primary flex items-center">
                        <MapPin className="w-3 h-3 mr-1 fill-current" />
                        Tap map to set {selectingMode}
                    </p>
                </div>
            )}
        </div>
    );
};

export default LeafletMap;
