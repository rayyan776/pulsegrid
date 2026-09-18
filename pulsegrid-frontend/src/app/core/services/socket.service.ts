import { Injectable, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { APP_CONFIG } from '../tokens/app-config.token';

export interface DeviceUpdate {
  deviceId: string;
  cpu: number;
  memory: number;
  latency: number;
  timestamp: number;
  rollingAvgCpu?: number;
  alert?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly config = inject(APP_CONFIG);
  private socket: Socket | null = null;

  // Keyed by deviceId — every device's most recent update survives here,
  // even though all 5 simulated devices publish within the same ~2s tick
  // and would otherwise stomp on a single shared "latest" value.
  readonly updatesByDevice = signal<ReadonlyMap<string, DeviceUpdate>>(new Map());
  readonly connected = signal(false);

  connect(): void {
    if (this.socket) return;
    this.socket = io(this.config.socketUrl);

    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.on('deviceUpdate', (payload: DeviceUpdate) => {
      // A new Map instance every time — signals compare by reference, so
      // mutating the existing Map in place would never notify subscribers.
      this.updatesByDevice.update((prev) => {
        const next = new Map(prev);
        next.set(payload.deviceId, payload);
        return next;
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}