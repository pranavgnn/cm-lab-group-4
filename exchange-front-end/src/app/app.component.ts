import { Component, OnInit, OnDestroy } from '@angular/core';
import { OrderService } from './services/order.service';
import { Order, SessionStatus } from './models/order.model';
import { Subscription, interval, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

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
  
  private pollingSubscription?: Subscription;
  
  constructor(private orderService: OrderService) {}
  
  ngOnInit(): void {
    this.loadOrders();
    this.loadSessionStatus();
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
}
