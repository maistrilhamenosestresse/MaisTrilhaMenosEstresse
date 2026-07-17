export const REQUIRED_PAID_TRAILS = 3;

export function hasMemberAccess(paidTrails: number, manuallyAuthorized = false) {
  return manuallyAuthorized || paidTrails >= REQUIRED_PAID_TRAILS;
}

export function remainingPaidTrails(paidTrails: number) {
  return Math.max(0, REQUIRED_PAID_TRAILS - paidTrails);
}
