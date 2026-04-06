"use client";

import { useEffect, createContext, useContext, useState } from "react";
import type { Paddle } from "@paddle/paddle-js";

const PaddleContext = createContext<Paddle | null>(null);

export function usePaddle() {
  return useContext(PaddleContext);
}

export function PaddleProvider({ children }: { children: React.ReactNode }) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) return;

    import("@paddle/paddle-js").then(({ initializePaddle }) => {
      initializePaddle({
        environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production") || "production",
        token,
        eventCallback(event) {
          if (event.name === "checkout.completed") {
            // Reload user data after successful payment
            setTimeout(() => window.location.reload(), 2000);
          }
        },
      }).then((instance) => {
        if (instance) setPaddle(instance);
      });
    });
  }, []);

  return (
    <PaddleContext.Provider value={paddle}>
      {children}
    </PaddleContext.Provider>
  );
}
