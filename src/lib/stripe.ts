
import { loadStripe } from "@stripe/stripe-js";

// This will be null if the key is missing, which we handle in the UI
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");
