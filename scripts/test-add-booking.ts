// Hits POST /api/bookings on the live app with the exact payload shape the
// new Add-booking modal sends. Logs in as the demo user, posts a booking,
// then deletes it so the test doesn't pollute the demo dashboard.
import "dotenv/config";

const BASE = "https://detailbookapp.com";

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "mike@demo.com", password: "demo123" }),
  });
  if (!loginRes.ok) { console.error("login failed:", loginRes.status, await loginRes.text()); return; }
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const cookie = setCookie.split(",").map((c) => c.split(";")[0]).join("; ");
  console.log("logged in");

  const payload = {
    customerName: "Test Walk-in",
    customerEmail: "walkin+test@example.com",
    customerPhone: "(555) 000-0000",
    vehicle: { make: "Toyota", model: "Camry", year: "asdf2030", color: "Blue" },
    serviceId: "",
    serviceName: "Custom Quick Wash",
    servicePrice: 67,
    date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    time: "10:00",
    notes: "Posted by test-add-booking.ts",
    status: "confirmed",
    depositRequired: 0,
    depositPaid: 0,
  };

  const post = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(payload),
  });
  const body = await post.json().catch(() => ({}));
  console.log("POST /api/bookings →", post.status);
  console.log(JSON.stringify(body, null, 2));
  if (!post.ok) return;

  const booking = (body as any).booking || body;
  console.log(`\nVerifying: serviceName=${booking.serviceName}  servicePrice=${booking.servicePrice}  year=${booking.vehicleYear}`);

  // Cleanup so we don't litter the demo dashboard.
  if (booking.id) {
    const del = await fetch(`${BASE}/api/bookings/${booking.id}`, {
      method: "DELETE",
      headers: { cookie },
    });
    console.log(`cleanup DELETE → ${del.status}`);
  }
}
main().catch(console.error);
