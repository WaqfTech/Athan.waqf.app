// Simulation Clock managing playback speed, scrubbing, and real-time synchronization

export type PlaybackSpeed = -300 | -60 | -10 | -1 | 0 | 1 | 10 | 60 | 300 | 1800;

export interface SimulationClockListener {
  (date: Date, speed: number, isLive: boolean): void;
}

export class SimulationClock {
  private currentTimeMs: number;
  private speed: number = 1;
  private isLiveMode: boolean = true;
  private listeners: Set<SimulationClockListener> = new Set();

  constructor(initialDate = new Date()) {
    this.currentTimeMs = initialDate.getTime();
  }

  public getTime(): Date {
    return new Date(this.currentTimeMs);
  }

  public getTimeMs(): number {
    return this.currentTimeMs;
  }

  public getSpeed(): number {
    return this.speed;
  }

  public isLive(): boolean {
    return this.isLiveMode;
  }

  public setTime(date: Date): void {
    this.currentTimeMs = date.getTime();
    this.isLiveMode = false;
    this.notify();
  }

  public setSpeed(speed: number): void {
    this.speed = speed;
    if (speed !== 1) {
      this.isLiveMode = false;
    }
    this.notify();
  }

  public setLive(live = true): void {
    this.isLiveMode = live;
    if (live) {
      this.currentTimeMs = Date.now();
      this.speed = 1;
    }
    this.notify();
  }

  public tick(realDeltaSeconds: number): Date {
    if (this.isLiveMode) {
      this.currentTimeMs = Date.now();
    } else if (this.speed !== 0) {
      this.currentTimeMs += realDeltaSeconds * 1000 * this.speed;
    }
    this.notify();
    return this.getTime();
  }

  public subscribe(listener: SimulationClockListener): () => void {
    this.listeners.add(listener);
    listener(this.getTime(), this.speed, this.isLiveMode);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const d = this.getTime();
    for (const listener of this.listeners) {
      listener(d, this.speed, this.isLiveMode);
    }
  }
}
