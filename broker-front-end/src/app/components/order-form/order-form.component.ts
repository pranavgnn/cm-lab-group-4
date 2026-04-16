import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { LiveQuote } from '../../services/live-market.service';

export interface OrderFormData {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  timeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK';
  stopPrice?: number;
}

@Component({
  selector: 'app-order-form',
  template: `
    <div class="order-form-card" [class.is-sell]="formData.side === 'SELL'">
      <!-- Header -->
      <div class="header">
        <div class="title-wrap">
          <div class="action-badge" [class.sell]="formData.side === 'SELL'">
            {{ formData.side === 'BUY' ? 'BUY' : 'SELL' }}
          </div>
          <h3>Execution Form</h3>
        </div>
        
        <div class="live-info" *ngIf="symbol">
          <div class="symbol">{{ symbol }}</div>
          <div class="price" [class.up]="(quote?.changePercent || 0) >= 0" [class.down]="(quote?.changePercent || 0) < 0">
            \${{ quote?.price | number:'1.2-2' }}
          </div>
          <div class="indicator">
            <span class="dot"></span>
            Live
          </div>
        </div>
      </div>

      <!-- Main Toggle -->
      <div class="side-toggle">
        <button [class.active]="formData.side === 'BUY'" (click)="setSide('BUY')">Purchase</button>
        <button [class.active]="formData.side === 'SELL'" (click)="setSide('SELL')">Liquidation</button>
      </div>

      <!-- Execution Grid -->
      <div class="form-grid">
        <div class="form-item span-all">
          <label>Order Type</label>
          <div class="grid-options">
            <button *ngFor="let type of orderTypes" 
                    [class.active]="formData.orderType === type.value"
                    (click)="setOrderType(type.value)">
              {{ type.label }}
            </button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-item">
            <label>Ticker</label>
            <input type="text" [(ngModel)]="formData.symbol" (input)="onSymbolChange()" placeholder="SYM" spellcheck="false">
          </div>
          <div class="form-item">
            <label>Shares</label>
            <div class="qty-control">
              <button (click)="adjustQuantity(-1)">-</button>
              <input type="number" [(ngModel)]="formData.quantity" min="1">
              <button (click)="adjustQuantity(1)">+</button>
            </div>
          </div>
        </div>

        <div class="form-item span-all">
          <label>Allocation Shortcut</label>
          <div class="chip-row">
            <button *ngFor="let p of quickPercents" (click)="applyPercentOfBalance(p)">{{ p }}%</button>
          </div>
        </div>

        <div class="price-grid" *ngIf="formData.orderType !== 'MARKET'">
          <div class="form-item" *ngIf="formData.orderType === 'LIMIT' || formData.orderType === 'STOP_LIMIT'">
            <label>Limit Price (\$)</label>
            <div class="input-with-action">
              <span class="symbol-prefix">$</span>
              <input type="number" [(ngModel)]="formData.price" (input)="onPriceInput()" step="0.01">
              <button class="auto-btn" (click)="setMarketPrice()" [class.synced]="!userModifiedPrice" title="Sync with Market">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="form-item" *ngIf="formData.orderType === 'STOP' || formData.orderType === 'STOP_LIMIT'">
            <label>Stop Target (\$)</label>
            <div class="input-with-action">
              <span class="symbol-prefix">$</span>
              <input type="number" [(ngModel)]="formData.stopPrice" (input)="onStopPriceInput()" step="0.01">
            </div>
          </div>
        </div>

        <div class="form-item span-all">
          <label>Time In Force</label>
          <div class="segmented-control">
            <button *ngFor="let tif of timeInForceOptions" 
                    [class.active]="formData.timeInForce === tif.value"
                    (click)="setTimeInForce(tif.value)">
              {{ tif.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Simple Summary -->
      <div class="summary-section">
        <div class="row">
          <span>Est. Value</span>
          <span class="value">\${{ getEstimatedTotal() | number:'1.2-2' }}</span>
        </div>
        <div class="row">
          <span>Available Cash</span>
          <span class="value">\${{ balance | number:'1.2-2' }}</span>
        </div>
        <div class="meter-bar">
          <div class="fill" [style.width]="(getEstimatedTotal() / balance * 100) + '%'"
               [class.over]="getEstimatedTotal() > balance"></div>
        </div>
      </div>

      <!-- Execute Action -->
      <button class="submit-action" 
              [disabled]="!isFormValid() || submitting" 
              (click)="submitOrder()">
        <span *ngIf="!submitting">
          {{ formData.side === 'BUY' ? 'Execute Buy Order' : 'Execute Sell Order' }}
        </span>
        <span *ngIf="submitting" class="loading-state">
          <span class="spinner"></span>
          Processing...
        </span>
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      color: #0f172a;
    }

    .order-form-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transition: all 0.2s ease;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .action-badge {
      background: #f3f4f6;
      color: #10b981;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .action-badge.sell {
      color: #ef4444;
    }

    .header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
    }

    .live-info {
      text-align: right;
    }
    .live-info .symbol {
      font-size: 12px;
      font-weight: 600;
      color: #8b5cf6;
    }
    .live-info .price {
      font-family: 'SF Mono', monospace;
      font-weight: 700;
      font-size: 15px;
    }
    .price.up { color: #10b981; }
    .price.down { color: #ef4444; }

    .indicator {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      justify-content: flex-end;
    }
    .dot {
      width: 5px;
      height: 5px;
      background: #10b981;
      border-radius: 50%;
      animation: blink 1s infinite alternate;
    }

    @keyframes blink { from { opacity: 0.4; } to { opacity: 1; } }

    /* Controls */
    .side-toggle {
      display: flex;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .side-toggle button {
      flex: 1;
      border: none;
      background: none;
      padding: 10px;
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .side-toggle button.active {
      background: #ffffff;
      color: #8b5cf6;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .is-sell .side-toggle button.active {
      color: #ef4444;
    }

    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .span-all { width: 100%; }
    
    label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      display: block;
    }

    .grid-options {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }
    .grid-options button, .segmented-control button {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 4px;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s;
    }
    .grid-options button:hover, .segmented-control button:hover {
      border-color: #cbd5e1;
      background: #f8fafc;
    }
    .grid-options button.active, .segmented-control button.active {
      background: #f5f3ff;
      border-color: #8b5cf6;
      color: #8b5cf6;
    }
    .is-sell .grid-options button.active {
      background: #fef2f2;
      border-color: #ef4444;
      color: #ef4444;
    }

    .form-row {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 12px;
    }

    input {
      width: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      outline: none;
      transition: all 0.2s;
    }
    input:focus {
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
    }

    .qty-control {
      display: flex;
      gap: 4px;
    }
    .qty-control button {
      width: 38px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
    }
    .qty-control button:hover { background: #f1f5f9; }

    .chip-row {
      display: flex;
      gap: 6px;
    }
    .chip-row button {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
    }
    .chip-row button:hover { 
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .price-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .input-with-action {
      position: relative;
      display: flex;
      align-items: center;
    }
    .symbol-prefix {
      position: absolute;
      left: 12px;
      font-weight: 700;
      color: #94a3b8;
    }
    .input-with-action input { padding-left: 24px; padding-right: 36px; }

    .auto-btn {
      position: absolute;
      right: 6px;
      background: #f1f5f9;
      border: none;
      color: #64748b;
      padding: 6px;
      border-radius: 6px;
      cursor: pointer;
    }
    .auto-btn.synced {
      background: #10b98115;
      color: #10b981;
    }

    .segmented-control {
      display: flex;
      gap: 4px;
    }
    .segmented-control button { flex: 1; }

    /* Summary */
    .summary-section {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #f1f5f9;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
    }
    .row .value {
      font-weight: 700;
      color: #1e293b;
    }

    .meter-bar {
      height: 4px;
      background: #f1f5f9;
      border-radius: 10px;
      overflow: hidden;
      margin-top: 8px;
    }
    .fill {
      height: 100%;
      background: #8b5cf6;
      transition: width 0.3s ease;
    }
    .fill.over { background: #ef4444; }

    /* Action */
    .submit-action {
      width: 100%;
      height: 52px;
      background: #8b5cf6;
      color: white;
      border: none;
      border-radius: 12px;
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
      margin-top: 24px;
      transition: all 0.2s;
    }
    .submit-action:hover:not(:disabled) {
      background: #7c3aed;
      box-shadow: 0 4px 6px -1px rgba(139, 92, 246, 0.4);
    }
    .submit-action:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .is-sell .submit-action { background: #ef4444; }
    .is-sell .submit-action:hover:not(:disabled) { background: #dc2626; }

    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  `]
})
export class OrderFormComponent implements OnChanges {
  @Input() symbol: string = 'AAPL';
  @Input() quote: LiveQuote | null = null;
  @Input() balance: number = 100000;
  
  @Output() orderSubmit = new EventEmitter<OrderFormData>();
  
  formData: OrderFormData = {
    symbol: 'AAPL',
    side: 'BUY',
    quantity: 100,
    price: 0,
    orderType: 'LIMIT',
    timeInForce: 'DAY'
  };
  
  submitting = false;
  symbolValid = false;
  userModifiedPrice = false;
  userModifiedStopPrice = false;
  
  quickPercents = [25, 50, 75, 100];
  
  orderTypes = [
    { value: 'MARKET', label: 'Market' },
    { value: 'LIMIT', label: 'Limit' },
    { value: 'STOP', label: 'Stop' },
    { value: 'STOP_LIMIT', label: 'Stop Lmt' }
  ];
  
  timeInForceOptions = [
    { value: 'DAY', label: 'DAY' },
    { value: 'GTC', label: 'GTC' },
    { value: 'IOC', label: 'IOC' },
    { value: 'FOK', label: 'FOK' }
  ];
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['symbol'] && this.symbol) {
      this.formData.symbol = this.symbol;
      this.userModifiedPrice = false;
      this.userModifiedStopPrice = false;
      this.validateSymbol();
    }
    
    if (changes['quote'] && this.quote) {
      if (!this.userModifiedPrice || this.formData.price === 0) {
        this.formData.price = this.quote.price;
      }
      if (!this.userModifiedStopPrice && (this.formData.orderType === 'STOP' || this.formData.orderType === 'STOP_LIMIT')) {
        if (!this.formData.stopPrice || this.formData.stopPrice === 0) {
          this.formData.stopPrice = this.quote.price;
        }
      }
    }
  }
  
  setSide(side: 'BUY' | 'SELL'): void {
    this.formData.side = side;
  }
  
  setOrderType(type: any): void {
    this.formData.orderType = type;
    if (type !== 'STOP' && type !== 'STOP_LIMIT') {
      this.formData.stopPrice = undefined;
      this.userModifiedStopPrice = false;
    } else if (!this.formData.stopPrice && this.quote) {
      this.formData.stopPrice = this.quote.price;
    }
  }
  
  setTimeInForce(tif: any): void {
    this.formData.timeInForce = tif;
  }
  
  adjustQuantity(delta: number): void {
    const newQty = this.formData.quantity + delta;
    if (newQty >= 1) {
      this.formData.quantity = newQty;
    }
  }

  applyPercentOfBalance(percent: number): void {
    const price = this.formData.orderType === 'MARKET' ? (this.quote?.price || 1) : (this.formData.price || 1);
    const targetValue = (this.balance * percent) / 100;
    this.formData.quantity = Math.floor(targetValue / price) || 1;
  }
  
  onPriceInput(): void {
    this.userModifiedPrice = true;
  }
  
  onStopPriceInput(): void {
    this.userModifiedStopPrice = true;
  }
  
  setMarketPrice(): void {
    if (this.quote) {
      this.formData.price = this.quote.price;
      this.userModifiedPrice = false;
    }
  }
  
  onSymbolChange(): void {
    this.formData.symbol = this.formData.symbol.toUpperCase();
    this.validateSymbol();
  }
  
  validateSymbol(): void {
    const validSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'AMD', 'JPM', 'V', 'JNJ', 'WMT', 'XOM', 'DIS', 'NFLX', 'PYPL', 'INTC', 'CRM', 'ORCL', 'ADBE', 'BAC', 'GS', 'MA', 'PFE', 'UNH', 'HD', 'NKE', 'MCD', 'SBUX', 'COST'];
    this.symbolValid = validSymbols.includes(this.formData.symbol);
  }
  
  getEstimatedTotal(): number {
    const price = this.formData.orderType === 'MARKET' ? (this.quote?.price || 0) : this.formData.price;
    return this.formData.quantity * price;
  }
  
  isFormValid(): boolean {
    if (!this.formData.symbol || !this.symbolValid) return false;
    if (this.formData.quantity < 1) return false;
    if (this.formData.orderType !== 'MARKET' && this.formData.price <= 0) return false;
    if ((this.formData.orderType === 'STOP' || this.formData.orderType === 'STOP_LIMIT') && (!this.formData.stopPrice || this.formData.stopPrice <= 0)) return false;
    if (this.getEstimatedTotal() > this.balance && this.formData.side === 'BUY') return false;
    return true;
  }
  
  submitOrder(): void {
    if (!this.isFormValid()) return;
    this.submitting = true;
    this.orderSubmit.emit({ ...this.formData });
    setTimeout(() => { this.submitting = false; }, 1000);
  }
}
