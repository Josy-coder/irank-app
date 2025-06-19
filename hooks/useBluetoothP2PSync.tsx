"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { SimpleOfflineManager } from '@/hooks/useOffline';

interface BluetoothDeviceInfo {
  id: string;
  name: string;
  device: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
  service?: BluetoothRemoteGATTService;
  characteristic?: BluetoothRemoteGATTCharacteristic;
  connected: boolean;
  lastSeen: Date;
}

interface SyncPacket {
  id: string;
  type: 'handshake' | 'inventory' | 'request' | 'data' | 'chunk' | 'ack' | 'complete' | 'error';
  sequenceId: number;
  totalChunks?: number;
  chunkIndex?: number;
  payload: any;
  timestamp: number;
  checksum: string;
}

interface SyncItem {
  key: string;
  type: 'cache' | 'user_data' | 'tournament_data' | 'settings';
  data: any;
  timestamp: number;
  version: number;
  size: number;
  checksum: string;
}

interface P2PSyncState {
  isSupported: boolean;
  isScanning: boolean;
  isAdvertising: boolean;
  devices: BluetoothDeviceInfo[];
  activeSyncs: Map<string, SyncSession>;
  transferProgress: Map<string, number>;
}

interface SyncSession {
  deviceId: string;
  status: 'connecting' | 'handshake' | 'inventory' | 'transferring' | 'complete' | 'error';
  startTime: Date;
  totalItems: number;
  completedItems: number;
  errors: string[];
}

class BluetoothP2PSync {
  private static instance: BluetoothP2PSync | null = null;

  private readonly SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly TX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly RX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

  private readonly MAX_PAYLOAD_SIZE = 185;
  private readonly MAX_RETRIES = 3;
  private readonly TIMEOUT_MS = 30000;

  private state: P2PSyncState = {
    isSupported: false,
    isScanning: false,
    isAdvertising: false,
    devices: [],
    activeSyncs: new Map(),
    transferProgress: new Map()
  };

  private listeners: Set<(event: P2PSyncEvent) => void> = new Set();
  private offlineManager: SimpleOfflineManager;
  private messageQueue: Map<string, SyncPacket[]> = new Map();
  private sequenceCounters: Map<string, number> = new Map();

  constructor() {
    this.offlineManager = SimpleOfflineManager.getInstance();
    this.checkBluetoothSupport();
  }

  static getInstance(): BluetoothP2PSync {
    if (!BluetoothP2PSync.instance) {
      BluetoothP2PSync.instance = new BluetoothP2PSync();
    }
    return BluetoothP2PSync.instance;
  }

  private checkBluetoothSupport(): void {
    if (typeof window === 'undefined') {
      this.state.isSupported = false;
      return;
    }

    this.state.isSupported = 'bluetooth' in navigator &&
      'requestDevice' in navigator.bluetooth &&
      window.isSecureContext;

    if (!this.state.isSupported) {
      console.error('[BluetoothP2P] Requirements not met:', {
        hasNavigatorBluetooth: 'bluetooth' in navigator,
        hasRequestDevice: 'bluetooth' in navigator && 'requestDevice' in navigator.bluetooth,
        isSecureContext: window.isSecureContext
      });
    }
  }

  async scanForDevices(): Promise<BluetoothDeviceInfo[]> {
    if (!this.state.isSupported) {
      throw new Error('Bluetooth not supported. Requires HTTPS and modern browser.');
    }

    try {
      this.state.isScanning = true;
      this.notifyListeners({ type: 'scan_started', data: null });

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [this.SERVICE_UUID] },
          { namePrefix: 'iRank' }
        ],
        optionalServices: [this.SERVICE_UUID]
      });

      if (!device) {
        throw new Error('No device selected');
      }

      const deviceInfo: BluetoothDeviceInfo = {
        id: device.id,
        name: device.name || 'Unknown Device',
        device: device,
        connected: false,
        lastSeen: new Date()
      };

      device.addEventListener('gattserverdisconnected', () => {
        this.handleDeviceDisconnected(deviceInfo.id);
      });

      const existingIndex = this.state.devices.findIndex(d => d.id === device.id);
      if (existingIndex >= 0) {
        this.state.devices[existingIndex] = deviceInfo;
      } else {
        this.state.devices.push(deviceInfo);
      }

      this.notifyListeners({
        type: 'device_discovered',
        data: { device: deviceInfo }
      });

      return this.state.devices;

    } catch (error: any) {
      console.error('[BluetoothP2P] Scan failed:', error);

      if (error.name === 'NotFoundError') {
        throw new Error('No compatible devices found. Make sure the other device is advertising.');
      } else if (error.name === 'SecurityError') {
        throw new Error('Bluetooth access denied. Please allow Bluetooth permissions.');
      } else {
        throw new Error(`Scan failed: ${error.message}`);
      }
    } finally {
      this.state.isScanning = false;
      this.notifyListeners({ type: 'scan_stopped', data: null });
    }
  }

  async connectToDevice(deviceId: string): Promise<boolean> {
    const deviceInfo = this.state.devices.find(d => d.id === deviceId);
    if (!deviceInfo) {
      throw new Error('Device not found');
    }

    try {
      this.notifyListeners({
        type: 'connecting',
        data: { deviceId, deviceName: deviceInfo.name }
      });

      console.log('[BluetoothP2P] Connecting to GATT server...');
      const server = await deviceInfo.device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }

      deviceInfo.server = server;
      console.log('[BluetoothP2P] Connected to GATT server');

      console.log('[BluetoothP2P] Getting primary service...');
      const service = await server.getPrimaryService(this.SERVICE_UUID);
      deviceInfo.service = service;
      console.log('[BluetoothP2P] Got primary service');

      console.log('[BluetoothP2P] Getting characteristics...');
      const rxCharacteristic = await service.getCharacteristic(this.RX_CHARACTERISTIC_UUID);
      deviceInfo.characteristic = rxCharacteristic;

      await rxCharacteristic.startNotifications();
      rxCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        this.handleIncomingData(deviceId, event);
      });

      deviceInfo.connected = true;
      deviceInfo.lastSeen = new Date();

      this.notifyListeners({
        type: 'device_connected',
        data: { deviceId, deviceName: deviceInfo.name }
      });

      await this.initiateHandshake(deviceId);

      return true;

    } catch (error: any) {
      console.error('[BluetoothP2P] Connection failed:', error);
      deviceInfo.connected = false;

      this.notifyListeners({
        type: 'connection_failed',
        data: { deviceId, error: error.message }
      });

      return false;
    }
  }

  private async initiateHandshake(deviceId: string): Promise<void> {
    const handshakePacket: SyncPacket = {
      id: this.generatePacketId(),
      type: 'handshake',
      sequenceId: this.getNextSequence(deviceId),
      payload: {
        deviceName: 'iRank Device',
        version: '1.0.0',
        capabilities: ['cache_sync', 'user_data_sync', 'tournament_sync'],
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      checksum: ''
    };

    handshakePacket.checksum = this.calculateChecksum(handshakePacket);

    await this.sendPacket(deviceId, handshakePacket);

    this.state.activeSyncs.set(deviceId, {
      deviceId,
      status: 'handshake',
      startTime: new Date(),
      totalItems: 0,
      completedItems: 0,
      errors: []
    });
  }

  private async sendPacket(deviceId: string, packet: SyncPacket): Promise<void> {
    const deviceInfo = this.state.devices.find(d => d.id === deviceId);
    if (!deviceInfo?.connected || !deviceInfo.service) {
      throw new Error('Device not connected');
    }

    try {

      const txCharacteristic = await deviceInfo.service.getCharacteristic(this.TX_CHARACTERISTIC_UUID);

      const packetStr = JSON.stringify(packet);
      const encoder = new TextEncoder();
      const data = encoder.encode(packetStr);

      if (data.length > this.MAX_PAYLOAD_SIZE) {
        await this.sendLargePacket(txCharacteristic, packet, data);
      } else {
        await txCharacteristic.writeValue(data);
      }

      console.log('[BluetoothP2P] Sent packet:', packet.type, packet.id);

    } catch (error: any) {
      console.error('[BluetoothP2P] Failed to send packet:', error);
      throw new Error(`Send failed: ${error.message}`);
    }
  }

  private async sendLargePacket(
    characteristic: BluetoothRemoteGATTCharacteristic,
    packet: SyncPacket,
    data: Uint8Array
  ): Promise<void> {
    const chunks = Math.ceil(data.length / this.MAX_PAYLOAD_SIZE);

    for (let i = 0; i < chunks; i++) {
      const start = i * this.MAX_PAYLOAD_SIZE;
      const end = Math.min(start + this.MAX_PAYLOAD_SIZE, data.length);
      const chunk = data.slice(start, end);

      const chunkPacket: SyncPacket = {
        ...packet,
        type: 'chunk',
        chunkIndex: i,
        totalChunks: chunks,
        payload: Array.from(chunk)
      };

      const chunkStr = JSON.stringify(chunkPacket);
      const chunkData = new TextEncoder().encode(chunkStr);

      await characteristic.writeValue(chunkData);

      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private handleIncomingData(deviceId: string, event: Event): void {
    try {
      const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
      const value = characteristic.value;

      if (!value) return;

      const decoder = new TextDecoder();
      const packetStr = decoder.decode(value);
      const packet: SyncPacket = JSON.parse(packetStr);

      console.log('[BluetoothP2P] Received packet:', packet.type, packet.id);

      const receivedChecksum = packet.checksum;
      packet.checksum = '';
      const calculatedChecksum = this.calculateChecksum(packet);

      if (receivedChecksum !== calculatedChecksum) {
        console.error('[BluetoothP2P] Checksum mismatch');
        return;
      }

      switch (packet.type) {
        case 'handshake':
          this.handleHandshake(deviceId, packet);
          break;
        case 'inventory':
          this.handleInventory(deviceId, packet);
          break;
        case 'request':
          this.handleDataRequest(deviceId, packet);
          break;
        case 'data':
          this.handleDataPacket(deviceId, packet);
          break;
        case 'chunk':
          this.handleChunkPacket(deviceId, packet);
          break;
        case 'ack':
          this.handleAck(deviceId, packet);
          break;
        default:
          console.warn('[BluetoothP2P] Unknown packet type:', packet.type);
      }

    } catch (error) {
      console.error('[BluetoothP2P] Failed to handle incoming data:', error);
    }
  }

  private async handleHandshake(deviceId: string, packet: SyncPacket): Promise<void> {
    const session = this.state.activeSyncs.get(deviceId);
    if (!session) return;

    session.status = 'inventory';

    this.notifyListeners({
      type: 'handshake_complete',
      data: { deviceId, peerInfo: packet.payload }
    });

    await this.sendInventory(deviceId);
  }

  private async sendInventory(deviceId: string): Promise<void> {
    try {

      const items = await this.getAvailableSyncItems();

      const inventoryPacket: SyncPacket = {
        id: this.generatePacketId(),
        type: 'inventory',
        sequenceId: this.getNextSequence(deviceId),
        payload: {
          items: items.map(item => ({
            key: item.key,
            type: item.type,
            timestamp: item.timestamp,
            version: item.version,
            size: item.size,
            checksum: item.checksum
          }))
        },
        timestamp: Date.now(),
        checksum: ''
      };

      inventoryPacket.checksum = this.calculateChecksum(inventoryPacket);
      await this.sendPacket(deviceId, inventoryPacket);

    } catch (error) {
      console.error('[BluetoothP2P] Failed to send inventory:', error);
    }
  }

  private async getAvailableSyncItems(): Promise<SyncItem[]> {

    const items: SyncItem[] = [];

    try {



      const tournamentData = await this.offlineManager.getFromCache('recent_tournaments');
      if (tournamentData) {
        items.push({
          key: 'recent_tournaments',
          type: 'tournament_data',
          data: tournamentData,
          timestamp: Date.now(),
          version: 1,
          size: JSON.stringify(tournamentData).length,
          checksum: this.calculateDataChecksum(tournamentData)
        });
      }

      const userData = await this.offlineManager.getFromCache('user_profile');
      if (userData) {
        items.push({
          key: 'user_profile',
          type: 'user_data',
          data: userData,
          timestamp: Date.now(),
          version: 1,
          size: JSON.stringify(userData).length,
          checksum: this.calculateDataChecksum(userData)
        });
      }


    } catch (error) {
      console.error('[BluetoothP2P] Failed to get sync items:', error);
    }

    return items;
  }

  private async handleDataRequest(deviceId: string, packet: SyncPacket): Promise<void> {
    const requestedKeys = packet.payload.keys;
    const items = await this.getAvailableSyncItems();

    for (const key of requestedKeys) {
      const item = items.find(i => i.key === key);
      if (item) {
        await this.sendDataPacket(deviceId, item);
      }
    }
  }

  private async sendDataPacket(deviceId: string, item: SyncItem): Promise<void> {
    const dataPacket: SyncPacket = {
      id: this.generatePacketId(),
      type: 'data',
      sequenceId: this.getNextSequence(deviceId),
      payload: {
        key: item.key,
        type: item.type,
        data: item.data,
        timestamp: item.timestamp,
        version: item.version
      },
      timestamp: Date.now(),
      checksum: ''
    };

    dataPacket.checksum = this.calculateChecksum(dataPacket);
    await this.sendPacket(deviceId, dataPacket);
  }

  private async handleDataPacket(deviceId: string, packet: SyncPacket): Promise<void> {
    try {
      const { key, type, data, timestamp, version } = packet.payload;

      await this.offlineManager.saveToCache(key, data);

      this.notifyListeners({
        type: 'data_received',
        data: { deviceId, key, type, size: JSON.stringify(data).length }
      });

      const ackPacket: SyncPacket = {
        id: this.generatePacketId(),
        type: 'ack',
        sequenceId: this.getNextSequence(deviceId),
        payload: { originalId: packet.id, status: 'success' },
        timestamp: Date.now(),
        checksum: ''
      };

      ackPacket.checksum = this.calculateChecksum(ackPacket);
      await this.sendPacket(deviceId, ackPacket);

    } catch (error) {
      console.error('[BluetoothP2P] Failed to handle data packet:', error);

      const errorAck: SyncPacket = {
        id: this.generatePacketId(),
        type: 'ack',
        sequenceId: this.getNextSequence(deviceId),
        payload: { originalId: packet.id, status: 'error', error: (error as Error).message },
        timestamp: Date.now(),
        checksum: ''
      };

      errorAck.checksum = this.calculateChecksum(errorAck);
      await this.sendPacket(deviceId, errorAck);
    }
  }

  private generatePacketId(): string {
    return `pkt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private getNextSequence(deviceId: string): number {
    const current = this.sequenceCounters.get(deviceId) || 0;
    const next = current + 1;
    this.sequenceCounters.set(deviceId, next);
    return next;
  }

  private calculateChecksum(packet: SyncPacket): string {
    const str = JSON.stringify(packet);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private calculateDataChecksum(data: any): string {
    return this.calculateChecksum({ payload: data } as SyncPacket);
  }

  private handleDeviceDisconnected(deviceId: string): void {
    const deviceInfo = this.state.devices.find(d => d.id === deviceId);
    if (deviceInfo) {
      deviceInfo.connected = false;
    }

    this.state.activeSyncs.delete(deviceId);
    this.state.transferProgress.delete(deviceId);

    this.notifyListeners({
      type: 'device_disconnected',
      data: { deviceId }
    });
  }

  getState(): P2PSyncState {
    return { ...this.state };
  }

  subscribe(listener: (event: P2PSyncEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: P2PSyncEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  async disconnect(deviceId: string): Promise<void> {
    const deviceInfo = this.state.devices.find(d => d.id === deviceId);
    if (deviceInfo?.server) {
      deviceInfo.server.disconnect();
    }
  }

  async disconnectAll(): Promise<void> {
    for (const device of this.state.devices) {
      if (device.connected && device.server) {
        device.server.disconnect();
      }
    }
  }

  private async handleInventory(deviceId: string, packet: SyncPacket): Promise<void> {

  }

  private async handleChunkPacket(deviceId: string, packet: SyncPacket): Promise<void> {

  }

  private async handleAck(deviceId: string, packet: SyncPacket): Promise<void> {

  }
}

interface P2PSyncEvent {
  type: 'scan_started' | 'scan_stopped' | 'device_discovered' | 'connecting' |
    'device_connected' | 'connection_failed' | 'device_disconnected' |
    'handshake_complete' | 'sync_started' | 'sync_progress' | 'sync_complete' |
    'data_received' | 'error';
  data: any;
}

export function useBluetoothP2PSync() {
  const [state, setState] = useState<P2PSyncState>({
    isSupported: false,
    isScanning: false,
    isAdvertising: false,
    devices: [],
    activeSyncs: new Map(),
    transferProgress: new Map()
  });

  const syncRef = useRef<BluetoothP2PSync>();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      syncRef.current = BluetoothP2PSync.getInstance();

      const unsubscribe = syncRef.current.subscribe((event) => {
        setState(syncRef.current!.getState());
      });

      setState(syncRef.current.getState());

      return unsubscribe;
    }
  }, []);

  const scanForDevices = useCallback(async () => {
    if (syncRef.current) {
      return await syncRef.current.scanForDevices();
    }
    return [];
  }, []);

  const connectToDevice = useCallback(async (deviceId: string) => {
    if (syncRef.current) {
      return await syncRef.current.connectToDevice(deviceId);
    }
    return false;
  }, []);

  const disconnect = useCallback(async (deviceId: string) => {
    if (syncRef.current) {
      await syncRef.current.disconnect(deviceId);
    }
  }, []);

  const disconnectAll = useCallback(async () => {
    if (syncRef.current) {
      await syncRef.current.disconnectAll();
    }
  }, []);

  return {
    ...state,
    scanForDevices,
    connectToDevice,
    disconnect,
    disconnectAll
  };
}

export { BluetoothP2PSync };