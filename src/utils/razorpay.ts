export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const initializeRazorpayPayment = async (options: {
  amount: number;
  name: string;
  description: string;
  userEmail?: string;
  userName?: string;
  onSuccess: (response: any) => void;
  onFailure: (error: any) => void;
}) => {
  const isLoaded = await loadRazorpayScript();

  if (!isLoaded) {
    options.onFailure(new Error("Razorpay SDK failed to load. Are you online?"));
    return;
  }

  const razorpayOptions: any = {
    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
    amount: options.amount * 100, // Razorpay expects amount in paise
    currency: "INR",
    name: options.name,
    description: options.description,
    handler: options.onSuccess,
    prefill: {
      name: options.userName,
      email: options.userEmail,
    },
    theme: {
      color: "#F59E0B", // Match the theme color (Amber/Taxi yellow)
    },
  };

  const rzp = new (window as any).Razorpay(razorpayOptions);
  rzp.open();
};
