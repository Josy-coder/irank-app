"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { SimpleOfflineManager } from '@/hooks/use-offline';

interface WebRTCDeviceInfo {
  id: string;
  name: string;
  status: 'discovered' | 'connecting' | 'connected' | 'disconnected';
  lastSeen: Date;
}

interface SyncItem {
  key: string;
  type: 'cache' | 'user_data' | 'tournament_data' | 'settings';
  data: any;
  timestamp: number;
  version: number;
  size: number;
  selected: boolean;
}

interface P2PSyncState {
  isSupported: boolean;
  isGeneratingQR: boolean;
  isScanning: boolean;
  devices: WebRTCDeviceInfo[];
  activeSyncs: Map<string, SyncSession>;
  transferProgress: Map<string, number>;
  currentOffer: string | null;
  currentAnswer: string | null;
  qrStep: 'idle' | 'showing_offer' | 'waiting_answer' | 'scanning_answer' | 'connected';
  selectedItemsForSync: SyncItem[];
  pendingSessionId: string | null;
}

interface SyncSession {
  deviceId: string;
  status: 'connecting' | 'handshake' | 'transferring' | 'complete' | 'error';
  startTime: Date;
  totalItems: number;
  completedItems: number;
  errors: string[];
  connection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

interface SyncPacket {
  type: 'sync_start' | 'sync_data' | 'sync_complete' | 'sync_error';
  payload: any;
  timestamp: number;
}

class WebRTCP2PSync {
  private static instance: WebRTCP2PSync | null = null;

  private state: P2PSyncState = {
    isSupported: false,
    isGeneratingQR: false,
    isScanning: false,
    devices: [],
    activeSyncs: new Map(),
    transferProgress: new Map(),
    currentOffer: null,
    currentAnswer: null,
    qrStep: 'idle',
    selectedItemsForSync: [],
    pendingSessionId: null
  };

  private listeners: Set<(event: P2PSyncEvent) => void> = new Set();
  private offlineManager: SimpleOfflineManager;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();

  constructor() {
    this.offlineManager = SimpleOfflineManager.getInstance();
    this.checkWebRTCSupport();
  }

  static getInstance(): WebRTCP2PSync {
    if (!WebRTCP2PSync.instance) {
      WebRTCP2PSync.instance = new WebRTCP2PSync();
    }
    return WebRTCP2PSync.instance;
  }

  private checkWebRTCSupport(): void {
    if (typeof window === 'undefined') {
      this.state.isSupported = false;
      return;
    }

    this.state.isSupported = 'RTCPeerConnection' in window &&
      'getUserMedia' in navigator.mediaDevices &&
      window.isSecureContext;

    console.log('[WebRTCP2P] Support check:', {
      hasRTCPeerConnection: 'RTCPeerConnection' in window,
      hasGetUserMedia: 'getUserMedia' in navigator.mediaDevices,
      isSecureContext: window.isSecureContext,
      isSupported: this.state.isSupported
    });

    if (!this.state.isSupported) {
      console.error('[WebRTCP2P] Requirements not met:', {
        hasRTCPeerConnection: 'RTCPeerConnection' in window,
        hasGetUserMedia: 'getUserMedia' in navigator.mediaDevices,
        isSecureContext: window.isSecureContext
      });
    }
  }

  async createOffer(selectedItems: SyncItem[]): Promise<string> {
    console.log('[WebRTCP2P] Creating offer with items:', selectedItems.length);

    if (!this.state.isSupported) {
      const error = 'WebRTC not supported. Requires HTTPS and modern browser.';
      console.error('[WebRTCP2P]', error);
      throw new Error(error);
    }

    try {
      console.log('[WebRTCP2P] Setting generating state...');
      this.state.isGeneratingQR = true;
      this.state.qrStep = 'showing_offer';
      this.state.selectedItemsForSync = selectedItems;
      this.notifyListeners({ type: 'offer_generating', data: null });

      const sessionId = this.generateSessionId();
      console.log('[WebRTCP2P] Generated session ID:', sessionId);
      this.state.pendingSessionId = sessionId;

      console.log('[WebRTCP2P] Creating peer connection...');
      const peerConnection = new RTCPeerConnection({
        iceServers: []
      });

      peerConnection.addEventListener('error', (event) => {
        console.error('[WebRTCP2P] Peer connection error:', event);
      });

      peerConnection.oniceconnectionstatechange = () => {
        console.log('[WebRTCP2P] ICE connection state:', peerConnection.iceConnectionState);
      };

      console.log('[WebRTCP2P] Creating data channel...');
      const dataChannel = peerConnection.createDataChannel('sync', {
        ordered: true
      });

      this.setupDataChannel(sessionId, dataChannel);

      this.peerConnections.set(sessionId, peerConnection);
      this.dataChannels.set(sessionId, dataChannel);

      console.log('[WebRTCP2P] Creating offer...');
      const offer = await peerConnection.createOffer();
      console.log('[WebRTCP2P] Offer created:', offer);

      await peerConnection.setLocalDescription(offer);
      console.log('[WebRTCP2P] Local description set');

      console.log('[WebRTCP2P] Waiting for ICE gathering...');
      await this.waitForICEGathering(peerConnection);
      console.log('[WebRTCP2P] ICE gathering complete');

      const offerString = JSON.stringify({
        sessionId,
        offer: peerConnection.localDescription,
        timestamp: Date.now(),
        itemCount: selectedItems.length
      });

      console.log('[WebRTCP2P] Offer string length:', offerString.length);
      this.state.currentOffer = offerString;

      console.log('[WebRTCP2P] Notifying listeners of offer creation...');
      this.notifyListeners({
        type: 'offer_created',
        data: { offer: offerString, sessionId }
      });

      console.log('[WebRTCP2P] Offer creation complete');
      return offerString;

    } catch (error: any) {
      console.error('[WebRTCP2P] Failed to create offer:', error);
      console.error('[WebRTCP2P] Error stack:', error.stack);

      this.state.qrStep = 'idle';
      this.state.selectedItemsForSync = [];
      this.state.pendingSessionId = null;
      this.state.isGeneratingQR = false;

      this.notifyListeners({ type: 'sync_error', data: { error: error.message } });

      throw new Error(`Failed to create offer: ${error.message}`);
    } finally {
      console.log('[WebRTCP2P] Resetting isGeneratingQR flag');
      this.state.isGeneratingQR = false;

      this.notifyListeners({ type: 'offer_generating', data: null });
    }
  }

  async processAnswer(answerString: string): Promise<boolean> {
    console.log('[WebRTCP2P] Processing answer...');

    try {
      const answerData = JSON.parse(answerString);
      const { sessionId, answer } = answerData;

      console.log('[WebRTCP2P] Answer for session:', sessionId);

      const peerConnection = this.peerConnections.get(sessionId);
      if (!peerConnection) {
        throw new Error('No matching session found');
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTCP2P] Remote description set');

      this.state.qrStep = 'connected';
      this.notifyListeners({
        type: 'connection_established',
        data: { sessionId }
      });

      if (this.state.selectedItemsForSync.length > 0) {
        console.log('[WebRTCP2P] Scheduling data send...');

        setTimeout(() => {
          this.sendData(sessionId, this.state.selectedItemsForSync);
        }, 1000);
      }

      return true;

    } catch (error: any) {
      console.error('[WebRTCP2P] Failed to process answer:', error);
      this.state.qrStep = 'idle';
      this.notifyListeners({ type: 'sync_error', data: { error: error.message } });
      throw new Error(`Failed to process answer: ${error.message}`);
    }
  }

  async createAnswer(offerString: string): Promise<string> {
    console.log('[WebRTCP2P] Creating answer...');

    try {
      const offerData = JSON.parse(offerString);
      const { sessionId, offer, itemCount } = offerData;

      console.log('[WebRTCP2P] Creating answer for session:', sessionId);

      const peerConnection = new RTCPeerConnection({
        iceServers: []
      });

      peerConnection.ondatachannel = (event) => {
        console.log('[WebRTCP2P] Received data channel');
        const dataChannel = event.channel;
        this.setupDataChannel(sessionId, dataChannel);
        this.dataChannels.set(sessionId, dataChannel);
      };

      this.peerConnections.set(sessionId, peerConnection);

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await this.waitForICEGathering(peerConnection);

      const answerString = JSON.stringify({
        sessionId,
        answer: peerConnection.localDescription,
        timestamp: Date.now()
      });

      this.state.currentAnswer = answerString;

      this.state.activeSyncs.set(sessionId, {
        deviceId: sessionId,
        status: 'connecting',
        startTime: new Date(),
        totalItems: itemCount || 0,
        completedItems: 0,
        errors: []
      });

      this.notifyListeners({
        type: 'answer_created',
        data: { answer: answerString, sessionId }
      });

      console.log('[WebRTCP2P] Answer created successfully');
      return answerString;

    } catch (error: any) {
      console.error('[WebRTCP2P] Failed to create answer:', error);
      throw new Error(`Failed to create answer: ${error.message}`);
    }
  }

  private async waitForICEGathering(peerConnection: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (peerConnection.iceGatheringState === 'complete') {
        console.log('[WebRTCP2P] ICE gathering already complete');
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        console.log('[WebRTCP2P] ICE gathering timeout, proceeding anyway');
        resolve();
      }, 5000);

      peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log('[WebRTCP2P] ICE gathering state changed to:', peerConnection.iceGatheringState);
        if (peerConnection.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      });

      peerConnection.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          console.log('[WebRTCP2P] ICE candidate generated:', event.candidate.type);
        } else {
          console.log('[WebRTCP2P] ICE candidate generation complete');
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }

  private setupDataChannel(sessionId: string, dataChannel: RTCDataChannel): void {
    console.log('[WebRTCP2P] Setting up data channel for session:', sessionId);

    dataChannel.onopen = () => {
      console.log('[WebRTCP2P] Data channel opened:', sessionId);
      this.notifyListeners({
        type: 'data_channel_open',
        data: { sessionId }
      });
    };

    dataChannel.onmessage = (event) => {
      console.log('[WebRTCP2P] Data channel message received:', sessionId);
      this.handleIncomingMessage(sessionId, event.data);
    };

    dataChannel.onclose = () => {
      console.log('[WebRTCP2P] Data channel closed:', sessionId);
      this.cleanup(sessionId);
    };

    dataChannel.onerror = (error) => {
      console.error('[WebRTCP2P] Data channel error:', error);
      this.notifyListeners({
        type: 'sync_error',
        data: { sessionId, error: 'Data channel error' }
      });
    };
  }

  private handleIncomingMessage(sessionId: string, data: string): void {
    try {
      const packet: SyncPacket = JSON.parse(data);

      switch (packet.type) {
        case 'sync_data':
          this.handleSyncData(sessionId, packet.payload);
          break;
        case 'sync_complete':
          this.handleSyncComplete(sessionId);
          break;
        case 'sync_error':
          this.handleSyncError(sessionId, packet.payload.error);
          break;
      }
    } catch (error) {
      console.error('[WebRTCP2P] Failed to handle incoming message:', error);
    }
  }

  private async handleSyncData(sessionId: string, data: any): Promise<void> {
    try {
      const { key, payload } = data;
      await this.offlineManager.saveToCache(key, payload);

      const session = this.state.activeSyncs.get(sessionId);
      if (session) {
        session.completedItems += 1;
        session.status = 'transferring';

        const progress = session.totalItems > 0 ? (session.completedItems / session.totalItems) * 100 : 0;
        this.state.transferProgress.set(sessionId, progress);
      }

      this.notifyListeners({
        type: 'data_received',
        data: { sessionId, key, size: JSON.stringify(payload).length }
      });
    } catch (error) {
      console.error('[WebRTCP2P] Failed to handle sync data:', error);
    }
  }

  private handleSyncComplete(sessionId: string): void {
    const session = this.state.activeSyncs.get(sessionId);
    if (session) {
      session.status = 'complete';
      this.state.transferProgress.set(sessionId, 100);
      this.notifyListeners({
        type: 'sync_complete',
        data: { sessionId }
      });
    }
  }

  private handleSyncError(sessionId: string, error: string): void {
    const session = this.state.activeSyncs.get(sessionId);
    if (session) {
      session.status = 'error';
      session.errors.push(error);
      this.notifyListeners({
        type: 'sync_error',
        data: { sessionId, error }
      });
    }
  }

  async sendData(sessionId: string, items: SyncItem[]): Promise<void> {
    const dataChannel = this.dataChannels.get(sessionId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    try {

      this.state.activeSyncs.set(sessionId, {
        deviceId: sessionId,
        status: 'transferring',
        startTime: new Date(),
        totalItems: items.length,
        completedItems: 0,
        errors: []
      });

      this.notifyListeners({
        type: 'sync_started',
        data: { sessionId, totalItems: items.length }
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        const packet: SyncPacket = {
          type: 'sync_data',
          payload: {
            key: item.key,
            payload: item.data
          },
          timestamp: Date.now()
        };

        dataChannel.send(JSON.stringify(packet));

        const session = this.state.activeSyncs.get(sessionId)!;
        session.completedItems = i + 1;

        const progress = (session.completedItems / session.totalItems) * 100;
        this.state.transferProgress.set(sessionId, progress);

        this.notifyListeners({
          type: 'sync_progress',
          data: {
            sessionId,
            completed: session.completedItems,
            total: session.totalItems,
            progress
          }
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const completePacket: SyncPacket = {
        type: 'sync_complete',
        payload: {},
        timestamp: Date.now()
      };

      dataChannel.send(JSON.stringify(completePacket));

      this.handleSyncComplete(sessionId);

    } catch (error: any) {
      console.error('[WebRTCP2P] Failed to send data:', error);
      const errorPacket: SyncPacket = {
        type: 'sync_error',
        payload: { error: error.message },
        timestamp: Date.now()
      };

      if (dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(errorPacket));
      }

      this.handleSyncError(sessionId, error.message);
    }
  }

  async getAvailableSyncItems(): Promise<SyncItem[]> {
    const items: SyncItem[] = [];

    try {

      if (typeof window === 'undefined') {
        return items;
      }

      const request = indexedDB.open('irank-offline-cache', 1);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['cache'], 'readonly');
          const store = transaction.objectStore('cache');
          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            const dbItems = getAllRequest.result.map((item: any) => ({
              key: item.key,
              type: 'cache' as const,
              data: item.data,
              timestamp: item.timestamp,
              version: 1,
              size: JSON.stringify(item.data).length,
              selected: true
            }));
            resolve(dbItems);
          };

          getAllRequest.onerror = () => resolve([]);
        };

        request.onerror = () => resolve([]);
      });

    } catch (error) {
      console.error('[WebRTCP2P] Failed to get sync items:', error);
      return items;
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private cleanup(sessionId: string): void {
    console.log('[WebRTCP2P] Cleaning up session:', sessionId);

    const peerConnection = this.peerConnections.get(sessionId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(sessionId);
    }

    this.dataChannels.delete(sessionId);
    this.state.activeSyncs.delete(sessionId);
    this.state.transferProgress.delete(sessionId);

    if (this.state.qrStep !== 'idle') {
      this.state.qrStep = 'idle';
    }

    this.state.selectedItemsForSync = [];
    this.state.pendingSessionId = null;
    this.state.isGeneratingQR = false;

    this.notifyListeners({
      type: 'session_cleanup',
      data: { sessionId }
    });
  }

  disconnect(sessionId: string): void {
    this.cleanup(sessionId);
  }

  disconnectAll(): void {
    const sessionIds = Array.from(this.peerConnections.keys());
    sessionIds.forEach(sessionId => this.cleanup(sessionId));
  }

  resetQRState(): void {
    console.log('[WebRTCP2P] Resetting QR state');
    this.state.qrStep = 'idle';
    this.state.currentOffer = null;
    this.state.currentAnswer = null;
    this.state.selectedItemsForSync = [];
    this.state.pendingSessionId = null;
    this.state.isGeneratingQR = false;
    this.notifyListeners({ type: 'session_cleanup', data: {} });
  }

  getState(): P2PSyncState {
    return { ...this.state };
  }

  subscribe(listener: (event: P2PSyncEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: P2PSyncEvent): void {
    console.log('[WebRTCP2P] Notifying listeners of event:', event.type);
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[WebRTCP2P] Error in event listener:', error);
      }
    });
  }
}

interface P2PSyncEvent {
  type: 'offer_generating' | 'offer_created' | 'answer_created' | 'connection_established' |
    'data_channel_open' | 'sync_started' | 'sync_progress' | 'sync_complete' |
    'data_received' | 'sync_error' | 'session_cleanup';
  data: any;
}

export function useWebRTCP2PSync() {
  const [state, setState] = useState<P2PSyncState>({
    isSupported: false,
    isGeneratingQR: false,
    isScanning: false,
    devices: [],
    activeSyncs: new Map(),
    transferProgress: new Map(),
    currentOffer: null,
    currentAnswer: null,
    qrStep: 'idle',
    selectedItemsForSync: [],
    pendingSessionId: null
  });

  const syncRef = useRef<WebRTCP2PSync>();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[useWebRTCP2PSync] Initializing...');
      syncRef.current = WebRTCP2PSync.getInstance();

      const unsubscribe = syncRef.current.subscribe((event) => {
        console.log('[useWebRTCP2PSync] Event received:', event.type);
        setState(syncRef.current!.getState());
      });

      setState(syncRef.current.getState());

      return unsubscribe;
    }
  }, []);

  const createOffer = useCallback(async (selectedItems: SyncItem[]) => {
    console.log('[useWebRTCP2PSync] createOffer called with items:', selectedItems.length);
    if (syncRef.current) {
      return await syncRef.current.createOffer(selectedItems);
    }
    return '';
  }, []);

  const createAnswer = useCallback(async (offer: string) => {
    console.log('[useWebRTCP2PSync] createAnswer called');
    if (syncRef.current) {
      return await syncRef.current.createAnswer(offer);
    }
    return '';
  }, []);

  const processAnswer = useCallback(async (answer: string) => {
    console.log('[useWebRTCP2PSync] processAnswer called');
    if (syncRef.current) {
      return await syncRef.current.processAnswer(answer);
    }
    return false;
  }, []);

  const sendData = useCallback(async (sessionId: string, items: SyncItem[]) => {
    if (syncRef.current) {
      await syncRef.current.sendData(sessionId, items);
    }
  }, []);

  const getAvailableSyncItems = useCallback(async () => {
    if (syncRef.current) {
      return await syncRef.current.getAvailableSyncItems();
    }
    return [];
  }, []);

  const disconnect = useCallback((sessionId: string) => {
    if (syncRef.current) {
      syncRef.current.disconnect(sessionId);
    }
  }, []);

  const disconnectAll = useCallback(() => {
    if (syncRef.current) {
      syncRef.current.disconnectAll();
    }
  }, []);

  const resetQRState = useCallback(() => {
    console.log('[useWebRTCP2PSync] resetQRState called');
    if (syncRef.current) {
      syncRef.current.resetQRState();
    }
  }, []);

  return {
    ...state,
    createOffer,
    createAnswer,
    processAnswer,
    sendData,
    getAvailableSyncItems,
    disconnect,
    disconnectAll,
    resetQRState
  };
}

export { WebRTCP2PSync };