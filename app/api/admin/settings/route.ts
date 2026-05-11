import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create default settings
    let settings = await prisma.platformSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: { id: "default" },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET /api/admin/settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const {
      platformName,
      supportEmail,
      defaultDomain,
      customDomainsEnabled,
      starterPrice,
      proPrice,
      trialDays,
      maintenanceMode,
      maintenanceMessage,
      dbHost,
      dbPort,
      dbName,
      dbUser,
      dbPassword,
      stripeEnabled,
      stripePublishableKey,
      stripeSecretKey,
      stripeWebhookSecret,
      cryptoEnabled,
      cryptoWalletAddress,
      cryptoNetwork,
      cryptoAcceptedCoins,
      adsCampaignStartDate,
    } = body;

    const data: Record<string, unknown> = {};
    if (platformName !== undefined) data.platformName = platformName;
    if (supportEmail !== undefined) data.supportEmail = supportEmail;
    if (defaultDomain !== undefined) data.defaultDomain = defaultDomain;
    if (customDomainsEnabled !== undefined) data.customDomainsEnabled = customDomainsEnabled;
    if (starterPrice !== undefined) data.starterPrice = parseFloat(starterPrice);
    if (proPrice !== undefined) data.proPrice = parseFloat(proPrice);
    if (trialDays !== undefined) data.trialDays = parseInt(trialDays);
    if (maintenanceMode !== undefined) data.maintenanceMode = maintenanceMode;
    if (maintenanceMessage !== undefined) data.maintenanceMessage = maintenanceMessage;
    if (dbHost !== undefined) data.dbHost = dbHost;
    if (dbPort !== undefined) data.dbPort = parseInt(dbPort);
    if (dbName !== undefined) data.dbName = dbName;
    if (dbUser !== undefined) data.dbUser = dbUser;
    if (dbPassword !== undefined) data.dbPassword = dbPassword;
    if (stripeEnabled !== undefined) data.stripeEnabled = stripeEnabled;
    if (stripePublishableKey !== undefined) data.stripePublishableKey = stripePublishableKey;
    if (stripeSecretKey !== undefined) data.stripeSecretKey = stripeSecretKey;
    if (stripeWebhookSecret !== undefined) data.stripeWebhookSecret = stripeWebhookSecret;
    if (cryptoEnabled !== undefined) data.cryptoEnabled = cryptoEnabled;
    if (cryptoWalletAddress !== undefined) data.cryptoWalletAddress = cryptoWalletAddress;
    if (cryptoNetwork !== undefined) data.cryptoNetwork = cryptoNetwork;
    if (cryptoAcceptedCoins !== undefined) data.cryptoAcceptedCoins = cryptoAcceptedCoins;
    // adsCampaignStartDate: accepts ISO string or empty/null. The admin
    // metrics page passes "" when the founder wants to clear it.
    if (adsCampaignStartDate !== undefined) {
      if (adsCampaignStartDate === null || adsCampaignStartDate === "") {
        data.adsCampaignStartDate = null;
      } else {
        const d = new Date(adsCampaignStartDate);
        if (!isNaN(d.getTime())) data.adsCampaignStartDate = d;
      }
    }

    // Upsert to handle case where settings don't exist yet
    const settings = await prisma.platformSettings.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...data },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("PUT /api/admin/settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
