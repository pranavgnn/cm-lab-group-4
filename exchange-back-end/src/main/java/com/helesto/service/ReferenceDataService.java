package com.helesto.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.annotation.PostConstruct;
import javax.enterprise.context.ApplicationScoped;

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
        addSecurity("LMT", "Lockheed Martin", "EQUITY", "INDUSTRIAL", 0.01, 1, 10000000, true);
        addSecurity("DE", "Deere & Co.", "EQUITY", "INDUSTRIAL", 0.01, 1, 10000000, true);
        
        // Energy
        addSecurity("XOM", "Exxon Mobil", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        addSecurity("CVX", "Chevron Corp.", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        addSecurity("COP", "ConocoPhillips", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        addSecurity("SLB", "Schlumberger", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        addSecurity("EOG", "EOG Resources", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        addSecurity("MPC", "Marathon Petroleum", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        addSecurity("VLO", "Valero Energy", "EQUITY", "ENERGY", 0.01, 1, 10000000, true);
        
        // Telecommunications
        addSecurity("T", "AT&T Inc.", "EQUITY", "TELECOM", 0.01, 1, 10000000, true);
        addSecurity("VZ", "Verizon Comm.", "EQUITY", "TELECOM", 0.01, 1, 10000000, true);
        addSecurity("TMUS", "T-Mobile US", "EQUITY", "TELECOM", 0.01, 1, 10000000, true);
        addSecurity("CMCSA", "Comcast Corp.", "EQUITY", "TELECOM", 0.01, 1, 10000000, true);
        addSecurity("CHTR", "Charter Comm.", "EQUITY", "TELECOM", 0.01, 1, 10000000, true);
        
        // Materials
        addSecurity("LIN", "Linde plc", "EQUITY", "MATERIALS", 0.01, 1, 10000000, true);
        addSecurity("FCX", "Freeport-McMoRan", "EQUITY", "MATERIALS", 0.01, 1, 10000000, true);
        addSecurity("NEM", "Newmont Corp.", "EQUITY", "MATERIALS", 0.01, 1, 10000000, true);
        addSecurity("SHW", "Sherwin-Williams", "EQUITY", "MATERIALS", 0.01, 1, 10000000, true);
        addSecurity("DOW", "Dow Inc.", "EQUITY", "MATERIALS", 0.01, 1, 10000000, true);
        addSecurity("APD", "Air Products", "EQUITY", "MATERIALS", 0.01, 1, 10000000, true);
        
        // Real Estate
        addSecurity("PLD", "Prologis Inc.", "EQUITY", "REAL_ESTATE", 0.01, 1, 10000000, true);
        addSecurity("AMT", "American Tower", "EQUITY", "REAL_ESTATE", 0.01, 1, 10000000, true);
        addSecurity("EQIX", "Equinix Inc.", "EQUITY", "REAL_ESTATE", 0.01, 1, 10000000, true);
        addSecurity("SPG", "Simon Property", "EQUITY", "REAL_ESTATE", 0.01, 1, 10000000, true);
        addSecurity("O", "Realty Income", "EQUITY", "REAL_ESTATE", 0.01, 1, 10000000, true);
        
        // Utilities
        addSecurity("NEE", "NextEra Energy", "EQUITY", "UTILITIES", 0.01, 1, 10000000, true);
        addSecurity("DUK", "Duke Energy", "EQUITY", "UTILITIES", 0.01, 1, 10000000, true);
        addSecurity("SO", "Southern Co.", "EQUITY", "UTILITIES", 0.01, 1, 10000000, true);
        addSecurity("D", "Dominion Energy", "EQUITY", "UTILITIES", 0.01, 1, 10000000, true);
        addSecurity("AEP", "American Electric", "EQUITY", "UTILITIES", 0.01, 1, 10000000, true);
        
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
        // Technology
        setMarketData("AAPL", 178.50, 178.48, 178.52);
        setMarketData("MSFT", 378.90, 378.85, 378.95);
        setMarketData("GOOGL", 141.80, 141.75, 141.85);
        setMarketData("NVDA", 721.30, 721.20, 721.40);
        setMarketData("META", 485.20, 485.10, 485.30);
        setMarketData("INTC", 42.35, 42.32, 42.38);
        setMarketData("AMD", 156.80, 156.75, 156.85);
        setMarketData("CRM", 285.40, 285.35, 285.45);
        setMarketData("ORCL", 118.25, 118.20, 118.30);
        setMarketData("CSCO", 51.80, 51.77, 51.83);
        setMarketData("ADBE", 495.60, 495.50, 495.70);
        setMarketData("IBM", 185.30, 185.25, 185.35);
        
        // Consumer
        setMarketData("AMZN", 178.25, 178.20, 178.30);
        setMarketData("TSLA", 201.45, 201.40, 201.50);
        setMarketData("WMT", 168.90, 168.85, 168.95);
        setMarketData("HD", 378.20, 378.15, 378.25);
        setMarketData("NKE", 108.45, 108.40, 108.50);
        setMarketData("MCD", 298.75, 298.70, 298.80);
        setMarketData("SBUX", 92.30, 92.27, 92.33);
        setMarketData("TGT", 142.15, 142.10, 142.20);
        setMarketData("COST", 725.80, 725.70, 725.90);
        
        // Entertainment
        setMarketData("DIS", 112.45, 112.40, 112.50);
        setMarketData("NFLX", 605.20, 605.10, 605.30);
        setMarketData("SPOT", 285.60, 285.55, 285.65);
        setMarketData("WBD", 8.45, 8.42, 8.48);
        setMarketData("PARA", 11.80, 11.77, 11.83);
        
        // Finance
        setMarketData("JPM", 195.20, 195.15, 195.25);
        setMarketData("V", 278.60, 278.55, 278.65);
        setMarketData("MA", 458.90, 458.85, 458.95);
        setMarketData("BAC", 35.80, 35.77, 35.83);
        setMarketData("GS", 412.30, 412.20, 412.40);
        setMarketData("MS", 98.45, 98.40, 98.50);
        setMarketData("BLK", 815.70, 815.60, 815.80);
        setMarketData("AXP", 225.40, 225.35, 225.45);
        setMarketData("BRK.B", 412.80, 412.70, 412.90);
        
        // Healthcare
        setMarketData("JNJ", 156.80, 156.75, 156.85);
        setMarketData("UNH", 492.30, 492.20, 492.40);
        setMarketData("PFE", 28.45, 28.42, 28.48);
        setMarketData("MRK", 118.90, 118.85, 118.95);
        setMarketData("ABBV", 172.60, 172.55, 172.65);
        setMarketData("LLY", 765.40, 765.30, 765.50);
        setMarketData("TMO", 545.80, 545.70, 545.90);
        
        // Consumer Staples
        setMarketData("PG", 162.45, 162.40, 162.50);
        setMarketData("KO", 60.90, 60.87, 60.93);
        setMarketData("PEP", 172.30, 172.25, 172.35);
        setMarketData("PM", 95.80, 95.77, 95.83);
        setMarketData("CL", 88.20, 88.17, 88.23);
        
        // Industrial
        setMarketData("BA", 198.45, 198.40, 198.50);
        setMarketData("CAT", 358.60, 358.55, 358.65);
        setMarketData("GE", 158.90, 158.85, 158.95);
        setMarketData("HON", 198.75, 198.70, 198.80);
        setMarketData("UPS", 142.30, 142.25, 142.35);
        setMarketData("RTX", 98.45, 98.40, 98.50);
        setMarketData("LMT", 475.30, 475.20, 475.40);
        setMarketData("DE", 418.60, 418.55, 418.65);
        
        // Energy
        setMarketData("XOM", 105.80, 105.77, 105.83);
        setMarketData("CVX", 152.45, 152.40, 152.50);
        setMarketData("COP", 118.90, 118.85, 118.95);
        setMarketData("SLB", 48.65, 48.62, 48.68);
        setMarketData("EOG", 125.40, 125.35, 125.45);
        setMarketData("MPC", 165.80, 165.75, 165.85);
        setMarketData("VLO", 148.20, 148.15, 148.25);
        
        // Telecommunications
        setMarketData("T", 17.85, 17.82, 17.88);
        setMarketData("VZ", 41.20, 41.17, 41.23);
        setMarketData("TMUS", 168.45, 168.40, 168.50);
        setMarketData("CMCSA", 42.80, 42.77, 42.83);
        setMarketData("CHTR", 295.60, 295.50, 295.70);
        
        // Materials
        setMarketData("LIN", 458.90, 458.80, 459.00);
        setMarketData("FCX", 42.65, 42.62, 42.68);
        setMarketData("NEM", 38.45, 38.42, 38.48);
        setMarketData("SHW", 328.70, 328.60, 328.80);
        setMarketData("DOW", 55.80, 55.77, 55.83);
        setMarketData("APD", 285.40, 285.35, 285.45);
        
        // Real Estate
        setMarketData("PLD", 128.45, 128.40, 128.50);
        setMarketData("AMT", 215.60, 215.55, 215.65);
        setMarketData("EQIX", 825.30, 825.20, 825.40);
        setMarketData("SPG", 152.80, 152.75, 152.85);
        setMarketData("O", 58.45, 58.42, 58.48);
        
        // Utilities
        setMarketData("NEE", 78.90, 78.87, 78.93);
        setMarketData("DUK", 102.45, 102.40, 102.50);
        setMarketData("SO", 72.60, 72.57, 72.63);
        setMarketData("D", 52.80, 52.77, 52.83);
        setMarketData("AEP", 88.35, 88.32, 88.38);
        
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
