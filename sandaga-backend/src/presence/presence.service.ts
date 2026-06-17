import { Injectable } from '@nestjs/common';

const DEFAULT_ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

@Injectable()
export class PresenceService {
  private readonly lastSeen = new Map<string, number>();

  touch(userId: string): void {
    this.lastSeen.set(userId, Date.now());
  }

  isOnline(userId: string | null | undefined, thresholdMs = DEFAULT_ONLINE_THRESHOLD_MS): boolean {
    if (!userId) return false;
    const last = this.lastSeen.get(userId);
    if (!last) return false;
    return Date.now() - last <= thresholdMs;
  }
}
