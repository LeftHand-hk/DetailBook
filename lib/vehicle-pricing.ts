// Vehicle-type pricing helpers. A package can optionally charge a flat
// surcharge on top of its base price for larger vehicles. Sedan is the
// implicit "base" tier (surcharge = 0). When a package's vehiclePricing
// list is empty, the package is flat-priced and available for any
// vehicle type.

export const VEHICLE_TYPES = [
  { id: "sedan",  label: "Sedan",        emoji: "🚗" },
  { id: "coupe",  label: "Coupe / Sports", emoji: "🏎️" },
  { id: "suv",    label: "SUV / Crossover", emoji: "🚙" },
  { id: "truck",  label: "Truck / Pickup", emoji: "🛻" },
  { id: "van",    label: "Van / Minivan", emoji: "🚐" },
] as const;

export type VehicleTypeId = typeof VEHICLE_TYPES[number]["id"];

export const VEHICLE_TYPE_IDS: readonly VehicleTypeId[] = VEHICLE_TYPES.map((v) => v.id);

export type VehiclePricingEntry = { type: VehicleTypeId; surcharge: number };

const validIdSet = new Set<string>(VEHICLE_TYPE_IDS);

// Accepts owner input and returns a cleaned array. Drops malformed
// entries, dedupes by type (last entry wins), clamps surcharge >= 0.
// Returns `undefined` when the caller passed nothing (so the API can
// distinguish "leave alone" from "explicitly clear").
export function sanitizeVehiclePricing(input: unknown): VehiclePricingEntry[] | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (!Array.isArray(input)) return null;

  const seen = new Map<VehicleTypeId, VehiclePricingEntry>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const type = typeof r.type === "string" ? r.type.trim().toLowerCase() : "";
    if (!validIdSet.has(type)) continue;
    const surchargeNum = typeof r.surcharge === "number" ? r.surcharge : parseFloat(String(r.surcharge));
    if (!Number.isFinite(surchargeNum) || surchargeNum < 0) continue;
    seen.set(type as VehicleTypeId, {
      type: type as VehicleTypeId,
      surcharge: Math.round(surchargeNum * 100) / 100,
    });
  }
  return Array.from(seen.values());
}

// Resolve the surcharge a booking should pay for a given vehicle type.
// Returns 0 when:
//   - the package has no vehiclePricing list (flat-priced for everyone)
//   - the customer didn't pick a vehicle type
//   - the customer's vehicle type isn't covered (caller should reject
//     the booking earlier; this helper falls back to 0 defensively)
export function surchargeForVehicleType(
  pricing: unknown,
  vehicleType: string | null | undefined,
): number {
  if (!vehicleType) return 0;
  if (!Array.isArray(pricing) || pricing.length === 0) return 0;
  const lower = vehicleType.toLowerCase();
  for (const raw of pricing) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.type === "string" && r.type.toLowerCase() === lower) {
      const n = typeof r.surcharge === "number" ? r.surcharge : parseFloat(String(r.surcharge));
      return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
    }
  }
  return 0;
}

// True when this package can be booked with the given vehicle type.
// Flat-priced packages (no vehiclePricing list) accept any vehicle.
export function packageSupportsVehicleType(
  pricing: unknown,
  vehicleType: string | null | undefined,
): boolean {
  if (!Array.isArray(pricing) || pricing.length === 0) return true;
  if (!vehicleType) return false;
  const lower = vehicleType.toLowerCase();
  return pricing.some((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const r = raw as Record<string, unknown>;
    return typeof r.type === "string" && r.type.toLowerCase() === lower;
  });
}
