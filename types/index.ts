export interface BusinessHours {
  open: string;
  close: string;
  closed: boolean;
}

export interface User {
  id: string;
  businessName: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  slug: string;
  plan: "starter" | "pro";
  trialEndsAt: string;
  serviceType?: "mobile" | "shop" | "both";
  timezone?: string;
  bio?: string;
  address?: string;
  emailReminders?: boolean;
  customMessage?: string;
  advanceBookingDays?: number;
  // Enhanced profile fields
  logo?: string;
  coverImage?: string;
  instagram?: string;
  facebook?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  yearsInBusiness?: number;
  serviceAreas?: string[];
  businessHours?: {
    monday: BusinessHours;
    tuesday: BusinessHours;
    wednesday: BusinessHours;
    thursday: BusinessHours;
    friday: BusinessHours;
    saturday: BusinessHours;
    sunday: BusinessHours;
  };
  // Banner & Layout
  bannerImage?: string;
  bannerOverlayOpacity?: number;
  serviceLayout?: "cards" | "list" | "compact" | "featured" | "minimal";
  // Booking page customization
  bookingPageTheme?: "light" | "dark" | "auto";
  accentColor?: string;
  bookingPageTitle?: string;
  bookingPageSubtitle?: string;
  showRating?: boolean;
  showSocialLinks?: boolean;
  showServiceAreas?: boolean;
  showBusinessHours?: boolean;
  showTrustBadges?: boolean;
  requireDeposit?: boolean;
  depositPercentage?: number;
  thankYouMessage?: string;
  termsText?: string;
  // Payment methods
  paymentMethods?: {
    stripe?: { enabled: boolean; publishableKey?: string; secretKey?: string; connected?: boolean };
    square?: { enabled: boolean; applicationId?: string; accessToken?: string; locationId?: string; sandbox?: boolean };
    paypal?: { enabled: boolean; email?: string; paypalMeLink?: string; requireProof?: boolean };
    cashapp?: { enabled: boolean; cashtag?: string; requireProof?: boolean };
    bankTransfer?: { enabled: boolean; bankName?: string; accountName?: string; iban?: string; sortCode?: string; accountNumber?: string; instructions?: string; requireProof?: boolean };
    cash?: { enabled: boolean; instructions?: string };
  };
  // SMS & Email templates
  smsTemplates?: {
    bookingConfirmation: string;
    reminder24h: string;
    followUp: string;
  };
  emailTemplates?: {
    bookingConfirmation: string;
    reminder24h: string;
    followUp: string;
  };
  // One-shot flag for the "Customize My Page" modal shown after the
  // Setup Guide's Finish button. True after the modal appears once,
  // regardless of which CTA the user picks.
  hasSeenCustomizePrompt?: boolean;
  // Photo gallery display preferences. Photos themselves live in a
  // separate BusinessPhoto table — these three fields just control
  // how the public booking page renders them.
  galleryLayout?: "grid" | "carousel" | "masonry";
  galleryShowTitle?: boolean;
  galleryTitle?: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  color: string;
  active: boolean;
  avatar?: string;
  notes?: string;
  createdAt?: string;
  // stats (computed)
  totalBookings?: number;
  completedBookings?: number;
  totalRevenue?: number;
}

export interface PackageAddon {
  id: string;
  name: string;
  price: number;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  active: boolean;
  deposit?: number;
  addons?: PackageAddon[];
}

export interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicle: {
    make: string;
    model: string;
    year: string;
    color: string;
  };
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  date: string;
  time: string;
  status: string;
  depositPaid: number;
  depositRequired: number;
  notes: string;
  address?: string;
  staffId?: string;
  staffName?: string;
  createdAt?: string;
}
