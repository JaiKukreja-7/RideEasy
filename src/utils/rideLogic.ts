export type RideStatus = 'requested' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

export const VALID_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  'requested': ['accepted', 'cancelled'],
  'accepted': ['arrived', 'cancelled'],
  'arrived': ['in_progress', 'cancelled'],
  'in_progress': ['completed'],
  'completed': [],
  'cancelled': []
};

export function isValidTransition(current: RideStatus, next: RideStatus): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export function getStatusMessage(status: RideStatus): string {
  const messages: Record<RideStatus, string> = {
    requested: "Finding a driver...",
    accepted: "Driver assigned - on the way",
    arrived: "Driver has arrived at pickup",
    in_progress: "Trip in progress",
    completed: "Ride finished",
    cancelled: "Ride cancelled"
  };
  return messages[status] || status;
}
