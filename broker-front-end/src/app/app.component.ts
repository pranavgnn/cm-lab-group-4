import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OrderService } from './services/order.service';
import { AuthService, User, LoginRequest, RegisterRequest } from './services/auth.service';
import { Order, SessionInfo } from './models/order.model';
import { Subscription, interval, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

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
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Broker Platform';
  orders: Order[] = [];
  sessionInfo: SessionInfo | null = null;
  loading = false;
  error: string | null = null;
  
  // Authentication
  currentUser: User | null = null;
  showLoginForm = false;
  isRegistering = false;
  loginForm = {
    username: '',
    password: '',
    email: '',
    displayName: ''
  };
  authError: string | null = null;
  
  // Market data from exchange
  marketData: MarketData[] = [];
  
  // Position tracking
  positions: Position[] = [];
  totalPortfolioValue = 0;
  totalUnrealizedPnL = 0;
  
  // Quick trade symbols
  quickSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];
  allSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'AMD', 'INTC', 'NFLX', 
                'JPM', 'BAC', 'GS', 'V', 'MA', 'JNJ', 'PFE', 'UNH', 'XOM', 'CVX'];
  
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
  
  constructor(
    private orderService: OrderService, 
    private http: HttpClient,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    // Check if user is already logged in
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.showLoginForm = false;
        this.loadOrders();
        this.loadSessionInfo();
        this.loadMarketData();
        this.startPolling();
        this.startMarketDataPolling();
      }
    });
    
    // Load market data for ticker even if not logged in
    this.loadMarketData();
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
  
  // Authentication methods
  showLogin(): void {
    this.showLoginForm = true;
    this.isRegistering = false;
    this.authError = null;
    this.resetLoginForm();
  }
  
  showRegister(): void {
    this.showLoginForm = true;
    this.isRegistering = true;
    this.authError = null;
    this.resetLoginForm();
  }
  
  cancelLogin(): void {
    this.showLoginForm = false;
    this.authError = null;
    this.resetLoginForm();
  }
  
  resetLoginForm(): void {
    this.loginForm = {
      username: '',
      password: '',
      email: '',
      displayName: ''
    };
  }
  
  submitLogin(): void {
    this.authError = null;
    
    if (this.isRegistering) {
      const request: RegisterRequest = {
        username: this.loginForm.username,
        password: this.loginForm.password,
        email: this.loginForm.email,
        displayName: this.loginForm.displayName || this.loginForm.username
      };
      
      this.authService.register(request).pipe(
        catchError(err => {
          this.authError = err.error?.error || 'Registration failed';
          return of(null);
        })
      ).subscribe(user => {
        if (user) {
          this.showLoginForm = false;
          this.resetLoginForm();
        }
      });
    } else {
      const request: LoginRequest = {
        username: this.loginForm.username,
        password: this.loginForm.password
      };
      
      this.authService.login(request).pipe(
        catchError(err => {
          this.authError = err.error?.error || 'Invalid username or password';
          return of(null);
        })
      ).subscribe(user => {
        if (user) {
          this.showLoginForm = false;
          this.resetLoginForm();
        }
      });
    }
  }
  
  userLogout(): void {
    this.authService.logout();
    this.orders = [];
    this.positions = [];
    this.totalPortfolioValue = 0;
    this.totalUnrealizedPnL = 0;
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }
  
  loadMarketData(): void {
    // Load market data from exchange backend
    this.http.get<MarketData[]>('http://localhost:8090/api/marketdata').pipe(
      catchError(() => of([]))
    ).subscribe(data => {
      this.marketData = data.slice(0, 20); // Show top 20 in ticker
    });
  }
  
  startMarketDataPolling(): void {
    this.marketDataSubscription = interval(5000).pipe(
      switchMap(() => this.http.get<MarketData[]>('http://localhost:8090/api/marketdata').pipe(
        catchError(() => of([]))
      ))
    ).subscribe(data => {
      this.marketData = data.slice(0, 20);
    });
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
  
  loadSessionInfo(): void {
    this.orderService.getSessionInfo().pipe(
      catchError(err => {
        console.error('Failed to load session info', err);
        return of(null);
      })
    ).subscribe(info => {
      this.sessionInfo = info;
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
  
  submitOrder(): void {
    this.error = null;
    const order: any = {
      clOrdId: 'ORD-' + Date.now(),
      symbol: this.newOrder.symbol,
      side: this.newOrder.side,
      quantity: this.newOrder.quantity,
      price: this.newOrder.price,
      orderType: this.newOrder.orderType,
      status: 'NEW'
    };
    
    this.orderService.createOrder(order).pipe(
      catchError(err => {
        this.error = 'Failed to submit order: ' + (err.message || 'Unknown error');
        return of(null);
      })
    ).subscribe(result => {
      if (result) {
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
  
  logon(): void {
    this.orderService.logon().pipe(
      catchError(err => {
        this.error = 'Failed to logon: ' + (err.message || 'Unknown error');
        return of(null);
      })
    ).subscribe(() => {
      this.loadSessionInfo();
    });
  }
  
  logout(): void {
    this.orderService.logout().pipe(
      catchError(err => {
        this.error = 'Failed to logout: ' + (err.message || 'Unknown error');
        return of(null);
      })
    ).subscribe(() => {
      this.loadSessionInfo();
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
    this.loadSessionInfo();
  }
  
  calculatePositions(): void {
    const positionMap = new Map<string, { qty: number; totalCost: number }>();
    
    // Process filled orders
    const filledOrders = this.orders.filter(o => 
      o.status?.toUpperCase() === 'FILLED' || o.status?.toUpperCase() === 'PARTIALLY_FILLED'
    );
    
    filledOrders.forEach(order => {
      const symbol = order.symbol;
      const qty = order.filledQty || order.quantity;
      const price = order.price;
      const isBuy = order.side === '1';
      
      if (!positionMap.has(symbol)) {
        positionMap.set(symbol, { qty: 0, totalCost: 0 });
      }
      
      const pos = positionMap.get(symbol)!;
      
      if (isBuy) {
        pos.qty += qty;
        pos.totalCost += qty * price;
      } else {
        const avgCost = pos.qty > 0 ? pos.totalCost / pos.qty : 0;
        const sellQty = Math.min(qty, pos.qty);
        pos.totalCost -= sellQty * avgCost;
        pos.qty -= sellQty;
      }
    });
    
    // Convert to Position array
    this.positions = [];
    this.totalPortfolioValue = 0;
    this.totalUnrealizedPnL = 0;
    
    positionMap.forEach((pos, symbol) => {
      if (pos.qty > 0) {
        const md = this.marketData.find(m => m.symbol === symbol);
        const currentPrice = md?.lastPrice || pos.totalCost / pos.qty;
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
          unrealizedPnLPercent
        });
        
        this.totalPortfolioValue += marketValue;
        this.totalUnrealizedPnL += unrealizedPnL;
      }
    });
    
    this.positions.sort((a, b) => b.marketValue - a.marketValue);
  }
  
  getFilledCount(): number {
    return this.orders.filter(o => o.status?.toUpperCase() === 'FILLED').length;
  }
  
  getOpenCount(): number {
    return this.orders.filter(o => ['NEW', 'PARTIALLY_FILLED'].includes(o.status?.toUpperCase() || '')).length;
  }
}
