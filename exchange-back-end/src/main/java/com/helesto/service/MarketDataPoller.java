package com.helesto.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import javax.enterprise.context.ApplicationScoped;
import javax.inject.Inject;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.helesto.socket.WebSocketAggregator;

/**
 * G3-M1: Market Data Poller
 * - Flat-file reader with configurable polling interval
 * - Delta updates detection
 * - Efficient broadcast to subscribers
 * - Simulated price updates for demo
 */
@ApplicationScoped
public class MarketDataPoller {

    private static final Logger LOG = LoggerFactory.getLogger(MarketDataPoller.class);
    
    @Inject
    ReferenceDataService referenceDataService;
    
    @Inject
    WebSocketAggregator webSocketAggregator;
    
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final Map<String, MarketDataSnapshot> lastSnapshots = new ConcurrentHashMap<>();
    private final List<MarketDataListener> listeners = new CopyOnWriteArrayList<>();
    
    // Configuration
    private Path marketDataFile;
    private long pollIntervalMs = 1000; // 1 second default
    private boolean simulationMode = true; // Enable price simulation
    private final Random random = new Random();
    
    // Base prices for simulation
    private final Map<String, Double> basePrices = new ConcurrentHashMap<>();
    
    @PostConstruct
    public void init() {
        LOG.info("Market Data Poller initializing...");
        initializeBasePrices();
        
        // Start simulation/polling
        if (simulationMode) {
            scheduler.scheduleAtFixedRate(this::simulatePriceUpdates, 
                    1000, pollIntervalMs, TimeUnit.MILLISECONDS);
            LOG.info("Market Data Poller started in SIMULATION mode with {}ms interval", pollIntervalMs);
        } else {
            scheduler.scheduleAtFixedRate(this::pollMarketDataFile, 
                    1000, pollIntervalMs, TimeUnit.MILLISECONDS);
            LOG.info("Market Data Poller started in FILE mode");
        }
    }
    
    @PreDestroy
    public void shutdown() {
        scheduler.shutdown();
        try {
            scheduler.awaitTermination(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        LOG.info("Market Data Poller shutdown");
    }
    
    private void initializeBasePrices() {
        // Technology
        basePrices.put("AAPL", 178.50);
        basePrices.put("MSFT", 378.90);
        basePrices.put("GOOGL", 141.80);
        basePrices.put("NVDA", 721.30);
        basePrices.put("META", 485.20);
        basePrices.put("INTC", 42.85);
        basePrices.put("AMD", 165.40);
        basePrices.put("CRM", 275.30);
        basePrices.put("ORCL", 118.65);
        basePrices.put("CSCO", 48.90);
        basePrices.put("ADBE", 570.25);
        basePrices.put("IBM", 168.40);
        
        // Consumer
        basePrices.put("AMZN", 178.25);
        basePrices.put("TSLA", 201.45);
        basePrices.put("WMT", 165.80);
        basePrices.put("HD", 345.60);
        basePrices.put("NKE", 98.75);
        basePrices.put("MCD", 285.90);
        basePrices.put("SBUX", 92.30);
        basePrices.put("TGT", 138.45);
        basePrices.put("COST", 715.20);
        
        // Entertainment
        basePrices.put("DIS", 95.80);
        basePrices.put("NFLX", 485.70);
        basePrices.put("SPOT", 238.50);
        basePrices.put("WBD", 8.45);
        basePrices.put("PARA", 12.35);
        
        // Finance
        basePrices.put("JPM", 195.20);
        basePrices.put("V", 278.60);
        basePrices.put("MA", 458.30);
        basePrices.put("BAC", 35.75);
        basePrices.put("GS", 425.80);
        basePrices.put("MS", 92.45);
        basePrices.put("BLK", 785.60);
        basePrices.put("AXP", 215.30);
        basePrices.put("BRK.B", 385.90);
        
        // Healthcare
        basePrices.put("JNJ", 156.80);
        basePrices.put("UNH", 525.40);
        basePrices.put("PFE", 27.35);
        basePrices.put("MRK", 125.60);
        basePrices.put("ABBV", 168.90);
        basePrices.put("LLY", 765.30);
        basePrices.put("TMO", 535.80);
        
        // Consumer Staples
        basePrices.put("PG", 158.45);
        basePrices.put("KO", 58.90);
        basePrices.put("PEP", 168.30);
        basePrices.put("PM", 95.60);
        basePrices.put("CL", 82.45);
        
        // Industrial
        basePrices.put("BA", 205.80);
        basePrices.put("CAT", 295.60);
        basePrices.put("GE", 155.40);
        basePrices.put("HON", 198.75);
        basePrices.put("UPS", 148.30);
        basePrices.put("RTX", 98.65);
        basePrices.put("LMT", 475.30);
        basePrices.put("DE", 418.60);
        
        // Energy
        basePrices.put("XOM", 105.40);
        basePrices.put("CVX", 148.90);
        basePrices.put("COP", 115.30);
        basePrices.put("SLB", 48.75);
        basePrices.put("EOG", 125.40);
        basePrices.put("MPC", 165.80);
        basePrices.put("VLO", 148.20);
        
        // Telecommunications
        basePrices.put("T", 17.85);
        basePrices.put("VZ", 41.20);
        basePrices.put("TMUS", 168.45);
        basePrices.put("CMCSA", 42.80);
        basePrices.put("CHTR", 295.60);
        
        // Materials
        basePrices.put("LIN", 458.90);
        basePrices.put("FCX", 42.65);
        basePrices.put("NEM", 38.45);
        basePrices.put("SHW", 328.70);
        basePrices.put("DOW", 55.80);
        basePrices.put("APD", 285.40);
        
        // Real Estate
        basePrices.put("PLD", 128.45);
        basePrices.put("AMT", 215.60);
        basePrices.put("EQIX", 825.30);
        basePrices.put("SPG", 152.80);
        basePrices.put("O", 58.45);
        
        // Utilities
        basePrices.put("NEE", 78.90);
        basePrices.put("DUK", 102.45);
        basePrices.put("SO", 72.60);
        basePrices.put("D", 52.80);
        basePrices.put("AEP", 88.35);
        
        LOG.info("Initialized {} base prices for simulation", basePrices.size());
    }
    
    /**
     * Simulate price updates with realistic movement
     */
    private void simulatePriceUpdates() {
        try {
            for (Map.Entry<String, Double> entry : basePrices.entrySet()) {
                String symbol = entry.getKey();
                double basePrice = entry.getValue();
                
                // Get current price or start with base
                MarketDataSnapshot last = lastSnapshots.get(symbol);
                double currentPrice = last != null ? last.lastPrice : basePrice;
                
                // Random walk with mean reversion
                double volatility = 0.001 + random.nextDouble() * 0.002; // 0.1% to 0.3%
                double drift = (basePrice - currentPrice) / basePrice * 0.01; // Mean reversion
                double change = currentPrice * (drift + (random.nextGaussian() * volatility));
                
                double newPrice = Math.max(0.01, currentPrice + change);
                newPrice = Math.round(newPrice * 100.0) / 100.0; // Round to 2 decimals
                
                // Calculate spread (tighter for liquid stocks)
                double spreadPercent = 0.0001 + random.nextDouble() * 0.0005;
                double halfSpread = newPrice * spreadPercent;
                double bid = newPrice - halfSpread;
                double ask = newPrice + halfSpread;
                
                // Calculate change from base (open)
                double priceChange = newPrice - basePrice;
                double changePercent = (priceChange / basePrice) * 100;
                
                // Create snapshot
                MarketDataSnapshot snapshot = new MarketDataSnapshot();
                snapshot.symbol = symbol;
                snapshot.lastPrice = newPrice;
                snapshot.bid = Math.round(bid * 100.0) / 100.0;
                snapshot.ask = Math.round(ask * 100.0) / 100.0;
                snapshot.open = basePrice;
                snapshot.high = last != null ? Math.max(last.high, newPrice) : newPrice;
                snapshot.low = last != null ? Math.min(last.low, newPrice) : newPrice;
                snapshot.change = Math.round(priceChange * 100.0) / 100.0;
                snapshot.changePercent = Math.round(changePercent * 100.0) / 100.0;
                snapshot.volume = last != null ? last.volume + random.nextInt(1000) : random.nextInt(100000);
                snapshot.timestamp = System.currentTimeMillis();
                
                // Check for delta update
                if (isDeltaUpdate(symbol, snapshot)) {
                    lastSnapshots.put(symbol, snapshot);
                    notifyListeners(snapshot);
                    
                    // Broadcast via WebSocket
                    try {
                        webSocketAggregator.broadcastMarketData(
                            symbol, newPrice, snapshot.bid, snapshot.ask, 
                            snapshot.change, snapshot.changePercent
                        );
                    } catch (Exception e) {
                        // WebSocket may not be initialized yet
                    }
                    
                    // Update reference data service
                    referenceDataService.updateMarketData(symbol, newPrice, snapshot.bid, snapshot.ask);
                }
            }
        } catch (Exception e) {
            LOG.error("Error in price simulation: {}", e.getMessage());
        }
    }
    
    /**
     * Poll market data from flat file
     */
    private void pollMarketDataFile() {
        if (marketDataFile == null || !Files.exists(marketDataFile)) {
            return;
        }
        
        try (BufferedReader reader = Files.newBufferedReader(marketDataFile)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty() || line.startsWith("#")) continue;
                
                MarketDataSnapshot snapshot = parseMarketDataLine(line);
                if (snapshot != null && isDeltaUpdate(snapshot.symbol, snapshot)) {
                    lastSnapshots.put(snapshot.symbol, snapshot);
                    notifyListeners(snapshot);
                }
            }
        } catch (IOException e) {
            LOG.error("Error reading market data file: {}", e.getMessage());
        }
    }
    
    private MarketDataSnapshot parseMarketDataLine(String line) {
        try {
            // Expected format: SYMBOL,LAST,BID,ASK,VOLUME
            String[] parts = line.split(",");
            if (parts.length < 4) return null;
            
            MarketDataSnapshot snapshot = new MarketDataSnapshot();
            snapshot.symbol = parts[0].trim();
            snapshot.lastPrice = Double.parseDouble(parts[1]);
            snapshot.bid = Double.parseDouble(parts[2]);
            snapshot.ask = Double.parseDouble(parts[3]);
            if (parts.length > 4) {
                snapshot.volume = Long.parseLong(parts[4]);
            }
            snapshot.timestamp = System.currentTimeMillis();
            
            return snapshot;
        } catch (Exception e) {
            LOG.warn("Error parsing market data line: {}", line);
            return null;
        }
    }
    
    private boolean isDeltaUpdate(String symbol, MarketDataSnapshot newSnapshot) {
        MarketDataSnapshot last = lastSnapshots.get(symbol);
        if (last == null) return true;
        
        // Check if price changed meaningfully (more than 0.001%)
        double priceChange = Math.abs(newSnapshot.lastPrice - last.lastPrice);
        return priceChange / last.lastPrice > 0.00001;
    }
    
    private void notifyListeners(MarketDataSnapshot snapshot) {
        for (MarketDataListener listener : listeners) {
            try {
                listener.onMarketData(snapshot);
            } catch (Exception e) {
                LOG.error("Error notifying listener: {}", e.getMessage());
            }
        }
    }
    
    // ================== Public API ==================
    
    public void setMarketDataFile(String path) {
        this.marketDataFile = Paths.get(path);
    }
    
    public void setPollInterval(long intervalMs) {
        this.pollIntervalMs = intervalMs;
    }
    
    public void setSimulationMode(boolean enabled) {
        this.simulationMode = enabled;
    }
    
    public MarketDataSnapshot getLatestSnapshot(String symbol) {
        return lastSnapshots.get(symbol);
    }
    
    public Collection<MarketDataSnapshot> getAllSnapshots() {
        return Collections.unmodifiableCollection(lastSnapshots.values());
    }
    
    public void addListener(MarketDataListener listener) {
        listeners.add(listener);
    }
    
    public void removeListener(MarketDataListener listener) {
        listeners.remove(listener);
    }
    
    // ================== Inner Classes ==================
    
    public static class MarketDataSnapshot {
        public String symbol;
        public double lastPrice;
        public double bid;
        public double ask;
        public double open;
        public double high;
        public double low;
        public double change;
        public double changePercent;
        public long volume;
        public long timestamp;
        
        @Override
        public String toString() {
            return String.format("%s: %.2f (%.2f/%.2f) %+.2f (%.2f%%)", 
                    symbol, lastPrice, bid, ask, change, changePercent);
        }
    }
    
    public interface MarketDataListener {
        void onMarketData(MarketDataSnapshot snapshot);
    }
}
