import type { GeoPosition } from "./types";

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineDistanceMeters(
  first: Pick<GeoPosition, "latitude" | "longitude">,
  second: Pick<GeoPosition, "latitude" | "longitude">,
) {
  const lat1 = toRadians(first.latitude);
  const lat2 = toRadians(second.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(second.longitude - first.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function extractRouteCoordinates(value: unknown): Array<[number, number]> {
  const output: Array<[number, number]> = [];
  visit(value, output);
  return output;
}

export function distanceToRouteMeters(
  position: Pick<GeoPosition, "latitude" | "longitude">,
  route: unknown,
) {
  const coordinates = extractRouteCoordinates(route);
  if (!coordinates.length) return null;
  if (coordinates.length === 1) {
    return haversineDistanceMeters(position, {
      longitude: coordinates[0][0],
      latitude: coordinates[0][1],
    });
  }
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < coordinates.length; index++) {
    minimum = Math.min(minimum, pointToSegmentMeters(position, coordinates[index - 1], coordinates[index]));
  }
  return minimum;
}

function pointToSegmentMeters(
  point: Pick<GeoPosition, "latitude" | "longitude">,
  start: [number, number],
  end: [number, number],
) {
  const referenceLatitude = toRadians(point.latitude);
  const project = ([longitude, latitude]: [number, number]) => ({
    x: toRadians(longitude - point.longitude) * Math.cos(referenceLatitude) * EARTH_RADIUS_METERS,
    y: toRadians(latitude - point.latitude) * EARTH_RADIUS_METERS,
  });
  const a = project(start);
  const b = project(end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(a.x, a.y);
  const projection = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy)));
  return Math.hypot(a.x + projection * dx, a.y + projection * dy);
}

function visit(value: unknown, output: Array<[number, number]>) {
  if (Array.isArray(value)) {
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      if (value[1] >= -90 && value[1] <= 90 && value[0] >= -180 && value[0] <= 180) {
        output.push([value[0], value[1]]);
      }
      return;
    }
    value.forEach((entry) => visit(entry, output));
    return;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("coordinates" in record) visit(record.coordinates, output);
    else if ("geometry" in record) visit(record.geometry, output);
    else if ("features" in record) visit(record.features, output);
  }
}

function toRadians(degrees: number) {
  return degrees * Math.PI / 180;
}
