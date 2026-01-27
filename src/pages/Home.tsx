import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  MapPin,
  Navigation,
  Home as HomeIcon,
  Briefcase,
  Clock,
  Heart,
  Menu,
  User,
  LogOut,
  Car
} from "lucide-react";
import { useNavigate } from "react-router-dom";
// import mapImage from "@/assets/map-interface.jpg"; // REMOVED
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import LeafletMap from "@/components/LeafletMap";

const Home = () => {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [activeInput, setActiveInput] = useState<"pickup" | "destination">("pickup");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);

  const [pickupCoords, setPickupCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number, lng: number } | null>(null);

  const navigate = useNavigate();
  const { user, role, signOut, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    } else if (!loading && role === 'driver') {
      navigate("/driver-dashboard");
    }
  }, [user, role, loading, navigate]);

  // Generate random drivers
  useEffect(() => {
    const baseLat = 19.0760;
    const baseLng = 72.8777;
    const drivers = Array.from({ length: 4 }).map((_, i) => ({
      id: `driver-${i}`,
      lat: baseLat + (Math.random() - 0.5) * 0.02,
      lng: baseLng + (Math.random() - 0.5) * 0.02,
      angle: Math.random() * 360
    }));
    setNearbyDrivers(drivers);
  }, []);

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const handleSearchInput = async (query: string, field: "pickup" | "destination") => {
    if (field === "pickup") {
      setPickup(query);
      setActiveInput("pickup");
    } else {
      setDestination(query);
      setActiveInput("destination");
    }

    if (query.length > 2) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        setSuggestions(data);
      } catch (e) {
        console.error(e);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (place: any) => {
    const address = place.display_name.split(',').slice(0, 3).join(',');
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);

    if (activeInput === "pickup") {
      setPickup(address);
      setPickupCoords({ lat, lng });
    } else {
      setDestination(address);
      setDestinationCoords({ lat, lng });
    }
    setSuggestions([]);
  };

  const handleMapLocationSelect = (address: string, lat?: number, lng?: number) => {
    if (activeInput === "pickup") {
      setPickup(address);
      if (lat && lng) setPickupCoords({ lat, lng });
      setActiveInput("destination");
    } else {
      setDestination(address);
      if (lat && lng) setDestinationCoords({ lat, lng });
    }
  };

  const handleBookRide = () => {
    navigate("/book-ride", {
      state: {
        pickup,
        destination,
        pickupCoords,
        destinationCoords
      }
    });
  };

  const quickActions = [
    { icon: HomeIcon, label: "Home", address: "123 Main Street", onClick: () => setDestination("123 Main Street") },
    { icon: Briefcase, label: "Work", address: "Business Center", onClick: () => setDestination("Business Center") },
    { icon: Clock, label: "History", address: "View Your Rides", onClick: () => navigate("/trip-history") },
    { icon: Heart, label: "Favorites", address: "Airport", onClick: () => setDestination("Airport") }
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Menu className="w-5 h-5" />
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">Welcome</p>
              <p className="font-semibold">{user?.email}</p>
              {role && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">{role}</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">

        {/* Role Specific Actions */}
        {role === 'driver' && (
          <Card className="bg-primary text-primary-foreground p-4 mb-4 cursor-pointer" onClick={() => navigate('/driver-dashboard')}>
            <div className="flex items-center space-x-3">
              <Car className="w-6 h-6" />
              <div>
                <h3 className="font-bold">Driver Dashboard</h3>
                <p className="text-sm opacity-90">Manage your rides</p>
              </div>
            </div>
          </Card>
        )}

        {role === 'admin' && (
          <Card className="bg-destructive text-destructive-foreground p-4 mb-4 cursor-pointer" onClick={() => navigate('/admin-dashboard')}>
            <div>
              <h3 className="font-bold">Admin Panel</h3>
              <p className="text-sm opacity-90">Manage system</p>
            </div>
          </Card>
        )}

        {/* Map Section */}
        <Card className="card-taxi overflow-hidden animate-fade-in border-0 p-0">
          <div className="relative isolate z-0">
            <LeafletMap
              height="250px"
              onLocationSelect={handleMapLocationSelect}
              selectingMode={activeInput}
              drivers={nearbyDrivers}
            />
          </div>
        </Card>

        {/* Search Section */}
        <Card className="card-taxi animate-slide-up">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Where to?</h3>

            <div className="space-y-3 relative">
              {/* Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-[500] bg-popover text-popover-foreground rounded-xl shadow-lg border border-border mt-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-1">
                    {suggestions.map((place, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-lg transition-colors flex items-center space-x-2"
                        onClick={() => handleSuggestionClick(place)}
                      >
                        <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{place.display_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                  <div className={`w-3 h-3 rounded-full ${activeInput === 'pickup' ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground'}`}></div>
                </div>
                <Input
                  placeholder="Pickup location"
                  value={pickup}
                  onChange={(e) => handleSearchInput(e.target.value, "pickup")}
                  onFocus={() => setActiveInput("pickup")}
                  className={`pl-10 h-12 rounded-xl border-2 transition-colors ${activeInput === 'pickup' ? 'border-primary' : 'border-border'}`}
                />
              </div>

              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                  <MapPin className={`w-4 h-4 ${activeInput === 'destination' ? 'text-destructive animate-bounce' : 'text-muted-foreground'}`} />
                </div>
                <Input
                  placeholder="Where to?"
                  value={destination}
                  onChange={(e) => handleSearchInput(e.target.value, "destination")}
                  onFocus={() => setActiveInput("destination")}
                  className={`pl-10 h-12 rounded-xl border-2 transition-colors ${activeInput === 'destination' ? 'border-primary' : 'border-border'}`}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="animate-fade-in">
          <h3 className="font-semibold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <Card
                key={index}
                className="card-taxi-interactive"
                onClick={action.onClick}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-taxi-yellow-light rounded-xl flex items-center justify-center">
                    <action.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{action.label}</p>
                    <p className="text-sm text-muted-foreground">{action.address}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Book Ride Button */}
        <div className="animate-scale-in">
          <Button
            onClick={handleBookRide}
            className="btn-taxi w-full h-14 text-lg font-semibold"
          >
            Book Your Ride
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Home;