import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OrderService } from './services/order.service';
import { Order, SessionStatus } from './models/order.model';
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

interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
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

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Exchange Platform';
  orders: Order[] = [];
  sessionStatus: SessionStatus | null = null;
  loading = false;
  error: string | null = null;
  success: string | null = null;
  
  // Expose Math for template
  Math = Math;
  
  // Market Data - Categorized
  stockCategories: StockCategory[] = [];
  filteredCategories: StockCategory[] = [];
  allStocks: StockQuote[] = [];
  securities: Security[] = [];
  searchQuery = '';
  
  // Position Tracking
  positions: Position[] = [];
  totalPortfolioValue = 0;
  totalUnrealizedPnL = 0;
  totalRealizedPnL = 0;
  
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
  
  // Arbitrage & Spread Analysis
  spreadOpportunities: {symbol: string, spread: number, spreadBps: number, opportunity: string}[] = [];
  correlatedPairs: {pair: string, correlation: number, divergence: number, signal: string}[] = [];
  marketInefficiencies: {symbol: string, type: string, magnitude: number, confidence: number}[] = [];
  historicalSpreads: Map<string, number[]> = new Map();
  
  // Technical Indicators
  vwapData: Map<string, number> = new Map();
  rsiData: Map<string, number> = new Map();
  volatilityData: Map<string, number> = new Map();
  
  // Current symbol indicators (for change detection)
  currentVwap = 0;
  currentRsi = 50;
  currentVolatility = 0;
  currentSpread = 0;
  
  // Market Statistics
  totalMarketVolume = 0;
  marketBreadth = { advancers: 0, decliners: 0, unchanged: 0 };
  sectorPerformance: {sector: string, change: number, volume: number}[] = [];
  
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
    this.startPolling();
    this.startMarketDataPolling();
    
    // Update time every second
    setInterval(() => {
      this.currentTime = new Date();
      this.updateAnalytics();
    }, 1000);
    
    // Refresh order book every 500ms 
    setInterval(() => {
      this.refreshOrderBook();
    }, 500);
    
    // Initialize correlated pairs for arbitrage monitoring
    this.initializeCorrelatedPairs();
    
    // Initialize order book
    setTimeout(() => {
      this.refreshOrderBook();
      this.loadRecentTrades();
    }, 500);
    
    // Initialize options pricing after a short delay for market data to load
    setTimeout(() => {
      this.updateOptionPrice();
      this.loadOptionsChain();
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
      this.calculatePositions();
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
  
  startPolling(): void {
    this.pollingSubscription = interval(5000).pipe(
      switchMap(() => this.orderService.getOrders().pipe(
        catchError(() => of([]))
      ))
    ).subscribe(orders => {
      this.orders = orders;
      this.calculatePositions();
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
  
  getSideLabel(side: string): string {
    return side === '1' ? 'BUY' : side === '2' ? 'SELL' : side;
  }
  
  getSideClass(side: string): string {
    return side === '1' ? 'side-buy' : side === '2' ? 'side-sell' : '';
  }
  
  refreshOrders(): void {
    this.loadOrders();
    this.loadSessionStatus();
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
      timeInForce: this.newOrder.timeInForce,
      status: 'NEW'
    };
    
    this.orderService.createOrder(order).pipe(
      catchError(err => {
        this.error = 'Failed to submit order: ' + (err.message || err.statusText || 'Unknown error');
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
  
  // Position Tracking Methods
  calculatePositions(): void {
    const positionMap = new Map<string, { qty: number; totalCost: number; realizedPnL: number }>();
    
    // Process filled orders to calculate positions
    const filledOrders = this.orders.filter(o => 
      o.status?.toUpperCase() === 'FILLED' || o.status?.toUpperCase() === 'PARTIALLY_FILLED'
    );
    
    filledOrders.forEach(order => {
      const symbol = order.symbol;
      const qty = order.filledQty || order.quantity;
      const price = order.price;
      const isBuy = order.side === '1';
      
      if (!positionMap.has(symbol)) {
        positionMap.set(symbol, { qty: 0, totalCost: 0, realizedPnL: 0 });
      }
      
      const pos = positionMap.get(symbol)!;
      
      if (isBuy) {
        pos.qty += qty;
        pos.totalCost += qty * price;
      } else {
        // Sell - realize P&L
        if (pos.qty > 0) {
          const avgCost = pos.totalCost / pos.qty;
          const sellQty = Math.min(qty, pos.qty);
          pos.realizedPnL += sellQty * (price - avgCost);
          pos.totalCost -= sellQty * avgCost;
          pos.qty -= sellQty;
        }
      }
    });
    
    // Convert to Position array with current prices
    this.positions = [];
    this.totalPortfolioValue = 0;
    this.totalUnrealizedPnL = 0;
    this.totalRealizedPnL = 0;
    
    positionMap.forEach((pos, symbol) => {
      if (pos.qty > 0) {
        const stock = this.allStocks.find(s => s.symbol === symbol);
        const currentPrice = stock?.price || this.basePrices.get(symbol) || 0;
        const avgPrice = pos.totalCost / pos.qty;
        const marketValue = pos.qty * currentPrice;
        const unrealizedPnL = (currentPrice - avgPrice) * pos.qty;
        const unrealizedPnLPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
        
        this.positions.push({
          symbol,
          quantity: pos.qty,
          avgPrice,
          currentPrice,
          marketValue,
          unrealizedPnL,
          unrealizedPnLPercent,
          realizedPnL: pos.realizedPnL
        });
        
        this.totalPortfolioValue += marketValue;
        this.totalUnrealizedPnL += unrealizedPnL;
      }
      this.totalRealizedPnL += pos.realizedPnL;
    });
    
    // Sort by market value
    this.positions.sort((a, b) => b.marketValue - a.marketValue);
    
    // Build executions blotter
    this.buildExecutions();
  }
  
  buildExecutions(): void {
    // Generate execution records from filled orders
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
      .slice(0, 20); // Show last 20 executions
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
    // Update technical indicators for new symbol
    console.log('Order book symbol changed to:', this.selectedOrderBookSymbol);
    this.updateCurrentIndicators();
    // Also update new order form symbol
    this.newOrder.symbol = this.selectedOrderBookSymbol;
    // Refresh order book immediately
    this.refreshOrderBook();
    this.loadRecentTrades();
  }
  
  refreshOrderBook(): void {
    const symbol = this.selectedOrderBookSymbol;
    const stock = this.allStocks.find(s => s.symbol === symbol);
    const midPrice = stock?.price || 175;
    
    // Try to fetch real order book from API
    this.http.get<any>(`/api/marketdata/orderbook/${symbol}?depth=10`)
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
  
  formatApiOrderBook(response: any, midPrice: number): { bids: any[], asks: any[] } {
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
    this.http.get<any[]>(`/api/marketdata/trades/${symbol}`)
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
  
  updateCurrentIndicators(): void {
    const symbol = this.selectedOrderBookSymbol;
    this.currentVwap = this.vwapData.get(symbol) || 0;
    this.currentRsi = this.rsiData.get(symbol) || 50;
    this.currentVolatility = this.volatilityData.get(symbol) || 0;
    
    const stock = this.allStocks.find(s => s.symbol === symbol);
    if (stock && stock.bid > 0 && stock.ask > 0) {
      this.currentSpread = ((stock.ask - stock.bid) / stock.price) * 10000;
    } else {
      this.currentSpread = 0;
    }
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

  // ============= ARBITRAGE & SPREAD ANALYSIS =============
  
  initializeCorrelatedPairs(): void {
    this.correlatedPairs = [
      { pair: 'AAPL/MSFT', correlation: 0.85, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'GOOGL/META', correlation: 0.78, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'JPM/BAC', correlation: 0.92, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'XOM/CVX', correlation: 0.95, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'V/MA', correlation: 0.88, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'KO/PEP', correlation: 0.82, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'NVDA/AMD', correlation: 0.75, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'JNJ/PFE', correlation: 0.72, divergence: 0, signal: 'NEUTRAL' },
    ];
  }

  updateAnalytics(): void {
    if (this.allStocks.length === 0) return;
    
    this.updateSpreadOpportunities();
    this.updateCorrelatedPairs();
    this.updateMarketInefficiencies();
    this.updateMarketStatistics();
    this.updateTechnicalIndicators();
  }

  updateSpreadOpportunities(): void {
    this.spreadOpportunities = this.allStocks
      .filter(s => s.bid > 0 && s.ask > 0)
      .map(s => {
        const spread = s.ask - s.bid;
        const spreadBps = (spread / s.price) * 10000;
        let opportunity = 'LOW';
        if (spreadBps > 10) opportunity = 'MEDIUM';
        if (spreadBps > 25) opportunity = 'HIGH';
        return { symbol: s.symbol, spread, spreadBps, opportunity };
      })
      .sort((a, b) => b.spreadBps - a.spreadBps)
      .slice(0, 10);
  }

  updateCorrelatedPairs(): void {
    this.correlatedPairs = this.correlatedPairs.map(pair => {
      const [sym1, sym2] = pair.pair.split('/');
      const stock1 = this.allStocks.find(s => s.symbol === sym1);
      const stock2 = this.allStocks.find(s => s.symbol === sym2);
      
      if (!stock1 || !stock2) return pair;
      
      // Calculate divergence based on relative price changes
      const change1 = stock1.changePercent || 0;
      const change2 = stock2.changePercent || 0;
      const expectedChange2 = change1 * pair.correlation;
      const divergence = change2 - expectedChange2;
      
      let signal = 'NEUTRAL';
      if (divergence > 0.5) signal = 'SELL_' + sym2;
      if (divergence < -0.5) signal = 'BUY_' + sym2;
      if (Math.abs(divergence) > 1.0) signal = 'STRONG_' + signal;
      
      return { ...pair, divergence: Math.round(divergence * 100) / 100, signal };
    });
  }

  updateMarketInefficiencies(): void {
    this.marketInefficiencies = [];
    
    this.allStocks.forEach(stock => {
      // Check for momentum anomalies
      if (Math.abs(stock.changePercent) > 3) {
        this.marketInefficiencies.push({
          symbol: stock.symbol,
          type: stock.changePercent > 0 ? 'OVERBOUGHT' : 'OVERSOLD',
          magnitude: Math.abs(stock.changePercent),
          confidence: Math.min(95, 60 + Math.abs(stock.changePercent) * 5)
        });
      }
      
      // Check for unusual spread
      const spreadBps = ((stock.ask - stock.bid) / stock.price) * 10000;
      if (spreadBps > 20) {
        this.marketInefficiencies.push({
          symbol: stock.symbol,
          type: 'WIDE_SPREAD',
          magnitude: spreadBps,
          confidence: Math.min(90, 50 + spreadBps)
        });
      }
      
      // Track historical spreads for volatility detection
      if (!this.historicalSpreads.has(stock.symbol)) {
        this.historicalSpreads.set(stock.symbol, []);
      }
      const history = this.historicalSpreads.get(stock.symbol)!;
      history.push(spreadBps);
      if (history.length > 60) history.shift(); // Keep last 60 samples
    });
    
    // Sort by confidence
    this.marketInefficiencies.sort((a, b) => b.confidence - a.confidence);
    this.marketInefficiencies = this.marketInefficiencies.slice(0, 8);
  }

  updateMarketStatistics(): void {
    this.totalMarketVolume = this.allStocks.reduce((sum, s) => sum + (s.volume || 0), 0);
    
    this.marketBreadth = {
      advancers: this.allStocks.filter(s => s.change > 0).length,
      decliners: this.allStocks.filter(s => s.change < 0).length,
      unchanged: this.allStocks.filter(s => s.change === 0).length
    };
    
    // Calculate sector performance
    const sectorMap = new Map<string, {totalChange: number, count: number, volume: number}>();
    this.allStocks.forEach(s => {
      const current = sectorMap.get(s.sector) || {totalChange: 0, count: 0, volume: 0};
      current.totalChange += s.changePercent || 0;
      current.count++;
      current.volume += s.volume || 0;
      sectorMap.set(s.sector, current);
    });
    
    this.sectorPerformance = Array.from(sectorMap.entries())
      .map(([sector, data]) => ({
        sector,
        change: Math.round((data.totalChange / data.count) * 100) / 100,
        volume: data.volume
      }))
      .sort((a, b) => b.change - a.change);
  }

  updateTechnicalIndicators(): void {
    this.allStocks.forEach(stock => {
      // Simplified VWAP calculation (in real system would use tick data)
      const vwap = stock.price * 0.998 + (Math.random() - 0.5) * stock.price * 0.002;
      this.vwapData.set(stock.symbol, Math.round(vwap * 100) / 100);
      
      // Simplified RSI (random walk around 50)
      const currentRsi = this.rsiData.get(stock.symbol) || 50;
      const rsiChange = (Math.random() - 0.5) * 5 + (stock.changePercent || 0) * 2;
      const newRsi = Math.max(0, Math.min(100, currentRsi + rsiChange));
      this.rsiData.set(stock.symbol, Math.round(newRsi));
      
      // Volatility (implied from spread)
      const vol = ((stock.ask - stock.bid) / stock.price) * 100 * 16; // Annualized approximation
      this.volatilityData.set(stock.symbol, Math.round(vol * 100) / 100);
    });
    
    // Update current indicators for selected symbol
    this.updateCurrentIndicators();
  }

  getVwap(symbol: string): number {
    return this.vwapData.get(symbol) || 0;
  }

  getRsi(symbol: string): number {
    return this.rsiData.get(symbol) || 50;
  }

  getVolatility(symbol: string): number {
    return this.volatilityData.get(symbol) || 0;
  }

  getRsiClass(rsi: number): string {
    if (rsi >= 70) return 'rsi-overbought';
    if (rsi <= 30) return 'rsi-oversold';
    return 'rsi-neutral';
  }

  getSignalClass(signal: string): string {
    if (signal.includes('BUY')) return 'signal-buy';
    if (signal.includes('SELL')) return 'signal-sell';
    return 'signal-neutral';
  }

  getOpportunityClass(opportunity: string): string {
    if (opportunity === 'HIGH') return 'opportunity-high';
    if (opportunity === 'MEDIUM') return 'opportunity-medium';
    return 'opportunity-low';
  }

  formatVolume(vol: number): string {
    if (vol >= 1000000000) return (vol / 1000000000).toFixed(1) + 'B';
    if (vol >= 1000000) return (vol / 1000000).toFixed(1) + 'M';
    if (vol >= 1000) return (vol / 1000).toFixed(1) + 'K';
    return vol.toString();
  }

  // ================== G4-M4: Options Pricing Methods ==================

  updateOptionPrice(): void {
    // Update spot price from market data
    const stock = this.allStocks.find(s => s.symbol === this.optionsPricing.symbol);
    if (stock) {
      this.optionsPricing.spotPrice = stock.price;
    }
    
    // Call API to get option price
    const params = {
      spot: this.optionsPricing.spotPrice,
      strike: this.optionsPricing.strikePrice,
      timeToExpiry: this.optionsPricing.daysToExpiry / 365,
      riskFreeRate: this.optionsPricing.riskFreeRate / 100,
      volatility: this.optionsPricing.volatility / 100,
      isCall: this.optionsPricing.optionType === 'CALL'
    };
    
    this.http.get<any>('/api/options/price', { params: params as any })
      .pipe(catchError(() => of(null)))
      .subscribe(result => {
        if (result) {
          this.optionsPricing.fairPrice = result.price || 0;
          if (result.greeks) {
            this.optionsPricing.greeks = {
              delta: result.greeks.delta || 0,
              gamma: result.greeks.gamma || 0,
              theta: result.greeks.theta || 0,
              vega: result.greeks.vega || 0,
              rho: result.greeks.rho || 0
            };
          }
        } else {
          // Calculate locally as fallback
          this.calculateOptionPriceLocally();
        }
      });
  }

  calculateOptionPriceLocally(): void {
    const S = this.optionsPricing.spotPrice;
    const K = this.optionsPricing.strikePrice;
    const T = this.optionsPricing.daysToExpiry / 365;
    const r = this.optionsPricing.riskFreeRate / 100;
    const sigma = this.optionsPricing.volatility / 100;
    const isCall = this.optionsPricing.optionType === 'CALL';
    
    // Black-Scholes calculation
    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    const Nd1 = this.normalCDF(d1);
    const Nd2 = this.normalCDF(d2);
    const Nnd1 = this.normalCDF(-d1);
    const Nnd2 = this.normalCDF(-d2);
    
    if (isCall) {
      this.optionsPricing.fairPrice = S * Nd1 - K * Math.exp(-r * T) * Nd2;
      this.optionsPricing.greeks.delta = Nd1;
    } else {
      this.optionsPricing.fairPrice = K * Math.exp(-r * T) * Nnd2 - S * Nnd1;
      this.optionsPricing.greeks.delta = Nd1 - 1;
    }
    
    // Calculate other Greeks
    const sqrtT = Math.sqrt(T);
    const discount = Math.exp(-r * T);
    const npd1 = this.normalPDF(d1);
    
    this.optionsPricing.greeks.gamma = npd1 / (S * sigma * sqrtT);
    this.optionsPricing.greeks.vega = S * npd1 * sqrtT / 100;
    this.optionsPricing.greeks.theta = isCall
      ? (-S * npd1 * sigma / (2 * sqrtT) - r * K * discount * Nd2) / 365
      : (-S * npd1 * sigma / (2 * sqrtT) + r * K * discount * Nnd2) / 365;
    this.optionsPricing.greeks.rho = isCall
      ? K * T * discount * Nd2 / 100
      : -K * T * discount * Nnd2 / 100;
  }

  normalCDF(x: number): number {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return 0.5 * (1.0 + sign * y);
  }

  normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  loadOptionsChain(): void {
    const stock = this.allStocks.find(s => s.symbol === this.optionsPricing.symbol);
    if (!stock) return;
    
    const spotPrice = stock.price;
    const chain: {type: string, strike: number, price: number, delta: number, iv: number}[] = [];
    
    // Generate strikes around spot price
    const strikeStep = Math.max(1, Math.round(spotPrice / 20));
    const minStrike = Math.floor(spotPrice * 0.85 / strikeStep) * strikeStep;
    const maxStrike = Math.ceil(spotPrice * 1.15 / strikeStep) * strikeStep;
    
    for (let strike = minStrike; strike <= maxStrike; strike += strikeStep) {
      for (const type of ['CALL', 'PUT']) {
        const isCall = type === 'CALL';
        const T = this.optionsPricing.daysToExpiry / 365;
        const r = this.optionsPricing.riskFreeRate / 100;
        const sigma = this.optionsPricing.volatility / 100;
        
        const d1 = (Math.log(spotPrice / strike) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);
        
        let price, delta;
        if (isCall) {
          price = spotPrice * this.normalCDF(d1) - strike * Math.exp(-r * T) * this.normalCDF(d2);
          delta = this.normalCDF(d1);
        } else {
          price = strike * Math.exp(-r * T) * this.normalCDF(-d2) - spotPrice * this.normalCDF(-d1);
          delta = this.normalCDF(d1) - 1;
        }
        
        chain.push({
          type: type,
          strike: strike,
          price: Math.max(0, price),
          delta: delta,
          iv: this.optionsPricing.volatility
        });
      }
    }
    
    this.optionsChain = chain.sort((a, b) => a.strike - b.strike || (a.type === 'CALL' ? -1 : 1));
  }

  getMoneyness(): string {
    const ratio = this.optionsPricing.spotPrice / this.optionsPricing.strikePrice;
    const isCall = this.optionsPricing.optionType === 'CALL';
    
    if (Math.abs(ratio - 1) < 0.02) return 'ATM';
    if (isCall) {
      return ratio > 1 ? 'ITM' : 'OTM';
    } else {
      return ratio < 1 ? 'ITM' : 'OTM';
    }
  }

  getMoneyessClass(): string {
    const moneyness = this.getMoneyness();
    if (moneyness === 'ITM') return 'itm';
    if (moneyness === 'OTM') return 'otm';
    return 'atm';
  }
}
