# RideEasy - Your Reliable Ride Partner 🚖

RideEasy is a modern cab booking application offering reliable rides, professional drivers, and affordable fares. **We are revolutionizing the ride-hailing industry with a ZERO COMMISSION model.** Instead of per-ride commissions, we offer flexible **Monthly, Quarterly, and Annual subscription plans** for drivers, ensuring they keep 100% of their hard-earned money.

**Live Demo:** [https://ride-easy-v2.vercel.app/](https://ride-easy-v2.vercel.app/)

## 🚀 Features

- **Zero Commission Model**: Drivers subscribe to Monthly, Quarterly, or Annual plans and keep 100% of their ride fares.
- **Easy Booking**: Quick and intuitive interface for passengers to book a ride in seconds.
- **Real-time Tracking**: Interactive maps powered by Leaflet to track your ride status.
- **Secure Payments**: Integrated with Stripe for seamless subscription management and ride payments.
- **User Authentication**: Secure sign-up and login via Supabase for both Drivers and Passengers.
- **Responsive Design**: Fully optimized for mobile and desktop devices.
- **Modern UI**: Clean and accessible interface built with shadcn/ui and Tailwind CSS.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui, Lucide React (Icons)
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router DOM v6
- **Maps**: Leaflet, React Leaflet
- **Forms & Validation**: React Hook Form, Zod
- **Backend / BaaS**: Supabase (Auth, Database, Realtime)
- **Payments**: Stripe (Handling Subscriptions & Payments)
- **Charts**: Recharts

## 📦 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- Node.js & npm (or bun/yarn/pnpm)
- A Supabase project
- A Stripe account

### Installation

1.  **Clone the repository**

    ```bash
    git clone <YOUR_GIT_URL>
    cd yellow-cab-go
    ```

2.  **Install dependencies**

    ```bash
    npm install
    # or
    bun install
    ```

3.  **Environment Setup**

    Create a `.env` file in the root directory and add your keys:

    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
    ```

4.  **Run the development server**

    ```bash
    npm run dev
    ```

    The app should now be running on `http://localhost:8080` (or whatever port Vite selects).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
