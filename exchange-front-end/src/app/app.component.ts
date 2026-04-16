import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OrderService } from './services/order.service';
import { Order, SessionStatus, SessionEvent } from './models/order.model';
import { Subscription, interval, of, forkJoin } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

interface StockQuote {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface StockCategory {
  name: string;
  stocks: StockQuote[];
  expanded: boolean;
}

interface Security {
  symbol: string;
  name: string;
  sector: string;
  securityType: string;
}

interface MarketData {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  change: number;
  changePercent: number;
}



interface Execution {
  execId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  time: Date;
  orderId: string;
}

// Removed unused interfaces for News, Currency, Exports, Alerts
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Exchange Platform';
  orders: Order[] = [];
  sessionStatus: SessionStatus | null = null;
  sessionEvents: SessionEvent[] = [];
  loading = false;
  sessionEventsLoading = false;
  sessionEventFilter: 'ALL' | 'ERRORS' | 'ORDERS' | 'SESSION' = 'ALL';
  sessionEventsLimit = 20;
  sessionEventsLive = true;
  error: string | null = null;
  success: string | null = null;
  
  // Navigation
  currentView = 'dashboard';
  
  // Expose Math for template
  Math = Math;
  
  // Market Data - Categorized
  stockCategories: StockCategory[] = [];
  filteredCategories: StockCategory[] = [];
  allStocks: StockQuote[] = [];
  securities: Security[] = [];
  searchQuery = '';
  orderSearchQuery = '';
  orderStatusFilter = 'ALL';
  readonly orderStatusOptions = [
    'ALL',
    'NEW',
    'PARTIALLY_FILLED',
    'FILLED',
    'CANCELED',
    'REJECTED'
  ];
  private readonly responseInFlightKeys = new Set<string>();
  readonly sessionEventLimits = [20, 50, 100];
  
  // Trade History Blotter
  executions: Execution[] = [];
  
  // New feature properties
  currentTime = new Date();
  selectedOrderBookSymbol = 'AAPL';
  systemHealth = { healthy: true };
  
  // Cached Order Book Data (fixes flickering)
  cachedOrderBook: { bids: any[], asks: any[] } = { bids: [], asks: [] };
  orderBookLoading = false;
  
  // Real-time Trade Ticker
  recentTrades: { symbol: string, price: number, qty: number, side: string, time: Date }[] = [];
  
  // Volume Profile
  volumeProfile: { price: number, buyVolume: number, sellVolume: number }[] = [];
  
  // Quick Trade Sizes
  quickSizes = [100, 500, 1000, 5000];
  
  // Time & Sales
  timeSales: { time: Date, price: number, size: number, side: string }[] = [];
  
  // Market Depth (for chart)
  depthData: { bids: {price: number, total: number}[], asks: {price: number, total: number}[] } = { bids: [], asks: [] };
  
  // Removed fluff variables

  private basePrices: Map<string, number> = new Map();
  
  // New order form
  newOrder = {
    symbol: 'AAPL',
    side: '1',
    quantity: 100,
    price: 178.50,
    orderType: 'LIMIT',
    timeInForce: 'DAY'
  };
  
  // G4-M4: Options Pricing UI
  optionsPricing = {
    symbol: 'AAPL',
    optionType: 'CALL',
    spotPrice: 178.50,
    strikePrice: 180,
    daysToExpiry: 30,
    volatility: 25,
    riskFreeRate: 5,
    fairPrice: 0,
    greeks: {
      delta: 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0
    }
  };
  optionsChain: {type: string, strike: number, price: number, delta: number, iv: number}[] = [];
  
  private pollingSubscription?: Subscription;
  private marketDataSubscription?: Subscription;
  
  constructor(private orderService: OrderService, private http: HttpClient) {}
  
  ngOnInit(): void {
    this.loadMarketData();
    this.loadOrders();
    this.loadSessionStatus();
    this.loadSessionEvents(this.sessionEventsLimit);
    this.startPolling();
    this.startMarketDataPolling();
    
    // Update time every second
    setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
    
    // Refresh order book every 500ms 
    setInterval(() => {
      this.refreshOrderBook();
    }, 500);
    
    // Initialize order book
    setTimeout(() => {
      this.refreshOrderBook();
      this.loadRecentTrades();
    }, 500);
    
    // Initialize order book after delay
    setTimeout(() => {
      this.refreshOrderBook();
      this.loadRecentTrades();
    }, 1500);
  }
  
  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.marketDataSubscription) {
      this.marketDataSubscription.unsubscribe();
    }
  }
  
  loadMarketData(): void {
    // Load both securities and market data from API
    forkJoin({
      securities: this.http.get<Security[]>('/api/securities').pipe(catchError(() => of([]))),
      marketData: this.http.get<MarketData[]>('/api/marketdata').pipe(catchError(() => of([])))
    }).subscribe(({ securities, marketData }) => {
      this.securities = securities.filter(s => s.securityType === 'EQUITY');
      
      // Create a map of market data
      const mdMap = new Map<string, MarketData>();
      marketData.forEach(md => mdMap.set(md.symbol, md));
      
      // Convert to StockQuote format
      this.allStocks = this.securities.map(s => {
        const md = mdMap.get(s.symbol);
        const basePrice = md?.lastPrice || 100;
        this.basePrices.set(s.symbol, basePrice);
        
        return {
          symbol: s.symbol,
          name: s.name,
          sector: s.sector,
          price: md?.lastPrice || basePrice,
          bid: md?.bid || basePrice - 0.05,
          ask: md?.ask || basePrice + 0.05,
          change: md?.change || 0,
          changePercent: md?.changePercent || 0,
          volume: md?.volume || 0
        };
      });
      
      this.organizeByCategory();
      
      // Set initial price for order form
      if (this.allStocks.length > 0) {
        const aapl = this.allStocks.find(s => s.symbol === 'AAPL');
        if (aapl) {
          this.newOrder.price = Math.round(aapl.price * 100) / 100;
        }
      }
    });
  }
  
  startMarketDataPolling(): void {
    this.marketDataSubscription = interval(2000).pipe(
      switchMap(() => this.http.get<MarketData[]>('/api/marketdata').pipe(catchError(() => of([]))))
    ).subscribe(marketData => {
      const mdMap = new Map<string, MarketData>();
      marketData.forEach(md => mdMap.set(md.symbol, md));
      
      // Update stocks with new prices
      this.allStocks = this.allStocks.map(stock => {
        const md = mdMap.get(stock.symbol);
        if (md) {
          return {
            ...stock,
            price: md.lastPrice,
            bid: md.bid,
            ask: md.ask,
            change: md.change,
            changePercent: md.changePercent,
            volume: md.volume
          };
        }
        return stock;
      });
      
      // Update categories
      this.stockCategories.forEach(cat => {
        cat.stocks = this.allStocks.filter(s => s.sector === cat.name);
      });
    });
  }
  
  organizeByCategory(): void {
    const sectors = [...new Set(this.allStocks.map(s => s.sector))];
    this.stockCategories = sectors.map(sector => ({
      name: sector,
      stocks: this.allStocks.filter(s => s.sector === sector),
      expanded: sector === 'TECHNOLOGY' || sector === 'Technology'
    }));
    
    // Expand first category if none are expanded
    if (this.stockCategories.length > 0 && !this.stockCategories.some(c => c.expanded)) {
      this.stockCategories[0].expanded = true;
    }
    
    this.filteredCategories = [...this.stockCategories];
  }
  
  filterStocks(): void {
    if (!this.searchQuery.trim()) {
      this.filteredCategories = [...this.stockCategories];
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredCategories = this.stockCategories
      .map(cat => ({
        ...cat,
        stocks: cat.stocks.filter(s => 
          s.symbol.toLowerCase().includes(query) || 
          s.name.toLowerCase().includes(query)
        ),
        expanded: true
      }))
      .filter(cat => cat.stocks.length > 0);
  }
  
  getSelectedStock(): StockQuote | undefined {
    return this.allStocks.find(s => s.symbol === this.newOrder.symbol);
  }
  
  onSymbolChange(): void {
    const stock = this.getSelectedStock();
    if (stock) {
      this.newOrder.price = Math.round(stock.price * 100) / 100;
    }
  }
  
  getTotalVolume(): number {
    return this.allStocks.reduce((sum, s) => sum + (s.volume || 0), 0);
  }
  
  getFilledCount(): number {
    return this.orders.filter(o => o.status?.toUpperCase() === 'FILLED').length;
  }
  
  getOpenCount(): number {
    return this.orders.filter(o => ['NEW', 'PARTIALLY_FILLED'].includes(o.status?.toUpperCase() || '')).length;
  }

  get filteredOrders(): Order[] {
    const query = this.orderSearchQuery.trim().toLowerCase();

    return this.orders.filter(order => {
      const status = (order.status || '').toUpperCase();
      const normalizedStatus = status === 'CANCELLED' ? 'CANCELED' : status;
      const statusMatches = this.orderStatusFilter === 'ALL' || normalizedStatus === this.orderStatusFilter;

      if (!statusMatches) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        order.clOrdId || '',
        order.orderRefNumber || '',
        order.symbol || '',
        this.getSideLabel(order.side),
        normalizedStatus
      ].some(value => value.toLowerCase().includes(query));
    });
  }

  clearOrderFilters(): void {
    this.orderSearchQuery = '';
    this.orderStatusFilter = 'ALL';
  }

  sendOrderResponse(order: Order, responseType: 'ACK' | 'STATUS' | 'CANCEL' | 'REJECT'): void {
    const clOrdId = order.clOrdId;
    if (!clOrdId) {
      this.error = 'Cannot send FIX response: missing clOrdId on selected order';
      return;
    }

    const requestKey = `${clOrdId}:${responseType}`;
    if (this.responseInFlightKeys.has(requestKey)) {
      return;
    }

    this.responseInFlightKeys.add(requestKey);
    this.error = null;

    this.orderService.sendQuickFixResponse({
      clOrdId,
      responseType,
      text: `Triggered from Exchange UI (${responseType})`
    }).pipe(
      catchError(err => {
        this.error = err?.error?.message || `Failed to send ${responseType} response for ${clOrdId}`;
        return of(null);
      })
    ).subscribe(result => {
      this.responseInFlightKeys.delete(requestKey);

      if (result?.success) {
        this.success = `${result.responseType} response sent for ${result.clOrdId}`;
        this.loadSessionStatus();
        this.loadSessionEvents(this.sessionEventsLimit);
      }
    });
  }

  isOrderResponseSending(order: Order, responseType: 'ACK' | 'STATUS' | 'CANCEL' | 'REJECT'): boolean {
    const clOrdId = order.clOrdId;
    if (!clOrdId) {
      return false;
    }
    return this.responseInFlightKeys.has(`${clOrdId}:${responseType}`);
  }
  
  toggleCategory(category: StockCategory): void {
    category.expanded = !category.expanded;
  }
  
  selectStock(stock: StockQuote): void {
    this.newOrder.symbol = stock.symbol;
    this.newOrder.price = Math.round(stock.price * 100) / 100;
  }
  
  getStockPrice(symbol: string): number {
    const stock = this.allStocks.find(s => s.symbol === symbol);
    return stock ? stock.price : 0;
  }
  
  loadOrders(): void {
    this.loading = true;
    this.error = null;
    this.orderService.getOrders().pipe(
      catchError(err => {
        this.error = 'Failed to load orders: ' + (err.message || 'Unknown error');
        return of([]);
      })
    ).subscribe(orders => {
      this.orders = orders;
      this.loading = false;
    });
  }
  
  loadSessionStatus(): void {
    this.orderService.getSessionStatus().pipe(
      catchError(err => {
        console.error('Failed to load session status', err);
        return of(null);
      })
    ).subscribe(status => {
      this.sessionStatus = status;
    });
  }

  get filteredSessionEvents(): SessionEvent[] {
    if (this.sessionEventFilter === 'ALL') {
      return this.sessionEvents;
    }

    return this.sessionEvents.filter(event => {
      const type = (event.type || '').toUpperCase();

      if (this.sessionEventFilter === 'ERRORS') {
        return type.includes('REJECT') || type.includes('ERROR');
      }

      if (this.sessionEventFilter === 'ORDERS') {
        return type.includes('ORDER') || type.includes('FILL') || type.includes('TRADE') || type.includes('CANCEL');
      }

      if (this.sessionEventFilter === 'SESSION') {
        return type.includes('SESSION') || type.includes('LOGON') || type.includes('LOGOUT') || type.includes('HEARTBEAT');
      }

      return true;
    });
  }

  loadSessionEvents(limit = this.sessionEventsLimit): void {
    this.sessionEventsLimit = limit;
    this.sessionEventsLoading = true;
    this.orderService.getSessionEvents(limit).pipe(
      catchError(err => {
        console.error('Failed to load session events', err);
        return of([]);
      })
    ).subscribe(events => {
      this.sessionEvents = events;
      this.sessionEventsLoading = false;
    });
  }
  
  startPolling(): void {
    this.pollingSubscription = interval(5000).pipe(
      switchMap(() => this.orderService.getOrders().pipe(
        catchError(() => of([]))
      ))
    ).subscribe(orders => {
      this.orders = orders;
      this.loadSessionStatus();
      if (this.sessionEventsLive) {
        this.loadSessionEvents(this.sessionEventsLimit);
      }
    });
  }
  
  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'NEW': return 'status-new';
      case 'PARTIALLY_FILLED': return 'status-partial';
      case 'FILLED': return 'status-filled';
      case 'CANCELED': return 'status-canceled';
      case 'REJECTED': return 'status-rejected';
      default: return 'status-unknown';
    }
  }

  getSessionEventClass(type: string): string {
    const normalizedType = (type || '').toUpperCase();

    if (normalizedType.includes('REJECT')) {
      return 'event-chip event-chip--reject';
    }

    if (normalizedType.includes('CANCEL') || normalizedType.includes('LOGOUT')) {
      return 'event-chip event-chip--cancel';
    }

    if (normalizedType.includes('FILL') || normalizedType.includes('TRADE')) {
      return 'event-chip event-chip--fill';
    }

    if (normalizedType.includes('ORDER')) {
      return 'event-chip event-chip--order';
    }

    if (normalizedType.includes('LOGON') || normalizedType.includes('SESSION')) {
      return 'event-chip event-chip--session';
    }

    return 'event-chip event-chip--default';
  }
  
  getSideLabel(side: string): string {
    return side === '1' ? 'BUY' : side === '2' ? 'SELL' : side;
  }
  
  getSideClass(side: string): string {
    return side === '1' ? 'side-buy' : side === '2' ? 'side-sell' : '';
  }
  
  refreshOrders(): void {
    this.loadOrders();
    this.loadSessionStatus();
    this.loadSessionEvents(this.sessionEventsLimit);
  }

  submitOrder(): void {
    this.error = null;
    this.success = null;
    const order: any = {
      clOrdId: 'EXC-' + Date.now(),
      symbol: this.newOrder.symbol,
      side: this.newOrder.side,
      quantity: this.newOrder.quantity,
      price: this.newOrder.price,
      orderType: this.newOrder.orderType,
      timeInForce: this.newOrder.timeInForce
    };
    
    this.orderService.createOrder(order).pipe(
      catchError(err => {
        this.error = 'Failed to submit order: ' + (err.error?.rejectReason || err.error?.error || err.message || err.statusText || 'Unknown error');
        return of(null);
      })
    ).subscribe(result => {
      if (result) {
        this.success = 'Order submitted successfully: ' + result.clOrdId;
        this.loadOrders();
      }
    });
  }
  
  cancelOrder(clOrdId: string): void {
    this.orderService.cancelOrder(clOrdId).pipe(
      catchError(err => {
        this.error = 'Failed to cancel order: ' + (err.message || 'Unknown error');
        return of(null);
      })
    ).subscribe(() => {
      this.loadOrders();
    });
  }
  
  // Simplified executions builder
  buildExecutions(): void {
    this.executions = this.orders
      .filter(o => o.status?.toUpperCase() === 'FILLED' || o.status?.toUpperCase() === 'PARTIALLY_FILLED')
      .map((order, idx) => ({
        execId: `EXC-${idx + 1}`,
        symbol: order.symbol,
        side: order.side,
        quantity: order.filledQty || order.quantity,
        price: order.price,
        time: new Date(order.createdAt || Date.now()),
        orderId: order.clOrdId || order.orderRefNumber || ''
      }))
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 20);
  }
  
  // New Analytics Methods
  getOrderVolume(): number {
    return this.orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  }
  
  getFillRate(): number {
    if (this.orders.length === 0) return 0;
    const filled = this.getFilledCount();
    return (filled / this.orders.length) * 100;
  }
  
  getAvgLatency(): number {
    // Simulated latency - in real system would track actual latency
    return Math.floor(Math.random() * 3) + 1;
  }
  
  getOrdersPerSecond(): number {
    // Simulated throughput
    return Math.floor(Math.random() * 500) + 100;
  }
  
  getQuotesPerSecond(): number {
    return Math.floor(Math.random() * 1000) + 500;
  }
  
  getMessagesIn(): number {
    return this.orders.length * 2 + Math.floor(Math.random() * 100);
  }
  
  getMessagesOut(): number {
    return this.orders.length * 3 + Math.floor(Math.random() * 100);
  }
  
  getLastUpdateTime(): string {
    return new Date().toLocaleTimeString();
  }
  
  // Order Book Methods
  onOrderBookSymbolChange(): void {
    // Update current symbol
    console.log('Order book symbol changed to:', this.selectedOrderBookSymbol);
    // Also update new order form symbol
    this.newOrder.symbol = this.selectedOrderBookSymbol;
    // Refresh order book immediately
    this.refreshOrderBook();
    this.loadRecentTrades();
  }

  onHeatmapStockSelect(event: any): void {
    this.selectedOrderBookSymbol = event.symbol || event || 'AAPL';
    this.onOrderBookSymbolChange();
  }

  trackByOrderId(index: number, order: any): string {
    return order.orderRefNumber || order.clOrdId || index.toString();
  }
  
  refreshOrderBook(): void {
    const symbol = this.selectedOrderBookSymbol;
    const stock = this.allStocks.find(s => s.symbol === symbol);
    const midPrice = stock?.price || 175;
    
    // Try to fetch real order book from API
    this.http.get<any>(`/api/orderbook/${symbol}?depth=10`)
      .pipe(catchError(() => of(null)))
      .subscribe(response => {
        if (response && response.bids && response.bids.length > 0) {
          // Use real order book data
          this.cachedOrderBook = this.formatApiOrderBook(response, midPrice);
        } else {
          // Generate simulated order book for this symbol
          this.cachedOrderBook = this.generateSimulatedOrderBook(symbol, midPrice);
        }
        this.updateDepthChart();
      });
  }
  
  formatApiOrderBook(response: any, _midPrice: number): { bids: any[], asks: any[] } {
    let cumBidSize = 0;
    let cumAskSize = 0;
    
    const bids = (response.bids || []).slice(0, 8).map((level: any) => {
      cumBidSize += level.totalQuantity || level.size || 0;
      return {
        price: level.price,
        size: level.totalQuantity || level.size || 0,
        total: cumBidSize * level.price,
        percent: Math.min(100, (level.totalQuantity || level.size || 0) / 5)
      };
    });
    
    const asks = (response.asks || []).slice(0, 8).map((level: any) => {
      cumAskSize += level.totalQuantity || level.size || 0;
      return {
        price: level.price,
        size: level.totalQuantity || level.size || 0,
        total: cumAskSize * level.price,
        percent: Math.min(100, (level.totalQuantity || level.size || 0) / 5)
      };
    });
    
    return { bids, asks };
  }
  
  generateSimulatedOrderBook(symbol: string, midPrice: number): { bids: any[], asks: any[] } {
    // Use symbol hash to generate consistent order book
    const hash = symbol.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
    const seed = Math.abs(hash) % 1000;
    
    const bids = [];
    const asks = [];
    let cumBidSize = 0;
    let cumAskSize = 0;
    
    for (let i = 0; i < 8; i++) {
      // Use seeded pseudo-random for consistent results per symbol
      const bidSize = ((seed * (i + 1) * 17) % 500) + 100;
      const askSize = ((seed * (i + 1) * 23) % 500) + 100;
      cumBidSize += bidSize;
      cumAskSize += askSize;
      
      bids.push({
        price: midPrice - (i + 1) * 0.05,
        size: bidSize,
        total: cumBidSize * (midPrice - (i + 1) * 0.05),
        percent: Math.min(100, bidSize / 5)
      });
      
      asks.push({
        price: midPrice + (i + 1) * 0.05,
        size: askSize,
        total: cumAskSize * (midPrice + (i + 1) * 0.05),
        percent: Math.min(100, askSize / 5)
      });
    }
    
    return { bids, asks };
  }
  
  updateDepthChart(): void {
    // Calculate cumulative depth for chart visualization
    let bidTotal = 0;
    let askTotal = 0;
    
    this.depthData.bids = this.cachedOrderBook.bids.map(b => {
      bidTotal += b.size;
      return { price: b.price, total: bidTotal };
    }).reverse();
    
    this.depthData.asks = this.cachedOrderBook.asks.map(a => {
      askTotal += a.size;
      return { price: a.price, total: askTotal };
    });
  }
  
  loadRecentTrades(): void {
    const symbol = this.selectedOrderBookSymbol;
    this.http.get<any[]>(`/api/trades/${symbol}`)
      .pipe(catchError(() => of([])))
      .subscribe(trades => {
        this.recentTrades = (trades || []).slice(0, 20).map(t => ({
          symbol: t.symbol || symbol,
          price: t.price,
          qty: t.quantity,
          side: t.aggressorSide || 'BUY',
          time: new Date(t.createdAt || Date.now())
        }));
        
        // Also update time & sales
        this.timeSales = this.recentTrades.slice(0, 10).map(t => ({
          time: t.time,
          price: t.price,
          size: t.qty,
          side: t.side
        }));
      });
  }
  
  // Quick trade functions
  quickBuy(size: number): void {
    this.newOrder.side = '1';
    this.newOrder.quantity = size;
    this.submitOrder();
  }
  
  quickSell(size: number): void {
    this.newOrder.side = '2';
    this.newOrder.quantity = size;
    this.submitOrder();
  }
  


  getOrderBookCategories(): StockCategory[] {
    // Return categories with only EQUITY stocks for the order book dropdown
    return this.stockCategories.filter(cat => cat.stocks.length > 0);
  }
  
  generateOrderBook(): { bids: any[], asks: any[] } {
    // Return cached order book data (refreshed via refreshOrderBook)
    return this.cachedOrderBook;
  }
  
  getOrderBookSpread(): number {
    const stock = this.allStocks.find(s => s.symbol === this.selectedOrderBookSymbol);
    return stock ? (stock.ask - stock.bid) : 0.10;
  }
  
  getSpreadPercent(): number {
    const stock = this.allStocks.find(s => s.symbol === this.selectedOrderBookSymbol);
    if (!stock) return 0;
    return ((stock.ask - stock.bid) / stock.price) * 100;
  }
  
  getMidPrice(): number {
    const stock = this.allStocks.find(s => s.symbol === this.selectedOrderBookSymbol);
    return stock ? (stock.bid + stock.ask) / 2 : 175;
  }

  getAllStocks(): StockQuote[] {
    // Return top 12 stocks for the ticker display
    return this.allStocks.slice(0, 12);
  }

  // Removed unused methods and analytics logic as per UI simplification request
}
