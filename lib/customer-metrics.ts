import { normalizePhone } from "@/lib/phone";

type MetricCustomer = { id: string; email: string | null; phone: string | null };
type MetricBooking = {
  id: string;
  customerId: string | null;
  customerEmail: string;
  customerPhone: string;
  date: string;
  serviceName: string;
  servicePrice: number;
  addonsTotal: number;
  status: string;
  createdAt: Date;
};

export type CustomerMetric = {
  totalBookings: number;
  totalSpent: number;
  lastBookingDate: string | null;
  lastService: string | null;
};

export function buildCustomerMetrics(customers: MetricCustomer[], bookings: MetricBooking[]) {
  const byCustomerId = new Map<string, MetricBooking[]>();
  const byEmail = new Map<string, MetricBooking[]>();
  const byPhone = new Map<string, MetricBooking[]>();
  const add = (index: Map<string, MetricBooking[]>, key: string, booking: MetricBooking) => {
    if (!key) return;
    const current = index.get(key);
    if (current) current.push(booking);
    else index.set(key, [booking]);
  };
  for (const booking of bookings) {
    if (booking.customerId) add(byCustomerId, booking.customerId, booking);
    add(byEmail, booking.customerEmail.toLowerCase(), booking);
    add(byPhone, normalizePhone(booking.customerPhone), booking);
  }

  const result = new Map<string, CustomerMetric>();
  for (const customer of customers) {
    const matches = new Map<string, MetricBooking>();
    const email = (customer.email || "").toLowerCase();
    const phone = normalizePhone(customer.phone);
    for (const booking of byCustomerId.get(customer.id) || []) matches.set(booking.id, booking);
    for (const booking of email ? byEmail.get(email) || [] : []) matches.set(booking.id, booking);
    for (const booking of phone ? byPhone.get(phone) || [] : []) matches.set(booking.id, booking);

    let totalSpent = 0;
    let latest: MetricBooking | null = null;
    for (const booking of Array.from(matches.values())) {
      if (booking.status === "completed") totalSpent += (booking.servicePrice || 0) + (booking.addonsTotal || 0);
      if (!latest || booking.date > latest.date || (booking.date === latest.date && booking.createdAt > latest.createdAt)) {
        latest = booking;
      }
    }
    result.set(customer.id, {
      totalBookings: matches.size,
      totalSpent,
      lastBookingDate: latest?.date || null,
      lastService: latest?.serviceName || null,
    });
  }
  return result;
}
