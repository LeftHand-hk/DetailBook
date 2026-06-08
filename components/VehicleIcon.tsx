import type { VehicleTypeId } from "@/lib/vehicle-pricing";

// Proper SVG silhouettes for each vehicle tier — replaces the emoji
// icons that looked playful next to a real booking flow. Each shape is
// distinct enough to read at small sizes (32×32) on a phone.

export function VehicleIcon({ type, className }: { type: VehicleTypeId; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (type) {
    case "sedan":
      // Smooth, low-slung sedan. Curved roof line, distinct trunk + hood.
      return (
        <svg {...common}>
          <path d="M3 14l1.6-4.6A3 3 0 0 1 7.4 7.5h9.2a3 3 0 0 1 2.8 1.9L21 14" />
          <path d="M3 14h18v3.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V16H7v1.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V14z" />
          <circle cx="7" cy="17" r="1.5" fill="currentColor" />
          <circle cx="17" cy="17" r="1.5" fill="currentColor" />
        </svg>
      );
    case "coupe":
      // Sportier — wider roof slope, lower stance.
      return (
        <svg {...common}>
          <path d="M3 14.5l3-5.5A3 3 0 0 1 8.6 7.5h6.8a3 3 0 0 1 2.6 1.5L21 14.5" />
          <path d="M3 14.5h18v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1.5H7v1.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z" />
          <circle cx="7" cy="17" r="1.5" fill="currentColor" />
          <circle cx="17" cy="17" r="1.5" fill="currentColor" />
        </svg>
      );
    case "suv":
      // Tall, boxy, square roof.
      return (
        <svg {...common}>
          <path d="M4 13V7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5V13" />
          <path d="M3 13h18v4.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V16H7v1.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V13z" />
          <line x1="12" y1="6" x2="12" y2="13" />
          <circle cx="7" cy="17" r="1.5" fill="currentColor" />
          <circle cx="17" cy="17" r="1.5" fill="currentColor" />
        </svg>
      );
    case "truck":
      // Crew cab on the left, open bed on the right.
      return (
        <svg {...common}>
          <path d="M3 14V8.5a1.5 1.5 0 0 1 1.5-1.5h6.5V14" />
          <path d="M11 11h10v3" />
          <path d="M3 14h18v3.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V16H7v1.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V14z" />
          <circle cx="7" cy="17" r="1.5" fill="currentColor" />
          <circle cx="17" cy="17" r="1.5" fill="currentColor" />
        </svg>
      );
    case "van":
      // Tall, very boxy, with a forward slope.
      return (
        <svg {...common}>
          <path d="M3 14V7.5A1.5 1.5 0 0 1 4.5 6h11.7l3.8 5.5V14" />
          <path d="M3 14h18v3.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V16H7v1.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V14z" />
          <line x1="12" y1="6" x2="12" y2="14" />
          <circle cx="7" cy="17" r="1.5" fill="currentColor" />
          <circle cx="17" cy="17" r="1.5" fill="currentColor" />
        </svg>
      );
  }
}
