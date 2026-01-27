import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CreditCard, Lock, Smartphone, ShieldCheck, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const Payment = () => {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi">("card");
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the unpaid ride amount
    const fetchUnpaidRide = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('customer_id', user.id)
        .eq('payment_status', 'pending')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setAmount(data.fare_amount || 0);
        setCurrentRideId(data.id);
      }
    };

    fetchUnpaidRide();
  }, [user]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // SIMULATE PAYMENT GATEWAY DELAY
    await new Promise(resolve => setTimeout(resolve, 2000));

    // SIMULATE TRANSACTION ID GENERATION
    const transactionId = "TXN_" + Math.random().toString(36).substr(2, 9).toUpperCase();

    try {
      if (!currentRideId) {
        throw new Error("No active ride found to pay for.");
      }

      // UPDATE DATABASE
      const { error } = await supabase
        .from('rides')
        .update({
          payment_status: 'paid',
          status: 'completed' // Auto-complete ride on payment for this demo
        })
        .eq('id', currentRideId);

      if (error) throw error;

      toast.success(`Payment Successful! Transaction ID: ${transactionId}`);
      // Redirect to Ride Details for Live Tracking
      navigate(`/ride-details?id=${currentRideId}&track=true`);

    } catch (err: any) {
      console.error(err);
      toast.error("Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (amount === 0 && !loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">No Pending Payments</h2>
          <p className="text-muted-foreground mb-4">You have no rides pending payment.</p>
          <Button onClick={() => navigate('/home')}>Return Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border/50 px-4 py-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/ride-details?id=" + currentRideId)}
            className="rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Payment</h1>
            <p className="text-sm text-muted-foreground">Select payment method</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        {/* Amount Card */}
        <Card className="card-taxi">
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-1">Total to Pay</p>
            <h2 className="text-4xl font-bold text-primary">₹{amount}</h2>
          </div>
        </Card>

        {/* Payment Methods */}
        <div className="grid grid-cols-2 gap-4">
          <Card
            className={`cursor-pointer p-4 flex flex-col items-center justify-center space-y-2 transition-all duration-300 ${paymentMethod === "card"
              ? "border-primary border-2 bg-primary/5"
              : "hover:border-primary/50"
              }`}
            onClick={() => setPaymentMethod("card")}
          >
            <CreditCard className={`w-8 h-8 ${paymentMethod === "card" ? "text-primary" : ""}`} />
            <span className="font-medium">Card</span>
          </Card>

          <Card
            className={`cursor-pointer p-4 flex flex-col items-center justify-center space-y-2 transition-all duration-300 ${paymentMethod === "upi"
              ? "border-primary border-2 bg-primary/5"
              : "hover:border-primary/50"
              }`}
            onClick={() => setPaymentMethod("upi")}
          >
            <Smartphone className={`w-8 h-8 ${paymentMethod === "upi" ? "text-primary" : ""}`} />
            <span className="font-medium">UPI</span>
          </Card>
        </div>

        {/* Payment Form */}
        <Card className="card-taxi animate-slide-up">
          <form onSubmit={handlePayment} className="space-y-4">
            {paymentMethod === "card" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Card Number</label>
                  <div className="relative">
                    <Input placeholder="0000 0000 0000 0000" />
                    <CreditCard className="w-5 h-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Expiry</label>
                    <Input placeholder="MM/YY" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CVV</label>
                    <div className="relative">
                      <Input type="password" placeholder="123" />
                      <Lock className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">UPI ID</label>
                <Input placeholder="username@upi" required />
              </div>
            )}

            <div className="bg-muted/50 p-3 rounded-lg flex items-center space-x-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span>Secure 256-bit encrypted transaction</span>
            </div>

            <Button
              type="submit"
              className="btn-taxi w-full h-14 text-lg font-semibold mt-6"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : `Pay ₹${amount}`}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Payment;