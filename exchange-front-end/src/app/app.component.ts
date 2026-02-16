import { Component, OnInit, OnDestroy } from '@angular/core';
import { OrderService } from './services/order.service';
import { Order, SessionStatus } from './models/order.model';
import { Subscription, interval, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

interface StockQuote {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface StockCategory {
  name: string;
  stocks: StockQuote[];
  expanded: boolean;
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
  allStocks: StockQuote[] = [];
  
  private baseStocks = [
    // Technology
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', basePrice: 178.50 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', basePrice: 378.90 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', basePrice: 141.80 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology', basePrice: 721.30 },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Technology', basePrice: 485.20 },
    { symbol: 'INTC', name: 'Intel Corp.', sector: 'Technology', basePrice: 43.20 },
    { symbol: 'AMD', name: 'AMD Inc.', sector: 'Technology', basePrice: 165.40 },
    { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology', basePrice: 278.30 },
    { symbol: 'ORCL', name: 'Oracle Corp.', sector: 'Technology', basePrice: 125.60 },
    { symbol: 'CSCO', name: 'Cisco Systems', sector: 'Technology', basePrice: 48.90 },
    { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology', basePrice: 548.20 },
    { symbol: 'IBM', name: 'IBM Corp.', sector: 'Technology', basePrice: 168.40 },
    // Consumer
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer', basePrice: 178.25 },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer', basePrice: 201.45 },
    { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer', basePrice: 165.30 },
    { symbol: 'HD', name: 'Home Depot', sector: 'Consumer', basePrice: 358.90 },
    { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer', basePrice: 98.40 },
    { symbol: 'MCD', name: 'McDonald\'s Corp.', sector: 'Consumer', basePrice: 294.50 },
    { symbol: 'SBUX', name: 'Starbucks Corp.', sector: 'Consumer', basePrice: 92.30 },
    { symbol: 'TGT', name: 'Target Corp.', sector: 'Consumer', basePrice: 142.80 },
    { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer', basePrice: 728.40 },
    // Entertainment
    { symbol: 'DIS', name: 'Walt Disney', sector: 'Entertainment', basePrice: 112.50 },
    { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Entertainment', basePrice: 605.80 },
    { symbol: 'SPOT', name: 'Spotify Tech', sector: 'Entertainment', basePrice: 298.70 },
    { symbol: 'WBD', name: 'Warner Bros.', sector: 'Entertainment', basePrice: 11.20 },
    { symbol: 'PARA', name: 'Paramount Global', sector: 'Entertainment', basePrice: 12.80 },
    // Finance
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finance', basePrice: 195.20 },
    { symbol: 'V', name: 'Visa Inc.', sector: 'Finance', basePrice: 278.60 },
    { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Finance', basePrice: 456.70 },
    { symbol: 'BAC', name: 'Bank of America', sector: 'Finance', basePrice: 35.40 },
    { symbol: 'GS', name: 'Goldman Sachs', sector: 'Finance', basePrice: 468.90 },
    { symbol: 'MS', name: 'Morgan Stanley', sector: 'Finance', basePrice: 94.20 },
    { symbol: 'BLK', name: 'BlackRock Inc.', sector: 'Finance', basePrice: 824.50 },
    { symbol: 'AXP', name: 'American Express', sector: 'Finance', basePrice: 224.30 },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Finance', basePrice: 408.50 },
    // Healthcare
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', basePrice: 156.80 },
    { symbol: 'UNH', name: 'UnitedHealth', sector: 'Healthcare', basePrice: 528.40 },
    { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', basePrice: 27.30 },
    { symbol: 'MRK', name: 'Merck & Co.', sector: 'Healthcare', basePrice: 128.50 },
    { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare', basePrice: 172.80 },
    { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare', basePrice: 782.40 },
    { symbol: 'TMO', name: 'Thermo Fisher', sector: 'Healthcare', basePrice: 568.30 },
    // Consumer Staples
    { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', basePrice: 162.40 },
    { symbol: 'KO', name: 'Coca-Cola Co.', sector: 'Consumer Staples', basePrice: 61.80 },
    { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Staples', basePrice: 172.30 },
    { symbol: 'PM', name: 'Philip Morris', sector: 'Consumer Staples', basePrice: 118.90 },
    { symbol: 'CL', name: 'Colgate-Palmolive', sector: 'Consumer Staples', basePrice: 92.40 },
    // Industrial
    { symbol: 'BA', name: 'Boeing Co.', sector: 'Industrial', basePrice: 178.60 },
    { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrial', basePrice: 342.80 },
    { symbol: 'GE', name: 'General Electric', sector: 'Industrial', basePrice: 168.50 },
    { symbol: 'HON', name: 'Honeywell', sector: 'Industrial', basePrice: 208.30 },
    { symbol: 'UPS', name: 'United Parcel', sector: 'Industrial', basePrice: 148.70 },
    { symbol: 'RTX', name: 'RTX Corp.', sector: 'Industrial', basePrice: 112.40 },
    // Energy
    { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', basePrice: 108.40 },
    { symbol: 'CVX', name: 'Chevron Corp.', sector: 'Energy', basePrice: 152.80 },
    { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy', basePrice: 118.60 },
    { symbol: 'SLB', name: 'Schlumberger', sector: 'Energy', basePrice: 48.90 },
  ];
  
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
  
  constructor(private orderService: OrderService) {}
  
  ngOnInit(): void {
    this.initializeMarketData();
    this.loadOrders();
    this.loadSessionStatus();
    this.startPolling();
    this.startMarketDataSimulation();
  }
  
  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.marketDataSubscription) {
      this.marketDataSubscription.unsubscribe();
    }
  }
  
  initializeMarketData(): void {
    // Initialize all stocks
    this.allStocks = this.baseStocks.map(s => {
      const change = (Math.random() - 0.5) * 4;
      return {
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        price: s.basePrice,
        change: change,
        changePercent: (change / s.basePrice) * 100,
        volume: Math.floor(Math.random() * 50000000) + 1000000
      };
    });
    
    // Group by sector
    const sectors = [...new Set(this.baseStocks.map(s => s.sector))];
    this.stockCategories = sectors.map(sector => ({
      name: sector,
      stocks: this.allStocks.filter(s => s.sector === sector),
      expanded: sector === 'Technology' // Tech expanded by default
    }));
  }
  
  startMarketDataSimulation(): void {
    this.marketDataSubscription = interval(1500).subscribe(() => {
      this.allStocks = this.allStocks.map(stock => {
        const priceChange = (Math.random() - 0.5) * (stock.price * 0.003);
        const newPrice = Math.max(0.01, stock.price + priceChange);
        const newChange = stock.change + priceChange;
        return {
          ...stock,
          price: newPrice,
          change: newChange,
          changePercent: (newChange / (newPrice - newChange)) * 100,
          volume: stock.volume + Math.floor(Math.random() * 10000)
        };
      });
      // Update categories
      this.stockCategories.forEach(cat => {
        cat.stocks = this.allStocks.filter(s => s.sector === cat.name);
      });
    });
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
  
  startPolling(): void {
    this.pollingSubscription = interval(5000).pipe(
      switchMap(() => this.orderService.getOrders().pipe(
        catchError(() => of([]))
      ))
    ).subscribe(orders => {
      this.orders = orders;
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
}
