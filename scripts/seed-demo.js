const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Delete existing demo user if exists
  const existing = await prisma.user.findUnique({ where: { email: 'mike@demo.com' } });
  if (existing) {
    await prisma.booking.deleteMany({ where: { userId: existing.id } });
    await prisma.package.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
    console.log('Deleted old demo user');
  }

  const hash = await bcrypt.hash('demo123', 12);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 15);

  const user = await prisma.user.create({
    data: {
      email: 'mike@demo.com',
      password: hash,
      businessName: "Mike's Mobile Detailing",
      name: 'Mike Anderson',
      phone: '(555) 867-5309',
      city: 'Austin, TX',
      slug: 'mikes-mobile-detailing',
      plan: 'pro',
      trialEndsAt: trialEndsAt.toISOString(),
      bio: 'Professional mobile auto detailing serving Austin and surrounding areas. 5+ years of experience.',
      instagram: 'mikesdetailing',
      serviceType: 'mobile',
      requireDeposit: true,
      depositPercentage: 25,
      emailReminders: true,
      advanceBookingDays: 30,
    },
  });

  console.log('Created demo user:', user.email);

  // Create packages
  const packages = await prisma.package.createMany({
    data: [
      {
        userId: user.id,
        name: 'Basic Wash & Shine',
        description: 'Exterior hand wash, dry, and tire dressing. Perfect for a quick refresh.',
        price: 89,
        duration: 60,
        deposit: 22,
        active: true,
      },
      {
        userId: user.id,
        name: 'Full Interior Detail',
        description: 'Deep vacuum, wipe down all surfaces, shampoo seats and carpet, window cleaning.',
        price: 149,
        duration: 120,
        deposit: 37,
        active: true,
      },
      {
        userId: user.id,
        name: 'Complete Detail Package',
        description: 'Full interior + exterior detail. Our most popular package. Includes clay bar and wax.',
        price: 249,
        duration: 180,
        deposit: 62,
        active: true,
      },
      {
        userId: user.id,
        name: 'Paint Correction',
        description: 'Single-stage machine polish to remove swirl marks, light scratches, and oxidation.',
        price: 399,
        duration: 300,
        deposit: 100,
        active: true,
      },
      {
        userId: user.id,
        name: 'Ceramic Coating',
        description: 'Professional-grade ceramic coating with 2-year protection warranty.',
        price: 799,
        duration: 480,
        deposit: 200,
        active: true,
      },
    ],
  });

  console.log('Created packages:', packages.count);

  // Get today and build dates around it
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  const bookingData = [
    {
      userId: user.id,
      customerName: 'James Walker',
      customerEmail: 'james@example.com',
      customerPhone: '(512) 555-0101',
      vehicleMake: 'Toyota', vehicleModel: 'Camry', vehicleYear: '2021', vehicleColor: 'Silver',
      serviceId: 'pkg1', serviceName: 'Complete Detail Package', servicePrice: 249,
      date: fmt(addDays(today, 2)), time: '9:00 AM',
      status: 'confirmed', depositPaid: 62, depositRequired: 62,
      notes: 'Please bring extra towels. Car has pet hair.',
    },
    {
      userId: user.id,
      customerName: 'Sarah Mitchell',
      customerEmail: 'sarah@example.com',
      customerPhone: '(512) 555-0102',
      vehicleMake: 'Ford', vehicleModel: 'Explorer', vehicleYear: '2022', vehicleColor: 'White',
      serviceId: 'pkg2', serviceName: 'Full Interior Detail', servicePrice: 149,
      date: fmt(addDays(today, 3)), time: '11:00 AM',
      status: 'pending', depositPaid: 0, depositRequired: 37,
    },
    {
      userId: user.id,
      customerName: 'David Chen',
      customerEmail: 'david@example.com',
      customerPhone: '(512) 555-0103',
      vehicleMake: 'BMW', vehicleModel: 'M3', vehicleYear: '2023', vehicleColor: 'Black',
      serviceId: 'pkg4', serviceName: 'Paint Correction', servicePrice: 399,
      date: fmt(addDays(today, 5)), time: '8:00 AM',
      status: 'confirmed', depositPaid: 100, depositRequired: 100,
      notes: 'Light swirls on hood and roof. Wants mirror finish.',
    },
    {
      userId: user.id,
      customerName: 'Maria Garcia',
      customerEmail: 'maria@example.com',
      customerPhone: '(512) 555-0104',
      vehicleMake: 'Honda', vehicleModel: 'CR-V', vehicleYear: '2020', vehicleColor: 'Blue',
      serviceId: 'pkg1', serviceName: 'Basic Wash & Shine', servicePrice: 89,
      date: fmt(addDays(today, -1)), time: '10:00 AM',
      status: 'completed', depositPaid: 22, depositRequired: 22,
    },
    {
      userId: user.id,
      customerName: 'Tyler Johnson',
      customerEmail: 'tyler@example.com',
      customerPhone: '(512) 555-0105',
      vehicleMake: 'Tesla', vehicleModel: 'Model 3', vehicleYear: '2023', vehicleColor: 'Red',
      serviceId: 'pkg5', serviceName: 'Ceramic Coating', servicePrice: 799,
      date: fmt(addDays(today, -3)), time: '8:00 AM',
      status: 'completed', depositPaid: 200, depositRequired: 200,
      notes: 'Repeat customer. Very happy with results.',
    },
    {
      userId: user.id,
      customerName: 'Amanda Lee',
      customerEmail: 'amanda@example.com',
      customerPhone: '(512) 555-0106',
      vehicleMake: 'Chevrolet', vehicleModel: 'Tahoe', vehicleYear: '2021', vehicleColor: 'Gray',
      serviceId: 'pkg3', serviceName: 'Complete Detail Package', servicePrice: 249,
      date: fmt(addDays(today, -5)), time: '1:00 PM',
      status: 'completed', depositPaid: 62, depositRequired: 62,
    },
    {
      userId: user.id,
      customerName: 'Robert Kim',
      customerEmail: 'robert@example.com',
      customerPhone: '(512) 555-0107',
      vehicleMake: 'Audi', vehicleModel: 'Q5', vehicleYear: '2022', vehicleColor: 'White',
      serviceId: 'pkg2', serviceName: 'Full Interior Detail', servicePrice: 149,
      date: fmt(addDays(today, 7)), time: '2:00 PM',
      status: 'confirmed', depositPaid: 37, depositRequired: 37,
    },
    {
      userId: user.id,
      customerName: 'Jennifer Brown',
      customerEmail: 'jennifer@example.com',
      customerPhone: '(512) 555-0108',
      vehicleMake: 'Lexus', vehicleModel: 'RX350', vehicleYear: '2020', vehicleColor: 'Pearl White',
      serviceId: 'pkg3', serviceName: 'Complete Detail Package', servicePrice: 249,
      date: fmt(addDays(today, 10)), time: '9:00 AM',
      status: 'pending', depositPaid: 0, depositRequired: 62,
    },
  ];

  for (const b of bookingData) {
    await prisma.booking.create({ data: b });
  }

  console.log('Created bookings:', bookingData.length);
  console.log('\nDemo user ready:');
  console.log('  Email:    mike@demo.com');
  console.log('  Password: demo123');
  console.log('  Plan:     Pro');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
