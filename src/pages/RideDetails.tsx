import { useState, useEffect, useRef } from "react";
import { RatingDialog } from "@/components/RatingDialog";
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
  Loader2,
  CheckCircle2,
  CreditCard,
  Share2,
  Copy
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ChatInterface } from "@/components/ChatInterface";

import MapLibreMap from "@/components/MapLibreMap";

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
  otp_code: string;
}

interface DriverInfo {
    full_name: string;
    vehicle_number: string;
    avatar_url?: string;
}

const RideDetails = () => {
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [fullRoutePath, setFullRoutePath] = useState<[number, number][]>([]);
  const [driverLoc, setDriverLoc] = useState<{lat: number, lng: number} | null>(null);
  const [liveStats, setLiveStats] = useState({ distance: 0, duration: 0 });
  const [hasRated, setHasRated] = useState(false);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rideId = searchParams.get("id");
  const isTracking = searchParams.get("track") === "true";

  const tripSharingLink = `${window.location.origin}/track/${rideId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tripSharingLink);
    toast.success("Link copied! Share it with friends and family.");
  };

  useEffect(() => {
    if (!rideId) {
      console.error('🔴 [RideDetails] No rideId in URL params — redirecting to home');
      toast.error("No ride ID found");
      navigate("/home");
      return;
    }

    console.log(`🚀 [RideDetails] Mounting for rideId: ${rideId}`);
    fetchRideDetails();

    // --- Realtime subscription (primary) ---
    console.log(`📡 [Realtime] Subscribing to ride updates for: ${rideId}`);
    const channel = supabase
      .channel(`ride:${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`
      }, (payload) => {
        console.log('📡 [Realtime] Ride UPDATE received:', {
          oldStatus: payload.old.status,
          newStatus: payload.new.status,
          driverAssigned: !payload.old.driver_id && !!payload.new.driver_id
        });
        const updatedRide = payload.new as Ride;
        setRide(prev => {
          if (prev?.status !== updatedRide.status) {
            console.log(`🔄 [Realtime] Status changed: ${prev?.status} → ${updatedRide.status}`);
            toast.info(`Ride status: ${updatedRide.status.toUpperCase()}`);
          }
          return updatedRide;
        });
        if (!payload.old.driver_id && updatedRide.driver_id) {
          console.log(`👤 [Realtime] Driver just assigned: ${updatedRide.driver_id} — fetching driver info`);
          fetchDriverInfo(updatedRide.driver_id);
        }
      })
      .subscribe((status) => {
        console.log(`📡 [Realtime] Subscription status: ${status}`);
        if (status === 'CHANNEL_ERROR') {
          console.error('🔴 [Realtime] Channel error — will rely on polling fallback');
        }
      });

    // --- Polling fallback (guaranteed — runs every 4s) ---
    console.log('⏱️ [Polling] Starting 4s polling fallback for ride status');
    const pollInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single();

      if (error) {
        console.error('🔴 [Polling] Supabase fetch failed (RLS may be blocking):', error.message, error.code);
        return;
      }

      if (data) {
        console.log(`⏱️ [Polling] Ride status from DB: ${data.status} | driver_id: ${data.driver_id ?? 'none'}`);
        setRide(prev => {
          if (!prev) return data;
          if (prev.status !== data.status) {
            console.log(`🔄 [Polling] Status changed: ${prev.status} → ${data.status}`);
            toast.info(`Ride status: ${data.status.toUpperCase()}`);
          }
          if (!prev.driver_id && data.driver_id) {
            console.log(`👤 [Polling] Driver assigned: ${data.driver_id} — fetching driver info`);
            fetchDriverInfo(data.driver_id);
          }
          return data;
        });
      } else {
        console.warn('⚠️ [Polling] No data returned — ride may not exist or RLS is blocking read');
      }
    }, 4000);

    return () => {
      console.log(`🧹 [RideDetails] Cleaning up subscriptions for rideId: ${rideId}`);
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [rideId, navigate]);

  // Fetch Route when ride data is available
  useEffect(() => {
    if (ride?.pickup_lat && ride?.dropoff_lat) {
      console.log(`🗺️ [Route] Fetching full trip route for ride: ${ride.id}`);
      console.log(`🗺️ [Route] Pickup: (${ride.pickup_lat}, ${ride.pickup_lng}) → Dropoff: (${ride.dropoff_lat}, ${ride.dropoff_lng})`);
      fetchRoute(ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng);
    } else {
      console.warn('⚠️ [Route] Cannot fetch route — missing pickup or dropoff coordinates on ride');
    }
  }, [ride?.id]);

  // Watch driver location
  useEffect(() => {
    if (ride?.driver_id) {
       console.log(`📍 [DriverTrack] Starting location subscription for driver: ${ride.driver_id}`);
       const cleanup = subscribeToDriver(ride.driver_id);
       return () => { cleanup(); };
    } else {
      console.log('⏳ [DriverTrack] No driver assigned yet — waiting for assignment');
    }
  }, [ride?.driver_id]);

  const subscribeToDriver = (driverId: string) => {
     // Fetch initial location
     supabase.from('driver_locations').select('*').eq('user_id', driverId).single().then(({data, error}) => {
        if (error) {
          console.error(`🔴 [DriverTrack] Failed to fetch initial driver location for ${driverId}:`, error.message);
          return;
        }
        if (data) {
            console.log(`📍 [DriverTrack] Initial driver location: lat=${data.lat}, lng=${data.lng}`);
            setDriverLoc({lat: Number(data.lat), lng: Number(data.lng)});
        } else {
            console.warn(`⚠️ [DriverTrack] No driver_locations row found for driver: ${driverId}`);
        }
     });

     // Subscribe to live location changes
     const channel = supabase.channel(`driver-track-${driverId}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'driver_locations', 
            filter: `user_id=eq.${driverId}` 
        }, (payload) => {
            console.log(`🚗 [DriverTrack] Driver moved → lat=${payload.new.lat}, lng=${payload.new.lng}`);
            setDriverLoc({lat: Number(payload.new.lat), lng: Number(payload.new.lng)});
        })
        .subscribe((status) => {
          console.log(`📡 [DriverTrack] Subscription status: ${status}`);
          if (status === 'CHANNEL_ERROR') {
            console.error(`🔴 [DriverTrack] Failed to subscribe to driver location for: ${driverId}`);
          }
        });
        
     return () => {
        console.log(`🧹 [DriverTrack] Cleaning up driver location subscription for: ${driverId}`);
        supabase.removeChannel(channel);
     };
  };

  // Update live ETA when driver moves
  useEffect(() => {
    if (driverLoc && ride) {
        updateLiveETA();
    }
  }, [driverLoc, ride?.status]);

  const lastOsrmCall = useRef<number>(0);

  const updateLiveETA = async () => {
      if (!driverLoc || !ride) return;
      
      const now = Date.now();
      if (now - lastOsrmCall.current < 4000) {
          // Skip hitting OSRM if called within last 4s to prevent Rate Limit (429) freezing
          return;
      }
      lastOsrmCall.current = now;

      try {
        const isHeComingToMe = (ride.status === 'accepted' || ride.status === 'arrived');
        const destLat = isHeComingToMe ? ride.pickup_lat : ride.dropoff_lat;
        const destLng = isHeComingToMe ? ride.pickup_lng : ride.dropoff_lng;

        if (!destLat || !destLng) {
          console.warn(`⚠️ [ETA] Cannot compute ETA — destination coords missing. ride.status=${ride.status}`);
          return;
        }

        console.log(`🧮 [ETA] Computing ETA | mode=${isHeComingToMe ? 'driver→pickup' : 'driver→dropoff'} | from=(${driverLoc.lat},${driverLoc.lng}) to=(${destLat},${destLng})`);
        
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${driverLoc.lng},${driverLoc.lat};${destLng},${destLat}?overview=full&geometries=geojson`);
        if (!res.ok) {
          console.error(`🔴 [ETA] OSRM returned HTTP ${res.status} — routing server may be down or rate limited`);
          return;
        }
        const data = await res.json();
        if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            console.log(`✅ [ETA] Updated: ${(route.distance/1000).toFixed(2)}km, ${Math.round(route.duration/60)}min`);
            setLiveStats({
                distance: route.distance / 1000,
                duration: route.duration / 60
            });
            // ONLY update the route path directly from the car to destination 
            setRoutePath(route.geometry.coordinates);
        }
      } catch (e) {
          console.error('🔴 [ETA] OSRM request failed:', e);
      }
  };

  const fetchRoute = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    console.log(`🗺️ [fetchRoute] Requesting OSRM route: (${startLat},${startLng}) → (${endLat},${endLng})`);
    if (!startLat || !startLng || !endLat || !endLng) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`🔴 [fetchRoute] OSRM HTTP ${res.status} — routing server down or bad request`);
        return;
      }
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates;
        console.log(`✅ [fetchRoute] Got ${coordinates.length} route points | dist=${(data.routes[0].distance/1000).toFixed(1)}km | dur=${Math.round(data.routes[0].duration/60)}min`);
        setRoutePath(coordinates);
        setFullRoutePath(coordinates);
        if (liveStats.distance === 0) {
            setLiveStats({
                distance: data.routes[0].distance / 1000,
                duration: data.routes[0].duration / 60
            });
        }
      } else {
        console.warn('⚠️ [fetchRoute] OSRM returned no routes. Coordinates may point to different cities/countries — this is a data bug.');
      }
    } catch (e) {
      console.error('🔴 [fetchRoute] Network error calling OSRM:', e);
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
      if (data.driver_id) {
          fetchDriverInfo(data.driver_id);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load ride details");
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverInfo = async (driverId: string) => {
      const { data } = await supabase.from('profiles').select('full_name, vehicle_number, avatar_url').eq('id', driverId).single();
      if (data) {
          setDriverInfo(data as DriverInfo);
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border/50 px-4 py-4 sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(isTracking ? "/trip-history" : "/home")}
            className="rounded-xl hover:bg-primary/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">{isTracking ? "Live Tracking" : "Your Ride"}</h1>
            <p className="text-xs text-primary font-medium uppercase tracking-wider">{statusMessages[ride.status] || ride.status}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">

        {/* LIVE TRACKING MAP */}
        {(isTracking || ride.status === 'accepted' || ride.status === 'in_progress') && (
          <Card className="card-taxi overflow-hidden h-[350px] border-0 p-0 relative animate-fade-in shadow-2xl ring-1 ring-primary/10">
            <div className="flex-1 relative h-full">
              <MapLibreMap
                height="100%"
                drivers={driverLoc ? [{ id: ride.driver_id, lat: driverLoc.lat, lng: driverLoc.lng }] : []}
                route={routePath}
                fullRoute={fullRoutePath}
                pickup={[ride.pickup_lng, ride.pickup_lat]}
                destination={[ride.dropoff_lng, ride.dropoff_lat]}
                center={driverLoc ? [driverLoc.lng, driverLoc.lat] : [ride.pickup_lng, ride.pickup_lat]}
              />

              {/* Floating Trip Info */}
              <div className="absolute top-4 left-4 right-4 space-y-2">
                  <Card className="p-3 bg-background/90 backdrop-blur border-0 shadow-lg flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                          <div className="p-2 bg-primary/10 rounded-full">
                              <Clock className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold">Estimated Arrival</p>
                              <p className="font-bold">{Math.round(liveStats.duration)} mins away</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">Distance</p>
                          <p className="font-bold">{liveStats.distance.toFixed(1)} km</p>
                      </div>
                  </Card>

                  <div className="flex justify-center">
                      <Badge variant="secondary" className="bg-background/90 backdrop-blur text-primary border-primary/20 px-4 py-1.5 shadow-md">
                          <Shield className="w-3 h-3 mr-2" />
                          Trip Sharing Active
                      </Badge>
                  </div>
              </div>
            </div>
          </Card>
        )}

        {/* Trip Sharing Link */}
        {(isTracking || ride.status === 'accepted' || ride.status === 'in_progress') && (
          <Card className="card-taxi p-4 animate-fade-in shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Share2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-bold text-sm">Share Trip</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-full">{tripSharingLink}</p>
                </div>
              </div>
              <Button variant="outline" size="icon" onClick={copyToClipboard} className="shrink-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}


        {/* Ride Status Card (Only if requested) */}
        {ride.status === "requested" && (
          <Card className="card-taxi p-8 animate-fade-in text-center relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl"></div>
            <div className="relative z-10 space-y-6">
              <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary-hover rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-primary/20 rotate-3">
                <Car className="w-12 h-12 text-primary-foreground animate-pulse" />
              </div>

              <div>
                <h3 className="text-2xl font-bold mb-2 tracking-tight">Searching for Drivers</h3>
                <p className="text-muted-foreground font-medium">{statusMessages[ride.status]}</p>
              </div>

              <div className="flex justify-center items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
              </div>
            </div>
          </Card>
        )}


        {/* Cancelled View */}
        {ride.status === "cancelled" && (
          <Card className="card-taxi p-8 animate-in fade-in zoom-in-95 duration-500 text-center border-2 border-destructive/20 bg-destructive/5">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-destructive" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Trip Cancelled</h3>
            <p className="text-muted-foreground font-medium mb-8">
              This trip has been cancelled. If this was unexpected, you can request a new ride from the home screen.
            </p>
            <Button 
              className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl"
              onClick={() => navigate("/home")}
            >
              RETURN TO HOME
            </Button>
          </Card>
        )}


        {/* OTP Security Code */}
        {ride.status === "accepted" || ride.status === "arrived" ? (
            <Card className="p-6 bg-slate-900 border-none shadow-2xl relative overflow-hidden group rounded-[32px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                            <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-0.5">Security Code</p>
                            <h4 className="text-xs font-bold text-white opacity-80 leading-tight">Show to driver</h4>
                        </div>
                    </div>
                    
                    <div className="bg-primary px-5 py-2.5 rounded-2xl shadow-xl flex items-center justify-center min-w-[100px]">
                        <span className="text-2xl font-black text-black tracking-normal">
                            {ride.otp_code || "----"}
                        </span>
                    </div>
                </div>
            </Card>
        ) : null}

        {/* Driver Details (If Accepted) */}
        {ride.status !== "requested" && ride.status !== "cancelled" && (
          <Card className="card-taxi p-5 overflow-hidden animate-scale-in border-l-4 border-l-primary shadow-lg">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="w-16 h-16 border-2 border-primary/20 p-0.5 rounded-2xl">
                  {driverInfo?.avatar_url ? (
                    <AvatarImage src={driverInfo.avatar_url} className="object-cover rounded-2xl" />
                  ) : (
                    <AvatarFallback className="bg-primary text-black font-black text-xl rounded-2xl">
                      {driverInfo?.full_name?.charAt(0) || "D"}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-lg leading-none">{driverInfo?.full_name || 'Accepted Driver'}</h3>
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    4.9
                  </Badge>
                </div>
                <p className="text-sm text-yellow-600 font-black mb-3 flex items-center bg-yellow-50 px-2 py-1 rounded-lg w-fit">
                   <Car className="w-3 h-3 mr-1" />
                   {driverInfo?.vehicle_number || 'Loading vehicle...'}
                </p>

                <div className="flex space-x-3">
                  <Button variant="outline" className="flex-1 h-11 rounded-xl bg-muted/30 border-none font-bold text-xs"
                    onClick={() => window.open('tel:9876543210')}>
                    <Phone className="w-4 h-4 mr-2" />
                     Call
                   </Button>
                   <Button 
                    variant="outline" 
                    className={`flex-1 h-11 rounded-xl border-none font-bold text-xs transition-all ${showChat ? 'bg-primary text-black' : 'bg-muted/30'}`}
                    onClick={() => setShowChat(!showChat)}
                   >
                     <MessageSquare className="w-4 h-4 mr-2" />
                     {showChat ? 'Close Chat' : 'Chat'}
                   </Button>
                 </div>
              </div>
            </div>
          </Card>
        )}

        {/* Trip Summary */}
        <Card className="card-taxi p-6 animate-fade-in shadow-xl">
          <div className="space-y-6">
            <h3 className="font-bold text-lg flex items-center border-b border-border/50 pb-3">
               <Navigation className="w-5 h-5 mr-2 text-primary" />
               Trip Summary
            </h3>

            <div className="space-y-5 relative">
              <div className="absolute left-[7px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-primary to-destructive/50"></div>
              
              <div className="flex items-start space-x-4">
                <div className="w-4 h-4 bg-primary rounded-full mt-1.5 ring-4 ring-primary/20 shrink-0 z-10"></div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Pickup</p>
                  <p className="font-bold text-sm leading-tight mt-1">{ride.pickup_address}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <MapPin className="w-4 h-4 text-destructive mt-1.5 shrink-0 z-10" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Destination</p>
                  <p className="font-bold text-sm leading-tight mt-1">{ride.dropoff_address}</p>
                </div>
              </div>
            </div>

            <div className="pt-6 grid grid-cols-3 gap-2">
              <div className="bg-muted/30 p-3 rounded-2xl">
                <p className="text-xl font-black text-primary">₹{ride.fare_amount}</p>
                <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Fare</p>
              </div>
              <div className="bg-muted/30 p-3 rounded-2xl">
                <p className="text-xl font-black">{liveStats.distance.toFixed(1)}</p>
                <p className="text-[9px] text-muted-foreground uppercase font-bold">KM distance</p>
              </div>
              <div className="bg-muted/30 p-3 rounded-2xl">
                <p className="text-xl font-black">{Math.round(liveStats.duration)}</p>
                <p className="text-[9px] text-muted-foreground uppercase font-bold">est mins</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Checkout Link / Payment Status */}
        <div className="animate-scale-in pt-4">
          {ride.status === "requested" ? (
            <Button
              variant="outline"
              className="btn-taxi-outline w-full h-15 text-lg font-bold border-2"
              onClick={() => navigate("/home")}
            >
              Cancel Request
            </Button>
          ) : ride.status === 'completed' ? (
             !hasRated ? (
                <RatingDialog 
                    rideId={ride.id} 
                    driverId={ride.driver_id} 
                    onSuccess={() => setHasRated(true)} 
                />
             ) : (
                <div className="bg-primary/10 p-6 rounded-3xl text-center border-2 border-primary/20">
                    <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
                    <h4 className="font-bold text-lg">Trip Feedback Recorded</h4>
                    <p className="text-sm text-muted-foreground">Thank you for helping us maintain high standards.</p>
                    <Button variant="outline" className="mt-4 w-full h-12 rounded-xl" onClick={() => navigate('/home')}>Return Home</Button>
                </div>
             )
          ) : ride.payment_status === 'paid' ? (
            <div className="bg-green-500/10 border-2 border-green-500/20 p-5 rounded-3xl flex items-center justify-between shadow-lg shadow-green-500/5">
                <div className="flex items-center space-x-3">
                    <div className="bg-green-500 p-2 rounded-full">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="font-black text-green-700 uppercase text-xs tracking-widest leading-none">Paid & Secure</p>
                        <p className="text-[10px] text-green-600 font-bold mt-1">Transaction Verified</p>
                    </div>
                </div>
                <Button variant="ghost" className="text-green-700 font-black text-xs hover:bg-green-500/10" onClick={() => navigate('/trip-history')}>
                    RECEIPT
                </Button>
            </div>
          ) : (
            <Button
              onClick={() => navigate("/payment")}
              className="btn-taxi w-full h-15 text-lg font-black shadow-2xl shadow-primary/30 group"
            >
              Finish & Pay Now
              <CreditCard className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
           )}
         </div>
       </div>

       {showChat && ride && (
         <ChatInterface 
           rideId={ride.id} 
           receiverName={driverInfo?.full_name || "Driver"} 
           onClose={() => setShowChat(false)} 
         />
       )}
     </div>
   );
 };
 export default RideDetails;