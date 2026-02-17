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
  
  private pollingSubscription?: Subscription;
  private marketDataSubscription?: Subscription;
  
  constructor(private orderService: OrderService, private http: HttpClient) {}
  
  ngOnInit(): void {
    this.loadMarketData();
    this.loadOrders();
    this.loadSessionStatus();
    this.startPolling();
    this.startMarketDataPolling();
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
}
