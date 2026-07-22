export const ADVENTURE_LEVELS = [
  { name: "Primeiros Passos", minExperience: 0, shortName: "Início" },
  { name: "Caminhante", minExperience: 500, shortName: "Caminhante" },
  { name: "Explorador", minExperience: 1500, shortName: "Explorador" },
  { name: "Desbravador", minExperience: 3000, shortName: "Desbravador" },
  { name: "Guardião das Trilhas", minExperience: 6000, shortName: "Guardião" },
  { name: "Lenda da Montanha", minExperience: 10000, shortName: "Lenda" },
] as const;

export const POINTS_PER_BRL_DISCOUNT = 200;

export function pointsToDiscount(points: number) {
  const normalizedPoints = Math.max(0, Math.trunc(Number(points) || 0));
  return Math.floor((normalizedPoints * 100) / POINTS_PER_BRL_DISCOUNT) / 100;
}

export function discountToPoints(discount: number) {
  const normalizedCents = Math.max(0, Math.floor(((Number(discount) || 0) + Number.EPSILON) * 100));
  return Math.floor((normalizedCents * POINTS_PER_BRL_DISCOUNT) / 100);
}

export function getAdventureProgress(experience: number) {
  const normalized = Math.max(0, Math.trunc(Number(experience) || 0));
  const currentIndex = [...ADVENTURE_LEVELS]
    .reverse()
    .findIndex((level) => normalized >= level.minExperience);
  const index = currentIndex < 0
    ? 0
    : ADVENTURE_LEVELS.length - 1 - currentIndex;
  const current = ADVENTURE_LEVELS[index];
  const next = ADVENTURE_LEVELS[index + 1] || null;
  const progress = next
    ? Math.min(100, Math.max(0,
        ((normalized - current.minExperience) /
          (next.minExperience - current.minExperience)) * 100,
      ))
    : 100;

  return {
    experience: normalized,
    current,
    next,
    progress,
    remaining: next ? Math.max(0, next.minExperience - normalized) : 0,
    levelNumber: index + 1,
  };
}
