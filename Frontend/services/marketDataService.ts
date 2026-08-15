/**
 * Real-time market data polling service
 */

export interface MarketDataListener {
  onUpdate: (data: any) => void;
  onError?: (error: string) => void;
}

export class MarketDataService {
  private pollInterval = 5000; // 5 seconds
  private pollTimerId: ReturnType<typeof setInterval> | null = null;
  private listeners: MarketDataListener[] = [];
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  subscribe(listener: MarketDataListener): () => void {
    this.listeners.push(listener);
    if (!this.pollTimerId) {
      this.startPolling();
    }
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
      if (this.listeners.length === 0) {
        this.stopPolling();
      }
    };
  }

  private async startPolling() {
    this.pollTimerId = setInterval(() => this.pollMarketData(), this.pollInterval);
    // Immediate first poll
    this.pollMarketData();
  }

  private stopPolling() {
    if (this.pollTimerId) {
      clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
  }

  private async pollMarketData() {
    try {
      const response = await fetch(`${this.apiUrl}/stocks`);
      if (!response.ok) throw new Error('Failed to fetch market data');
      const data = await response.json();
      this.notifyListeners(data);
    } catch (error) {
      this.notifyListenersError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private notifyListeners(data: any) {
    this.listeners.forEach(listener => listener.onUpdate(data));
  }

  private notifyListenersError(error: string) {
    this.listeners.forEach(listener => listener.onError?.(error));
  }

  destroy() {
    this.stopPolling();
    this.listeners = [];
  }
}
