interface DepositInput {
  requireDeposit: boolean;
  packageDeposit?: number | null;
  depositPercentage?: number | null;
  basePrice: number;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateRequiredDeposit({
  requireDeposit,
  packageDeposit,
  depositPercentage,
  basePrice,
}: DepositInput): number {
  if (!requireDeposit) return 0;

  const fixedDeposit = Number(packageDeposit);
  if (Number.isFinite(fixedDeposit) && fixedDeposit > 0) {
    return roundCurrency(fixedDeposit);
  }

  const percentage = Number(depositPercentage);
  const validPercentage = Number.isFinite(percentage) && percentage > 0 && percentage <= 100
    ? percentage
    : 20;
  const validBasePrice = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 0;

  return Math.max(1, roundCurrency(validBasePrice * validPercentage / 100));
}
