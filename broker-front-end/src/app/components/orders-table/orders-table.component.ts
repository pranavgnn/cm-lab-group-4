import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Order } from '../../models/order.model';

@Component({
  selector: 'app-orders-table',
  template: `
    <div class="orders-table-container">
      <div class="table-header">
        <div class="header-left">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Orders
          </h3>
          <span class="order-count">{{ orders.length }} total</span>
        </div>
        <div class="header-actions">
          <div class="filter-tabs">
            <button [class.active]="activeFilter === 'all'" (click)="setFilter('all')">All</button>
            <button [class.active]="activeFilter === 'open'" (click)="setFilter('open')">Open</button>
            <button [class.active]="activeFilter === 'filled'" (click)="setFilter('filled')">Filled</button>
            <button [class.active]="activeFilter === 'cancelled'" (click)="setFilter('cancelled')">Cancelled</button>
          </div>
          <button class="btn-export" (click)="exportOrders()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
        </div>
      </div>
      
      <div class="table-wrapper" *ngIf="filteredOrders.length > 0">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Status</th>
              <th>Filled</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let order of filteredOrders; trackBy: trackByOrderId" 
                [class]="getRowClass(order)"
                (click)="selectOrder(order)">
              <td class="cell-symbol">
                <div class="symbol-badge">{{ order.symbol }}</div>
              </td>
              <td class="cell-side">
                <span class="side-badge" [class]="order.side === '1' ? 'buy' : 'sell'">
                  {{ order.side === '1' ? 'BUY' : 'SELL' }}
                </span>
              </td>
              <td class="cell-type">{{ getOrderType(order.orderType) }}</td>
              <td class="cell-qty">{{ order.quantity | number }}</td>
              <td class="cell-price">\${{ order.price | number:'1.2-2' }}</td>
              <td class="cell-status">
                <span class="status-badge" [class]="getStatusClass(order.status)">
                  <span class="status-dot"></span>
                  {{ getStatusText(order.status) }}
                </span>
              </td>
              <td class="cell-filled">
                <div class="fill-progress">
                  <div class="fill-bar" [style.width]="getFillPercent(order) + '%'"></div>
                </div>
                <span class="fill-text">{{ order.filledQty || 0 }}/{{ order.quantity }}</span>
              </td>
              <td class="cell-time">{{ formatTime(order.createdAt) }}</td>
              <td class="cell-actions">
                <button *ngIf="canCancel(order)" class="btn-cancel" (click)="cancelOrder($event, order)" title="Cancel Order">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="empty-state" *ngIf="filteredOrders.length === 0">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <h4>No orders found</h4>
        <p>{{ activeFilter === 'all' ? 'Place your first order to get started' : 'No ' + activeFilter + ' orders' }}</p>
      </div>
    </div>
  `,
  styles: [`
    .orders-table-container {
      background: white;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }
    
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      flex-wrap: wrap;
      gap: 12px;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .header-left h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .header-left h3 svg {
      color: #8b5cf6;
    }
    
    .order-count {
      padding: 4px 10px;
      background: #f3f4f6;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
    }
    
    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .filter-tabs {
      display: flex;
      padding: 4px;
      background: #f3f4f6;
      border-radius: 8px;
    }
    
    .filter-tabs button {
      padding: 6px 12px;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .filter-tabs button:hover {
      color: #374151;
    }
    
    .filter-tabs button.active {
      background: white;
      color: #8b5cf6;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .btn-export {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: 1px solid #e5e7eb;
      background: white;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-export:hover {
      border-color: #8b5cf6;
      color: #8b5cf6;
    }
    
    .table-wrapper {
      overflow-x: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    thead {
      background: #f9fafb;
    }
    
    th {
      padding: 12px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    
    tbody tr {
      border-bottom: 1px solid #f3f4f6;
      cursor: pointer;
      transition: background 0.15s;
    }
    
    tbody tr:hover {
      background: #f9fafb;
    }
    
    tbody tr.new-order {
      animation: highlight 1s ease;
    }
    
    @keyframes highlight {
      0% { background: #f3e8ff; }
      100% { background: transparent; }
    }
    
    td {
      padding: 12px 16px;
      font-size: 13px;
      color: #374151;
    }
    
    .symbol-badge {
      display: inline-block;
      padding: 4px 10px;
      background: #f3f4f6;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      color: #111827;
    }
    
    .side-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
    }
    
    .side-badge.buy {
      background: #dcfce7;
      color: #16a34a;
    }
    
    .side-badge.sell {
      background: #fee2e2;
      color: #dc2626;
    }
    
    .cell-price, .cell-qty {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-weight: 600;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    
    .status-badge.new {
      background: #dbeafe;
      color: #2563eb;
    }
    
    .status-badge.partial {
      background: #fef3c7;
      color: #d97706;
    }
    
    .status-badge.filled {
      background: #dcfce7;
      color: #16a34a;
    }
    
    .status-badge.cancelled {
      background: #f3f4f6;
      color: #6b7280;
    }
    
    .status-badge.rejected {
      background: #fee2e2;
      color: #dc2626;
    }
    
    .fill-progress {
      width: 60px;
      height: 4px;
      background: #e5e7eb;
      border-radius: 2px;
      margin-bottom: 4px;
    }
    
    .fill-bar {
      height: 100%;
      background: linear-gradient(90deg, #8b5cf6, #a78bfa);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    
    .fill-text {
      font-size: 11px;
      color: #9ca3af;
      font-family: 'SF Mono', 'Consolas', monospace;
    }
    
    .cell-time {
      font-size: 11px;
      color: #9ca3af;
      white-space: nowrap;
    }
    
    .cell-actions {
      display: flex;
      gap: 6px;
    }
    
    .btn-cancel, .btn-modify {
      padding: 6px;
      border: 1px solid #e5e7eb;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .btn-cancel:hover {
      background: #fee2e2;
      border-color: #ef4444;
    }
    
    .empty-state {
      padding: 60px 20px;
      text-align: center;
      color: #9ca3af;
    }
    
    .empty-state svg {
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    .empty-state h4 {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 600;
      color: #6b7280;
    }
    
    .empty-state p {
      margin: 0;
      font-size: 13px;
    }
  `]
})
export class OrdersTableComponent {
  @Input() orders: Order[] = [];
  
  @Output() orderSelect = new EventEmitter<Order>();
  @Output() orderCancel = new EventEmitter<Order>();
  @Output() export = new EventEmitter<void>();
  
  activeFilter: 'all' | 'open' | 'filled' | 'cancelled' = 'all';
  
  get filteredOrders(): Order[] {
    switch (this.activeFilter) {
      case 'open':
        return this.orders.filter(o => {
          const s = (o.status || '').toUpperCase();
          return s === '0' || s === '1' || s === 'A' || s === 'NEW' || s === 'PARTIALLY_FILLED' || s === 'PENDING_NEW' || s === 'PENDING_CANCEL';
        });
      case 'filled':
        return this.orders.filter(o => {
          const s = (o.status || '').toUpperCase();
          return s === '2' || s === 'FILLED';
        });
      case 'cancelled':
        return this.orders.filter(o => {
          const s = (o.status || '').toUpperCase();
          return s === '4' || s === '8' || s === 'C' || s === 'CANCELED' || s === 'CANCELLED' || s === 'REJECTED' || s === 'EXPIRED';
        });
      default:
        return this.orders;
    }
  }
  
  setFilter(filter: 'all' | 'open' | 'filled' | 'cancelled'): void {
    this.activeFilter = filter;
  }
  
  getOrderType(type: string): string {
    switch (type) {
      case '1': return 'Market';
      case '2': return 'Limit';
      case '3': return 'Stop';
      case '4': return 'Stop Limit';
      default: return type;
    }
  }
  
  getStatusText(status: string): string {
    if (!status) return 'Unknown';
    switch (status.toUpperCase()) {
      case '0': case 'NEW': return 'New';
      case '1': case 'PARTIALLY_FILLED': return 'Partial';
      case '2': case 'FILLED': return 'Filled';
      case '4': case 'CANCELED': case 'CANCELLED': return 'Cancelled';
      case '8': case 'REJECTED': return 'Rejected';
      case 'A': case 'PENDING_NEW': return 'Pending';
      case 'PENDING_CANCEL': return 'Pnd Cancel';
      case 'C': case 'EXPIRED': return 'Expired';
      default: return status;
    }
  }
  
  getStatusClass(status: string): string {
    if (!status) return '';
    switch (status.toUpperCase()) {
      case '0': case 'A': case 'NEW': case 'PENDING_NEW': return 'new';
      case '1': case 'PARTIALLY_FILLED': return 'partial';
      case '2': case 'FILLED': return 'filled';
      case '4': case 'C': case 'CANCELED': case 'CANCELLED': case 'EXPIRED': return 'cancelled';
      case '8': case 'REJECTED': return 'rejected';
      case 'PENDING_CANCEL': return 'partial';
      default: return '';
    }
  }
  
  getRowClass(_order: Order): string {
    return '';
  }
  
  getFillPercent(order: Order): number {
    if (!order.quantity) return 0;
    return ((order.filledQty || 0) / order.quantity) * 100;
  }
  
  canCancel(order: Order): boolean {
    const s = (order.status || '').toUpperCase();
    return s === '0' || s === '1' || s === 'A' || s === 'NEW' || s === 'PARTIALLY_FILLED' || s === 'PENDING_NEW';
  }
  
  canModify(order: Order): boolean {
    const s = (order.status || '').toUpperCase();
    return s === '0' || s === 'A' || s === 'NEW' || s === 'PENDING_NEW';
  }
  
  formatTime(time: string | Date | any[]): string {
    if (!time) return '-';
    let date: Date;
    if (Array.isArray(time)) {
      date = new Date(time[0], time[1] - 1, time[2], time[3] || 0, time[4] || 0, time[5] || 0);
    } else {
      date = new Date(time);
    }
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  
  trackByOrderId(index: number, order: Order): string {
    return order.id?.toString() || index.toString();
  }
  
  selectOrder(order: Order): void {
    this.orderSelect.emit(order);
  }
  
  cancelOrder(event: Event, order: Order): void {
    event.stopPropagation();
    this.orderCancel.emit(order);
  }
  
  exportOrders(): void {
    this.export.emit();
  }
}
