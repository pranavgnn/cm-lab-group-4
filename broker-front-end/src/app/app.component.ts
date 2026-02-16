import { Component, OnInit, OnDestroy } from '@angular/core';
import { OrderService } from './services/order.service';
import { Order, SessionInfo } from './models/order.model';
import { Subscription, interval, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

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
  
  // New order form
  newOrder = {
    symbol: 'AAPL',
    side: '1',
    quantity: 100,
    price: 150.00,
    orderType: 'LIMIT',
    timeInForce: 'DAY'
  };
  
  private pollingSubscription?: Subscription;
  
  constructor(private orderService: OrderService) {}
  
  ngOnInit(): void {
    this.loadOrders();
    this.loadSessionInfo();
    this.startPolling();
  }
  
  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
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
}
