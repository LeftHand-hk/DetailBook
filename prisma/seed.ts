import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin
  const adminPassword = await bcrypt.hash("admin123!", 12);
  await prisma.admin.upsert({
    where: { email: "admin@detailbook.com" },
    update: {},
    create: {
      email: "admin@detailbook.com",
      password: adminPassword,
    },
  });
  console.log("Admin created: admin@detailbook.com / admin123!");

  // Create platform settings
  await prisma.platformSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      platformName: "DetailBook",
      supportEmail: "support@detailbook.com",
      defaultDomain: "detailbook.app",
      starterPrice: 29,
      proPrice: 49,
      trialDays: 30,
    },
  });
  console.log("Platform settings initialized");

  // Create demo user
  const demoPassword = await bcrypt.hash("demo123", 12);
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  const demoUser = await prisma.user.upsert({
    where: { email: "mike@demo.com" },
    update: {},
    create: {
      email: "mike@demo.com",
      password: demoPassword,
      businessName: "Mike's Mobile Detailing",
      name: "Mike Anderson",
      phone: "(555) 123-4567",
      city: "Austin, TX",
      slug: "mikes-mobile-detailing",
      plan: "starter",
      trialEndsAt: trialEnd.toISOString().split("T")[0],
      bio: "Professional auto detailing serving the greater Austin area. 8+ years of experience.",
      address: "Austin, TX 78701",
      rating: 4.9,
      reviewCount: 127,
      yearsInBusiness: 8,
      serviceAreas: ["Austin", "Round Rock", "Cedar Park", "Pflugerville", "Georgetown"],
      businessHours: {
        monday: { open: "8:00 AM", close: "6:00 PM", closed: false },
        tuesday: { open: "8:00 AM", close: "6:00 PM", closed: false },
        wednesday: { open: "8:00 AM", close: "6:00 PM", closed: false },
        thursday: { open: "8:00 AM", close: "6:00 PM", closed: false },
        friday: { open: "8:00 AM", close: "5:00 PM", closed: false },
        saturday: { open: "9:00 AM", close: "4:00 PM", closed: false },
        sunday: { open: "10:00 AM", close: "2:00 PM", closed: true },
      },
      instagram: "mikesmobiledetailing",
      facebook: "mikesmobiledetailing",
      website: "mikesmobiledetailing.com",
    },
  });
  console.log("Demo user created: mike@demo.com / demo123");

  // Create demo packages
  const packages = [
    { name: "Basic Wash & Shine", description: "Exterior hand wash, tire dressing, window cleaning, and quick interior vacuum.", price: 49, duration: 60, deposit: 10, active: true },
    { name: "Interior Detail", description: "Full interior deep clean including leather conditioning, carpet shampoo, and dashboard treatment.", price: 129, duration: 150, deposit: 30, active: true },
    { name: "Full Detail", description: "Complete interior and exterior detail. Includes clay bar, polish, wax, and full interior deep clean.", price: 249, duration: 240, deposit: 50, active: true },
    { name: "Ceramic Coating", description: "Professional-grade ceramic coating for long-lasting protection and shine. Includes full paint correction.", price: 599, duration: 480, deposit: 150, active: true },
  ];

  for (const pkg of packages) {
    await prisma.package.create({
      data: { ...pkg, userId: demoUser.id },
    });
  }
  console.log("Demo packages created");

  // Create demo bookings
  const today = new Date();
  const bookings = [
    { customerName: "Sarah Johnson", customerEmail: "sarah@email.com", customerPhone: "(555) 234-5678", vehicleMake: "Tesla", vehicleModel: "Model 3", vehicleYear: "2023", vehicleColor: "White", serviceName: "Full Detail", servicePrice: 249, date: today.toISOString().split("T")[0], time: "9:00 AM", status: "confirmed", depositPaid: 50, depositRequired: 50 },
    { customerName: "James Wilson", customerEmail: "james@email.com", customerPhone: "(555) 345-6789", vehicleMake: "BMW", vehicleModel: "X5", vehicleYear: "2022", vehicleColor: "Black", serviceName: "Ceramic Coating", servicePrice: 599, date: new Date(today.getTime() + 86400000).toISOString().split("T")[0], time: "10:00 AM", status: "pending", depositPaid: 0, depositRequired: 150 },
    { customerName: "Emily Chen", customerEmail: "emily@email.com", customerPhone: "(555) 456-7890", vehicleMake: "Mercedes", vehicleModel: "C300", vehicleYear: "2024", vehicleColor: "Silver", serviceName: "Interior Detail", servicePrice: 129, date: new Date(today.getTime() + 172800000).toISOString().split("T")[0], time: "2:00 PM", status: "confirmed", depositPaid: 30, depositRequired: 30 },
    { customerName: "David Park", customerEmail: "david@email.com", customerPhone: "(555) 567-8901", vehicleMake: "Porsche", vehicleModel: "911", vehicleYear: "2023", vehicleColor: "Red", serviceName: "Full Detail", servicePrice: 249, date: new Date(today.getTime() - 86400000).toISOString().split("T")[0], time: "11:00 AM", status: "completed", depositPaid: 50, depositRequired: 50 },
    { customerName: "Lisa Martinez", customerEmail: "lisa@email.com", customerPhone: "(555) 678-9012", vehicleMake: "Audi", vehicleModel: "Q7", vehicleYear: "2022", vehicleColor: "Gray", serviceName: "Basic Wash & Shine", servicePrice: 49, date: new Date(today.getTime() - 172800000).toISOString().split("T")[0], time: "3:00 PM", status: "completed", depositPaid: 10, depositRequired: 10 },
  ];

  for (const booking of bookings) {
    await prisma.booking.create({
      data: { ...booking, serviceId: "demo", userId: demoUser.id },
    });
  }
  console.log("Demo bookings created");

  console.log("\nSeed complete! You can log in with:");
  console.log("  User:  mike@demo.com / demo123");
  console.log("  Admin: admin@detailbook.com / admin123!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
