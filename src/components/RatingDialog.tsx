import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Star, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface RatingDialogProps {
  rideId: string;
  driverId: string;
  onSuccess: () => void;
}

export const RatingDialog = ({ rideId, driverId, onSuccess }: RatingDialogProps) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setLoading(true);
    try {
      const { user } = (await supabase.auth.getUser()).data;
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('ratings').insert({
        ride_id: rideId,
        reviewer_id: user.id,
        reviewee_id: driverId,
        rating,
        feedback
      });

      if (error) throw error;

      toast.success("Thank you for your feedback!");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit rating");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-6 animate-scale-in shadow-2xl border-primary/20 bg-gradient-to-b from-card to-muted/30">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-black tracking-tight">How was your trip?</h3>
        <p className="text-sm text-muted-foreground font-medium">Your feedback helps us improve your RideEasy experience.</p>
      </div>

      <div className="flex justify-center space-x-3">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => setRating(s)}
            className="transition-all duration-300 transform hover:scale-125"
          >
            <Star
              className={`w-10 h-10 ${
                s <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="relative">
        <textarea
          placeholder="Tell us more about your experience (optional)..."
          className="w-full min-h-[100px] p-4 bg-background border-2 border-border rounded-2xl text-sm focus:border-primary transition-colors outline-none"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <MessageSquare className="absolute right-4 bottom-4 w-4 h-4 text-muted-foreground/50" />
      </div>

      <Button
        onClick={handleSubmit}
        className="w-full h-14 text-lg font-black shadow-xl shadow-primary/20"
        disabled={loading}
      >
        {loading ? <Loader2 className="animate-spin mr-2" /> : "Submit Feedback"}
      </Button>
    </Card>
  );
};
