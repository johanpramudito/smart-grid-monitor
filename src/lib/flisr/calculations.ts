const NANOS_IN_SECOND = BigInt("1000000000");

export type FaultDistanceResult = {
  distanceFromStartMeters: number;
  distanceFromEndMeters: number;
  lineLengthMeters: number;
  propagationSpeed: number;
  timeDeltaSeconds: number;
  clamped: boolean;
  confidence: number;
};

function toBigIntTimestamp(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Timestamp must be a finite number.");
    }
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    if (!/^-?\d+$/.test(value.trim())) {
      throw new Error(`Timestamp string "${value}" is not a valid integer.`);
    }
    return BigInt(value.trim());
  }
  throw new Error("Timestamp is not a supported type.");
}

export function calculateTimeDeltaSeconds(
  timestampA: unknown,
  timestampB: unknown,
): number {
  const tsA = toBigIntTimestamp(timestampA);
  const tsB = toBigIntTimestamp(timestampB);
  const delta = tsA - tsB;
  // Clamp to IEEE double precision safe bounds. The delta for traveling waves is in micro/nanoseconds.
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  if (delta > maxSafe || delta < -maxSafe) {
    throw new Error("Timestamp delta exceeds IEEE float precision limits.");
  }
  return Number(delta) / Number(NANOS_IN_SECOND);
}

export function calculatePropagationSpeed(
  inductanceHKm: number,
  capacitanceFKm: number,
): number {
  if (!Number.isFinite(inductanceHKm) || inductanceHKm <= 0) {
    throw new Error("Inductance per km must be a positive finite number.");
  }
  if (!Number.isFinite(capacitanceFKm) || capacitanceFKm <= 0) {
    throw new Error("Capacitance per km must be a positive finite number.");
  }

  // Convert distributed parameters from per-kilometre to per-metre.
  const inductancePerMeter = inductanceHKm / 1000;
  const capacitancePerMeter = capacitanceFKm / 1000;

  const product = inductancePerMeter * capacitancePerMeter;
  if (product <= 0) {
    throw new Error("Invalid LC product computed for propagation velocity.");
  }

  const propagationSpeed = 1 / Math.sqrt(product);
  if (!Number.isFinite(propagationSpeed) || propagationSpeed <= 0) {
    throw new Error("Propagation speed calculation produced an invalid value.");
  }

  return propagationSpeed;
}

export function calculateFaultDistance(
  lengthKm: number,
  propagationSpeed: number,
  timeDeltaSeconds: number,
): FaultDistanceResult {
  if (!Number.isFinite(lengthKm) || lengthKm <= 0) {
    throw new Error("Line length must be a positive value in kilometres.");
  }
  if (!Number.isFinite(propagationSpeed) || propagationSpeed <= 0) {
    throw new Error("Propagation speed must be positive.");
  }
  if (!Number.isFinite(timeDeltaSeconds)) {
    throw new Error("Time delta must be a finite number.");
  }

  const lengthMeters = lengthKm * 1000;
  // Formula 4.9 (double-ended method): d = (L + v * (t_a - t_b)) / 2.
  const rawDistance = 0.5 * (lengthMeters + propagationSpeed * timeDeltaSeconds);

  let clampedDistance = rawDistance;
  let clamped = false;
  if (rawDistance < 0) {
    clampedDistance = 0;
    clamped = true;
  } else if (rawDistance > lengthMeters) {
    clampedDistance = lengthMeters;
    clamped = true;
  }

  const distanceFromEnd = lengthMeters - clampedDistance;
  const confidence = clamped
    ? Math.max(0.4, 1 - Math.abs(rawDistance - clampedDistance) / lengthMeters)
    : 1;

  return {
    distanceFromStartMeters: clampedDistance,
    distanceFromEndMeters: distanceFromEnd,
    lineLengthMeters: lengthMeters,
    propagationSpeed,
    timeDeltaSeconds,
    clamped,
    confidence: Number(confidence.toFixed(2)),
  };
}
