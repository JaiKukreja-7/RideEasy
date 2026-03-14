import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Shield, MapPin, Navigation } from "lucide-react";
import MapLibreMap from "@/components/MapLibreMap";

const TrackRide = () => {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState<any>(null);
  const [driverLoc, setDriverLoc] = useState<any>(null);
  const [liveStats, setLiveStats] = useState({ distance: 0, duration: 0 });
  const [routePath, setRoutePath] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!rideId) return;
    fetchRideData();

    const channel = supabase
      .channel(`ride-tracking-${rideId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` }, (payload) => {
        setRide(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId]);

  useEffect(() => {
    if (ride?.driver_id) {
        subscribeToDriver(ride.driver_id);
    }
  }, [ride?.driver_id]);

  const fetchRideData = async () => {
    const { data } = await supabase.from('rides').select('*').eq('id', rideId).single();
    if (data) {
        setRide(data);
        fetchRoute(data);
    }
  };

  const fetchRoute = async (r: any) => {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${r.pickup_lng},${r.pickup_lat};${r.dropoff_lng},${r.dropoff_lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes?.[0]) {
      setRoutePath(data.routes[0].geometry.coordinates);
    }
  };

  const subscribeToDriver = (driverId: string) => {
    const channel = supabase
      .channel(`driver-track-${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: `user_id=eq.${driverId}` }, (payload) => {
        const newLoc = payload.new as any;
        setDriverLoc({ lat: newLoc.lat, lng: newLoc.lng });
        updateLiveETA(newLoc.lat, newLoc.lng);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const updateLiveETA = async (lat: number, lng: number) => {
    if (!ride) return;
    const destLat = (ride.status === 'accepted' || ride.status === 'arrived') ? ride.pickup_lat : ride.dropoff_lat;
    const destLng = (ride.status === 'accepted' || ride.status === 'arrived') ? ride.pickup_lng : ride.dropoff_lng;

    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${lng},${lat};${destLng},${destLat}?overview=false`);
    const data = await res.json();
    if (data.routes?.[0]) {
      setLiveStats({
        distance: data.routes[0].distance / 1000,
        duration: data.routes[0].duration / 60
      });
    }
  };

  if (!ride) return <div className="h-screen flex items-center justify-center font-bold">Loading Trip...</div>;

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="p-4 bg-card border-b flex items-center justify-between">
         <div>
            <h1 className="font-black text-xl tracking-tight">Trip Tracking</h1>
            <p className="text-xs text-primary font-bold uppercase">{ride.status.replace('_', ' ')}</p>
         </div>
         <Badge variant="outline" className="border-primary/20 text-primary">
            <Shield className="w-3 h-3 mr-2" />
            RideEasy Secure
         </Badge>
      </div>

      <div className="flex-1 relative">
        <MapLibreMap
          height="100%"
          drivers={driverLoc ? [{ id: ride.driver_id, ...driverLoc }] : []}
          route={routePath}
          pickup={[ride.pickup_lng, ride.pickup_lat]}
          destination={[ride.dropoff_lng, ride.dropoff_lat]}
          center={driverLoc ? [driverLoc.lng, driverLoc.lat] : [ride.pickup_lng, ride.pickup_lat]}
        />

        <div className="absolute top-4 left-4 right-4 space-y-3">
             <Card className="p-4 bg-background/95 backdrop-blur shadow-2xl border-0 rounded-3xl">
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">ETA</p>
                        <p className="text-2xl font-black text-primary">{Math.round(liveStats.duration)} MINS</p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Distance</p>
                        <p className="text-2xl font-black">{liveStats.distance.toFixed(1)} KM</p>
                    </div>
                </div>
             </Card>
        </div>
      </div>

      <div className="p-6 bg-card border-t space-y-4">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div>
                <div>
                    <p className="text-[10px] text-muted-foreground font-black uppercase">Pickup</p>
                    <p className="text-sm font-medium">{ride.pickup_address}</p>
                </div>
            </div>
            <div className="flex items-start space-x-3">
                <MapPin className="w-4 h-4 text-destructive mt-0.5" />
                <div>
                    <p className="text-[10px] text-muted-foreground font-black uppercase">Dropoff</p>
                    <p className="text-sm font-medium">{ride.dropoff_address}</p>
                </div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
              <p className="text-[10px] text-center text-muted-foreground font-bold uppercase tracking-widest leading-loose">
                  This trip is tracked live for your safety. <br/> Powered by RideEasy Realtime Engine.
              </p>
          </div>
      </div>
    </div>
  );
};

export default TrackRide;
