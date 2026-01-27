import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Navigation, User, ArrowLeft, LogOut, DollarSign, TrendingUp, Calendar, Clock, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Ride {
    id: string;
    pickup_address: string;
    dropoff_address: string;
    status: string;
    fare_amount: number;
    customer_id: string;
    created_at: string;
    payment_status?: string;
}

const DriverDashboard = () => {
    const { user, role, signOut, loading } = useAuth();
    const [availableRides, setAvailableRides] = useState<Ride[]>([]);
    const [rideHistory, setRideHistory] = useState<Ride[]>([]);
    const navigate = useNavigate();

    // Mock Stats
    const stats = [
        { label: "Today's Earnings", value: "₹850", icon: DollarSign, color: "text-green-600", bg: "bg-green-100" },
        { label: "Weekly Revenue", value: "₹4,200", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100" },
        { label: "Total Rides", value: "12", icon: Calendar, color: "text-purple-600", bg: "bg-purple-100" },
    ];

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate("/");
            } else if (role !== 'driver') {
                navigate("/home");
                toast.error("Access denied. Drivers only.");
            }
        }
    }, [user, role, loading, navigate]);

    useEffect(() => {
        fetchAvailableRides();
        fetchHistory();

        const channel = supabase
            .channel('public:rides')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides' }, (payload) => {
                setAvailableRides(prev => [payload.new as Ride, ...prev]);
                toast.info("New ride request!");
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload) => {
                fetchAvailableRides();
                fetchHistory();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchAvailableRides = async () => {
        const { data, error } = await supabase
            .from("rides")
            .select("*")
            .eq("status", "requested")
            .order("created_at", { ascending: false });

        if (error) console.error(error);
        else setAvailableRides(data || []);
    };

    const fetchHistory = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from("rides")
            .select("*")
            .eq("driver_id", user.id)
            .in("status", ["completed", "cancelled", "accepted"])
            .order("created_at", { ascending: false });

        if (error) console.error(error);
        else setRideHistory(data || []);
    };

    const handleAcceptRide = async (rideId: string) => {
        if (!user) return;

        const { error } = await supabase
            .from("rides")
            .update({ status: "accepted", driver_id: user.id })
            .eq("id", rideId);

        if (error) {
            toast.error("Failed to accept ride.");
        } else {
            toast.success("Ride accepted!");
            fetchAvailableRides();
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="bg-card border-b border-border/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <h1 className="font-semibold text-lg">Driver Panel</h1>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                    <LogOut className="w-5 h-5" />
                </Button>
            </div>

            <div className="p-4 space-y-6">

                {/* Analytics Section */}
                <div className="grid grid-cols-3 gap-3">
                    {stats.map((stat, i) => (
                        <Card key={i} className="p-3 flex flex-col items-center justify-center text-center space-y-2 shadow-sm">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.bg}`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-xl font-bold">{stat.value}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                            </div>
                        </Card>
                    ))}
                </div>

                <Tabs defaultValue="requests" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="requests">Ride Requests ({availableRides.length})</TabsTrigger>
                        <TabsTrigger value="history">My Rides</TabsTrigger>
                    </TabsList>

                    <TabsContent value="requests" className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">New Requests</h2>
                        </div>

                        {availableRides.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                                <Navigation className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No requests nearby.</p>
                                <p className="text-xs">Stay online to receive rides.</p>
                            </div>
                        ) : (
                            availableRides.map((ride) => (
                                <Card key={ride.id} className="p-4 space-y-4 shadow-md border-l-4 border-l-primary animate-slide-up">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center space-x-2">
                                            <Badge variant="outline" className="text-xs uppercase">
                                                New Request
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">{new Date(ride.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-lg text-primary">₹{ride.fare_amount}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 relative">
                                        {/* Dashed Line */}
                                        <div className="absolute left-[15px] top-[10px] bottom-[10px] w-0.5 border-l-2 border-dashed border-muted-foreground/30 -z-10"></div>

                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center z-10 border-2 border-background">
                                                <User className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Pickup</p>
                                                <p className="font-medium text-sm line-clamp-1">{ride.pickup_address}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center z-10 border-2 border-background">
                                                <MapPin className="w-4 h-4 text-red-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Dropoff</p>
                                                <p className="font-medium text-sm line-clamp-1">{ride.dropoff_address}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => handleAcceptRide(ride.id)}
                                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 text-lg shadow-lg shadow-primary/20"
                                    >
                                        Accept Ride
                                    </Button>
                                </Card>
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">Ride History</h2>
                        </div>

                        {rideHistory.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No past rides found.</p>
                            </div>
                        ) : (
                            rideHistory.map((ride) => (
                                <Card key={ride.id} className="p-4 space-y-3 shadow-sm border border-border/50">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                                <Badge variant={ride.status === 'completed' ? 'secondary' : 'outline'}
                                                    className={`${ride.status === 'completed' ? 'bg-green-100 text-green-800' : ''}`}>
                                                    {ride.status}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">{new Date(ride.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground font-mono">ID: {ride.id.slice(0, 8)}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-lg">₹{ride.fare_amount}</span>
                                            {ride.payment_status === 'paid' && (
                                                <div className="flex items-center text-xs text-green-600 justify-end">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Paid
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2 mt-2">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                            <p className="text-xs line-clamp-1">{ride.pickup_address}</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                            <p className="text-xs line-clamp-1">{ride.dropoff_address}</p>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default DriverDashboard;
