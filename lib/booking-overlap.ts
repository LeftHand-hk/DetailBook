export function timeToMinutes(value: string): number | null {
  const input = String(value || "").trim();
  const twelveHour = input.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]) % 12;
    if (twelveHour[3].toUpperCase() === "PM") hour += 12;
    const minute = Number(twelveHour[2]);
    return minute < 60 ? hour * 60 + minute : null;
  }
  const twentyFourHour = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!twentyFourHour) return null;
  const hour = Number(twentyFourHour[1]);
  const minute = Number(twentyFourHour[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export function bookingTimesOverlap(
  firstTime: string,
  firstDuration: number,
  secondTime: string,
  secondDuration: number,
): boolean {
  const firstStart = timeToMinutes(firstTime);
  const secondStart = timeToMinutes(secondTime);
  if (firstStart === null || secondStart === null) return firstTime === secondTime;
  return firstStart < secondStart + Math.max(1, secondDuration || 60)
    && secondStart < firstStart + Math.max(1, firstDuration || 60);
}
