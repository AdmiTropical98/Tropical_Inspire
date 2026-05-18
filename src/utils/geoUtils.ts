export interface GeoCoord {
  lat: number;
  lng: number;
}

export interface RouteStop {
  id: string;
  name: string;
  coord: GeoCoord;
  timeToNext?: string;
}

/**
 * Calculates the Haversine distance between two coordinates in meters.
 */
export function calculateDistance(coord1: GeoCoord, coord2: GeoCoord): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371e3; // Earth radius in meters

  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates a basic progression of a vehicle along a predefined route of stops.
 * This is a simplified nearest-segment algorithm.
 * 
 * @param vehiclePos The current position of the vehicle
 * @param routeStops The ordered list of stops in the route
 * @returns { 
 *   currentSegmentIndex: index of the segment the vehicle is currently on (0 to stops.length - 2),
 *   progressInSegment: percentage (0-1) of progress along the current segment,
 *   totalProgress: percentage (0-1) of progress along the entire route
 * }
 */
export function calculateRouteProgress(vehiclePos: GeoCoord, routeStops: RouteStop[]) {
  if (!routeStops || routeStops.length < 2) {
    return { currentSegmentIndex: 0, progressInSegment: 0, totalProgress: 0 };
  }

  // 1. Calculate distances from vehicle to all stops
  const distancesToStops = routeStops.map(stop => calculateDistance(vehiclePos, stop.coord));

  // 2. Find the two closest stops to determine the likely current segment.
  // A simple heuristic: find the closest stop, then check if the vehicle is between it and the previous or next stop.
  let closestStopIndex = 0;
  let minDistance = distancesToStops[0];
  
  for (let i = 1; i < distancesToStops.length; i++) {
    if (distancesToStops[i] < minDistance) {
      minDistance = distancesToStops[i];
      closestStopIndex = i;
    }
  }

  let currentSegmentIndex = 0;

  // If closest is the first stop, we're on segment 0
  if (closestStopIndex === 0) {
    currentSegmentIndex = 0;
  }
  // If closest is the last stop, we're on the last segment
  else if (closestStopIndex === routeStops.length - 1) {
    currentSegmentIndex = routeStops.length - 2;
  }
  // Otherwise, determine if we are approaching the closest stop or leaving it.
  else {
    const distToPrev = distancesToStops[closestStopIndex - 1];
    const distToNext = distancesToStops[closestStopIndex + 1];
    
    // We are likely on the segment between (closest - 1) and closest, or between closest and (closest + 1)
    if (distToPrev < distToNext) {
      currentSegmentIndex = closestStopIndex - 1;
    } else {
      currentSegmentIndex = closestStopIndex;
    }
  }

  // Calculate segment progress using projection
  const startStop = routeStops[currentSegmentIndex];
  const endStop = routeStops[currentSegmentIndex + 1];
  
  const segmentLength = calculateDistance(startStop.coord, endStop.coord);
  const distFromStart = calculateDistance(startStop.coord, vehiclePos);
  const distFromEnd = calculateDistance(vehiclePos, endStop.coord);

  // Simplified projection: If we perfectly on line: distFromStart + distFromEnd == segmentLength
  // progress ≈ distFromStart / (distFromStart + distFromEnd)
  let progressInSegment = 0;
  if (segmentLength > 0) {
     const totalApproxDist = distFromStart + distFromEnd;
     progressInSegment = distFromStart / totalApproxDist;
  }

  // Cap between 0 and 1
  progressInSegment = Math.max(0, Math.min(1, progressInSegment));

  // Calculate total progress
  // Total route is divided evenly by segments for simplicity in the UI, 
  // or we could weight it by segment distance. UI Usually prefers evenly spaced stops.
  const totalSegments = routeStops.length - 1;
  const totalProgress = (currentSegmentIndex + progressInSegment) / totalSegments;

  return {
    currentSegmentIndex,
    progressInSegment,
    totalProgress
  };
}
