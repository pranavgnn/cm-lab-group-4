package com.helesto.service;

import javax.annotation.PostConstruct;
import javax.enterprise.context.ApplicationScoped;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * G3-M5: Reference Data + DB Init Service
 * - Security Master / Customer Master / static ref files
 * - Cached lookup APIs used by Order validation and UI filters
 * - Data quality checks
 */
@ApplicationScoped
public class ReferenceDataService {

    private static final Logger LOG = LoggerFactory.getLogger(ReferenceDataService.class);
    
    // Security Master cache
    private final Map<String, Security> securityCache = new ConcurrentHashMap<>();
    
    // Customer Master cache
    private final Map<String, Customer> customerCache = new ConcurrentHashMap<>();
    
    // Market data cache (latest prices)
    private final Map<String, MarketData> marketDataCache = new ConcurrentHashMap<>();
    
    @PostConstruct
    public void init() {
        LOG.info("Initializing Reference Data Service...");
        loadSecurityMaster();
        loadCustomerMaster();
        initializeMarketData();
        LOG.info("Reference Data Service initialized with {} securities, {} customers", 
                securityCache.size(), customerCache.size());
    }
    
    /**
     * Load Security Master data
     */
    private void loadSecurityMaster() {
        // Technology
        addSecurity("AAPL", "Apple Inc.", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("MSFT", "Microsoft Corp.", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("GOOGL", "Alphabet Inc.", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("NVDA", "NVIDIA Corp.", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("META", "Meta Platforms", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("INTC", "Intel Corp.", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("AMD", "AMD Inc.", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("CRM", "Salesforce Inc.", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("ORCL", "Oracle Corp.", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("CSCO", "Cisco Systems", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("ADBE", "Adobe Inc.", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        addSecurity("IBM", "IBM Corp.", "EQUITY", "TECHNOLOGY", 0.01, 1, 10000000, true);
        
        // Consumer
        addSecurity("AMZN", "Amazon.com Inc.", "EQUITY", "CONSUMER", 0.01, 1, 10000000, true);
        addSecurity("TSLA", "Tesla Inc.", "EQUITY", "CONSUMER", 0.01, 1, 10000000, true);
        addSecurity("WMT", "Walmart Inc.", "EQUITY", "CONSUMER", 0.01, 1, 10000000, true);
        addSecurity("HD", "Home Depot", "EQUITY", "CONSUMER", 0.01, 1, 10000000, true);
        addSecurity("NKE", "Nike Inc.", "EQUITY", "CONSUMER", 0.01, 1, 10000000, true);
        addSecurity("MCD", "McDonald's Corp.", "EQUITY", "CONSUMER", 0.01, 1, 10000000, true);
        addSecurity("SBUX", "Starbucks Corp.", "EQUITY", "CONSUMER", 0.01, 1, 10000000, true);
        addSecurity("TGT", "Target Corp.", "EQUITY", "CONSUMER", 0.01, 1, 10000000, true);
        addSecurity("COST", "Costco Wholesale", "EQUITY", "CONSUMER", 0.01, 1, 10000000, true);
        
        // Entertainment
        addSecurity("DIS", "Walt Disney", "EQUITY", "ENTERTAINMENT", 0.01, 1, 10000000, true);
        addSecurity("NFLX", "Netflix Inc.", "EQUITY", "ENTERTAINMENT", 0.01, 1, 10000000, true);
        addSecurity("SPOT", "Spotify Tech", "EQUITY", "ENTERTAINMENT", 0.01, 1, 10000000, true);
        addSecurity("WBD", "Warner Bros.", "EQUITY", "ENTERTAINMENT", 0.01, 1, 10000000, true);
        addSecurity("PARA", "Paramount Global", "EQUITY", "ENTERTAINMENT", 0.01, 1, 10000000, true);
        
        // Finance
        addSecurity("JPM", "JPMorgan Chase", "EQUITY", "FINANCE", 0.01, 1, 10000000, true);
        addSecurity("V", "Visa Inc.", "EQUITY", "FINANCE", 0.01, 1, 10000000, true);
        addSecurity("MA", "Mastercard Inc.", "EQUITY", "FINANCE", 0.01, 1, 10000000, true);
        addSecurity("BAC", "Bank of America", "EQUITY", "FINANCE", 0.01, 1, 10000000, true);
        addSecurity("GS", "Goldman Sachs", "EQUITY", "FINANCE", 0.01, 1, 10000000, true);
        addSecurity("MS", "Morgan Stanley", "EQUITY", "FINANCE", 0.01, 1, 10000000, true);
        addSecurity("BLK", "BlackRock Inc.", "EQUITY", "FINANCE", 0.01, 1, 10000000, true);
        addSecurity("AXP", "American Express", "EQUITY", "FINANCE", 0.01, 1, 10000000, true);
        addSecurity("BRK.B", "Berkshire Hathaway", "EQUITY", "FINANCE", 0.01, 1, 10000000, true);
        
        // Healthcare
        addSecurity("JNJ", "Johnson & Johnson", "EQUITY", "HEALTHCARE", 0.01, 1, 10000000, true);
        addSecurity("UNH", "UnitedHealth", "EQUITY", "HEALTHCARE", 0.01, 1, 10000000, true);
        addSecurity("PFE", "Pfizer Inc.", "EQUITY", "HEALTHCARE", 0.01, 1, 10000000, true);
        addSecurity("MRK", "Merck & Co.", "EQUITY", "HEALTHCARE", 0.01, 1, 10000000, true);
        addSecurity("ABBV", "AbbVie Inc.", "EQUITY", "HEALTHCARE", 0.01, 1, 10000000, true);
        addSecurity("LLY", "Eli Lilly", "EQUITY", "HEALTHCARE", 0.01, 1, 10000000, true);
        addSecurity("TMO", "Thermo Fisher", "EQUITY", "HEALTHCARE", 0.01, 1, 10000000, true);
        
        // Consumer Staples
        addSecurity("PG", "Procter & Gamble", "EQUITY", "CONSUMER_STAPLES", 0.01, 1, 10000000, true);
        addSecurity("KO", "Coca-Cola Co.", "EQUITY", "CONSUMER_STAPLES", 0.01, 1, 10000000, true);
        addSecurity("PEP", "PepsiCo Inc.", "EQUITY", "CONSUMER_STAPLES", 0.01, 1, 10000000, true);
        addSecurity("PM", "Philip Morris", "EQUITY", "CONSUMER_STAPLES", 0.01, 1, 10000000, true);
        addSecurity("CL", "Colgate-Palmolive", "EQUITY", "CONSUMER_STAPLES", 0.01, 1, 10000000, true);
        
        // Industrial
        addSecurity("BA", "Boeing Co.", "EQUITY", "INDUSTRIAL", 0.01, 1, 10000000, true);
        addSecurity("CAT", "Caterpillar Inc.", "EQUITY", "INDUSTRIAL", 0.01, 1, 10000000, true);
        addSecurity("GE", "General Electric", "EQUITY", "INDUSTRIAL", 0.01, 1, 10000000, true);
        addSecurity("HON", "Honeywell", "EQUITY", "INDUSTRIAL", 0.01, 1, 10000000, true);
        addSecurity("UPS", "United Parcel", "EQUITY", "INDUSTRIAL", 0.01, 1, 10000000, true);
        addSecurity("RTX", "RTX Corp.", "EQUITY", "INDUSTRIAL", 0.01, 1, 10000000, true);
        
        // Energy
        addSecurity("XOM", "Exxon Mobil", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        addSecurity("CVX", "Chevron Corp.", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        addSecurity("COP", "ConocoPhillips", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        addSecurity("SLB", "Schlumberger", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        
        // Add some options
        addSecurity("AAPL240315C00180000", "AAPL Call 180 Mar 2024", "OPTION", "TECHNOLOGY", 0.01, 1, 1000000, true);
        addSecurity("AAPL240315P00170000", "AAPL Put 170 Mar 2024", "OPTION", "TECHNOLOGY", 0.01, 1, 1000000, true);
        addSecurity("MSFT240315C00400000", "MSFT Call 400 Mar 2024", "OPTION", "TECHNOLOGY", 0.01, 1, 1000000, true);
        addSecurity("NVDA240315C00750000", "NVDA Call 750 Mar 2024", "OPTION", "TECHNOLOGY", 0.01, 1, 1000000, true);
        
        LOG.info("Loaded {} securities into Security Master", securityCache.size());
    }
    
    private void addSecurity(String symbol, String name, String type, String sector, 
                            double tickSize, int lotSize, int maxOrderSize, boolean tradeable) {
        Security security = new Security();
        security.symbol = symbol;
        security.name = name;
        security.securityType = type;
        security.sector = sector;
        security.tickSize = tickSize;
        security.lotSize = lotSize;
        security.maxOrderSize = maxOrderSize;
        security.tradeable = tradeable;
        security.currency = "USD";
        securityCache.put(symbol, security);
    }
    
    /**
     * Load Customer Master data
     */
    private void loadCustomerMaster() {
        addCustomer("CLIENT001", "Alpha Trading LLC", "HEDGE_FUND", true, 100000000.0);
        addCustomer("CLIENT002", "Beta Investments", "ASSET_MANAGER", true, 500000000.0);
        addCustomer("CLIENT003", "Gamma Capital", "PROP_TRADING", true, 250000000.0);
        addCustomer("CLIENT004", "Delta Securities", "BROKER_DEALER", true, 1000000000.0);
        addCustomer("CLIENT005", "Epsilon Partners", "HEDGE_FUND", true, 150000000.0);
        addCustomer("MARKET_MAKER_1", "MM Alpha", "MARKET_MAKER", true, 10000000000.0);
        addCustomer("MARKET_MAKER_2", "MM Beta", "MARKET_MAKER", true, 10000000000.0);
        
        LOG.info("Loaded {} customers into Customer Master", customerCache.size());
    }
    
    private void addCustomer(String clientId, String name, String type, boolean active, double creditLimit) {
        Customer customer = new Customer();
        customer.clientId = clientId;
        customer.name = name;
        customer.customerType = type;
        customer.active = active;
        customer.creditLimit = creditLimit;
        customerCache.put(clientId, customer);
    }
    
    /**
     * Initialize market data with base prices
     */
    private void initializeMarketData() {
        // Set initial prices for equities
        setMarketData("AAPL", 178.50, 178.48, 178.52);
        setMarketData("MSFT", 378.90, 378.85, 378.95);
        setMarketData("GOOGL", 141.80, 141.75, 141.85);
        setMarketData("NVDA", 721.30, 721.20, 721.40);
        setMarketData("META", 485.20, 485.10, 485.30);
        setMarketData("AMZN", 178.25, 178.20, 178.30);
        setMarketData("TSLA", 201.45, 201.40, 201.50);
        setMarketData("JPM", 195.20, 195.15, 195.25);
        setMarketData("V", 278.60, 278.55, 278.65);
        setMarketData("JNJ", 156.80, 156.75, 156.85);
        
        LOG.info("Initialized market data for {} symbols", marketDataCache.size());
    }
    
    private void setMarketData(String symbol, double lastPrice, double bid, double ask) {
        MarketData md = new MarketData();
        md.symbol = symbol;
        md.lastPrice = lastPrice;
        md.bid = bid;
        md.ask = ask;
        md.lastUpdate = System.currentTimeMillis();
        marketDataCache.put(symbol, md);
    }
    
    // ================== Public API ==================
    
    public boolean isValidSymbol(String symbol) {
        return securityCache.containsKey(symbol);
    }
    
    public boolean isValidClient(String clientId) {
        Customer customer = customerCache.get(clientId);
        return customer != null && customer.active;
    }
    
    public Security getSecurity(String symbol) {
        return securityCache.get(symbol);
    }
    
    public Customer getCustomer(String clientId) {
        return customerCache.get(clientId);
    }
    
    public Collection<Security> getAllSecurities() {
        return Collections.unmodifiableCollection(securityCache.values());
    }
    
    public Collection<Security> getSecuritiesBySector(String sector) {
        List<Security> result = new ArrayList<>();
        for (Security s : securityCache.values()) {
            if (sector.equals(s.sector)) {
                result.add(s);
            }
        }
        return result;
    }
    
    public Collection<Security> getSecuritiesByType(String type) {
        List<Security> result = new ArrayList<>();
        for (Security s : securityCache.values()) {
            if (type.equals(s.securityType)) {
                result.add(s);
            }
        }
        return result;
    }
    
    public MarketData getMarketData(String symbol) {
        return marketDataCache.get(symbol);
    }
    
    public void updateMarketData(String symbol, double lastPrice, double bid, double ask) {
        MarketData md = marketDataCache.computeIfAbsent(symbol, k -> new MarketData());
        md.symbol = symbol;
        md.lastPrice = lastPrice;
        md.bid = bid;
        md.ask = ask;
        md.lastUpdate = System.currentTimeMillis();
    }
    
    public Collection<MarketData> getAllMarketData() {
        return Collections.unmodifiableCollection(marketDataCache.values());
    }
    
    // ================== Inner Classes ==================
    
    public static class Security {
        public String symbol;
        public String name;
        public String securityType; // EQUITY, OPTION, FUTURE
        public String sector;
        public double tickSize;
        public int lotSize;
        public int maxOrderSize;
        public boolean tradeable;
        public String currency;
        public String underlyingSymbol; // For options
        public Double strikePrice; // For options
        public String expiryDate; // For options
        public String optionType; // CALL, PUT
    }
    
    public static class Customer {
        public String clientId;
        public String name;
        public String customerType;
        public boolean active;
        public double creditLimit;
    }
    
    public static class MarketData {
        public String symbol;
        public double lastPrice;
        public double bid;
        public double ask;
        public double high;
        public double low;
        public double open;
        public double close;
        public long volume;
        public long lastUpdate;
    }
}
