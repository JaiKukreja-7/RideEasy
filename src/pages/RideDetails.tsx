import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Star,
  Car,
  Navigation,
  Clock,
  MapPin,
  Shield,
  Loader2
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import LeafletMap from "@/components/LeafletMap";

interface Ride {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  fare_amount: number;
  driver_id: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  payment_status: string;
}

const RideDetails = () => {
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rideId = searchParams.get("id");
  const isTracking = searchParams.get("track") === "true";

  useEffect(() => {
    if (!rideId) {
      toast.error("No ride ID found");
      navigate("/home");
      return;
    }

    fetchRideDetails();

    // Subscribe to changes for this specific ride
    const channel = supabase
      .channel(`ride:${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`
      }, (payload) => {
        setRide(payload.new as Ride);
        toast.info(`Ride status updated: ${payload.new.status}`);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, navigate]);

  // Fetch Route when ride data is available and tracking is on
  useEffect(() => {
    if (ride && isTracking && ride.pickup_lat && ride.dropoff_lat) {
      fetchRoute(ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng);
    }
  }, [ride, isTracking]);

  const fetchRoute = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    try {
      // OSRM Public API
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates;
        // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
        const leafletCoords = coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
        setRoutePath(leafletCoords);
      }
    } catch (e) {
      console.error("Routing Error", e);
    }
  };

  const fetchRideDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("id", rideId)
        .single();

      if (error) throw error;
      setRide(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load ride details");
    } finally {
      setLoading(false);
    }
  };

  const statusMessages: Record<string, string> = {
    requested: "Finding the best driver for you...",
    accepted: "Driver assigned and on the way!",
    in_progress: "Trip in progress",
    completed: "Ride completed",
    cancelled: "Ride cancelled"
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!ride) return <div className="min-h-screen flex items-center justify-center">Ride not found</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border/50 px-4 py-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(isTracking ? "/trip-history" : "/home")}
            className="rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{isTracking ? "Live Tracking" : "Your Ride"}</h1>
            <p className="text-sm text-primary">{statusMessages[ride.status] || ride.status}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">

        {/* LIVE TRACKING MAP */}
        {isTracking && (
          <Card className="card-taxi overflow-hidden h-[300px] border-0 p-0 relative animate-fade-in">
            <LeafletMap
              height="300px"
              route={routePath}
              // Pass a dummy driver at start position to simulate car
              drivers={[{ id: 'my-taxi', lat: ride.pickup_lat || 0, lng: ride.pickup_lng || 0, angle: 0 }]}
            />
            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur p-3 rounded-xl shadow-lg border border-border/50 z-[400]">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Est. Arrival</p>
                  <p className="text-lg font-bold text-primary">12 mins</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Distance</p>
                  <p className="text-lg font-bold">5.2 km</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Ride Status (Hide if tracking to avoid clutter, or keep small) */}
        {!isTracking && (
          <Card className="card-taxi animate-fade-in">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-r from-primary to-primary-hover rounded-full flex items-center justify-center mx-auto">
                {ride.status === "requested" ? (
                  <Car className="w-10 h-10 text-primary-foreground animate-pulse" />
                ) : (
                  <Navigation className="w-10 h-10 text-primary-foreground" />
                )}
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">
                  {ride.status === "requested" ? "Searching for driver..." : "Driver Found!"}
                </h3>
                <p className="text-muted-foreground">{statusMessages[ride.status] || ride.status}</p>
              </div>

              {ride.status === "requested" && (
                <div className="flex justify-center">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Show Driver Details Only if Accepted */}
        {ride.status !== "requested" && ride.status !== "cancelled" && (
          <>
            {/* Driver Info */}
            <Card className="card-taxi animate-scale-in">
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src="/api/placeholder/64/64" />
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-lg">
                      DR
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-lg">Your Driver</h3>
                      <Badge className="bg-primary text-primary-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        5 min
                      </Badge>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 fill-current text-primary" />
                        <span>4.9</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Shield className="w-4 h-4" />
                        <span>Verified</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl">
                    <Phone className="w-5 h-5 mr-2" />
                    Call
                  </Button>
                  <Button variant="outline" className="flex-1 h-12 rounded-xl">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Message
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Trip Details */}
        <Card className="card-taxi animate-fade-in">
          <div className="space-y-4">
            <h3 className="font-semibold">Trip Details</h3>

            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-primary rounded-full"></div>
                <div>
                  <p className="font-medium">{ride.pickup_address}</p>
                  <p className="text-sm text-muted-foreground">Pickup location</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <MapPin className="w-4 h-4 text-destructive" />
                <div>
                  <p className="font-medium">{ride.dropoff_address}</p>
                  <p className="text-sm text-muted-foreground">Drop location</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">₹{ride.fare_amount}</p>
                <p className="text-sm text-muted-foreground">Estimated fare</p>
              </div>
              <div>
                <p className="text-2xl font-bold">12.5</p>
                <p className="text-sm text-muted-foreground">km</p>
              </div>
              <div>
                <p className="text-2xl font-bold">25</p>
                <p className="text-sm text-muted-foreground">min</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Button - Only show if unpaid and not requested */}
        <div className="animate-scale-in">
          {ride.status === "requested" ? (
            <Button
              variant="outline"
              className="btn-taxi-outline w-full h-14 text-lg font-semibold"
              onClick={() => navigate("/home")}
            >
              Back to Home
            </Button>
          ) : ride.payment_status === 'paid' ? (
            <Button
              className="w-full h-14 text-lg font-semibold bg-green-500 hover:bg-green-600 text-white cursor-default"
              onClick={() => { }}
            >
              <Shield className="w-5 h-5 mr-2" />
              Ride Paid & Verified
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/payment")}
              className="btn-taxi w-full h-14 text-lg font-semibold"
            >
              Pay Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RideDetails;