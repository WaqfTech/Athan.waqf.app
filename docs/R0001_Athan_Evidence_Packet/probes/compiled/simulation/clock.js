"use strict";
// Simulation Clock managing playback speed, scrubbing, and real-time synchronization
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulationClock = void 0;
class SimulationClock {
    currentTimeMs;
    speed = 1;
    isLiveMode = true;
    listeners = new Set();
    constructor(initialDate = new Date()) {
        this.currentTimeMs = initialDate.getTime();
    }
    getTime() {
        return new Date(this.currentTimeMs);
    }
    getTimeMs() {
        return this.currentTimeMs;
    }
    getSpeed() {
        return this.speed;
    }
    isLive() {
        return this.isLiveMode;
    }
    setTime(date) {
        this.currentTimeMs = date.getTime();
        this.isLiveMode = false;
        this.notify();
    }
    setSpeed(speed) {
        this.speed = speed;
        if (speed !== 1) {
            this.isLiveMode = false;
        }
        this.notify();
    }
    setLive(live = true) {
        this.isLiveMode = live;
        if (live) {
            this.currentTimeMs = Date.now();
            this.speed = 1;
        }
        this.notify();
    }
    tick(realDeltaSeconds) {
        if (this.isLiveMode) {
            this.currentTimeMs = Date.now();
        }
        else if (this.speed !== 0) {
            this.currentTimeMs += realDeltaSeconds * 1000 * this.speed;
        }
        this.notify();
        return this.getTime();
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getTime(), this.speed, this.isLiveMode);
        return () => this.listeners.delete(listener);
    }
    notify() {
        const d = this.getTime();
        for (const listener of this.listeners) {
            listener(d, this.speed, this.isLiveMode);
        }
    }
}
exports.SimulationClock = SimulationClock;
