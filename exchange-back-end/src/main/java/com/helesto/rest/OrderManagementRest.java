package com.helesto.rest;

import java.util.Map;
import java.util.UUID;

import javax.inject.Inject;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import com.helesto.dao.OrderDao;
import com.helesto.model.OrderEntity;
import com.helesto.service.MatchingEngine;
import com.helesto.service.OrderBookManager;
import com.helesto.service.OrderCancelService;
import com.helesto.service.OrderFlowOrchestrator;
import com.helesto.service.OrderValidationService;
import com.helesto.service.TradeService;

/**
 * REST endpoints for Order Management and Cancel operations
 */
@Path("/api/orders")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class OrderManagementRest {

    @Inject
    OrderDao orderDao;
    
    @Inject
    OrderCancelService cancelService;
    
    @Inject
    OrderValidationService validationService;
    
    @Inject
    MatchingEngine matchingEngine;
    
    @Inject
    OrderBookManager orderBookManager;
    
    @Inject
    TradeService tradeService;
    
    @Inject
    OrderFlowOrchestrator orchestrator;
    
    // ================== Order Query Endpoints ==================
    
    @GET
    public Response getAllOrders() {
        return Response.ok(orderDao.findAll()).build();
    }
    
    @POST
    public Response createOrder(OrderSubmitRequest request) {
        // Reuse submit logic
        return submitOrder(request);
    }
    
    @GET
    @Path("/{orderRefNumber}")
    public Response getOrder(@PathParam("orderRefNumber") String orderRefNumber) {
        OrderEntity order = orderDao.findByOrderRefNumber(orderRefNumber);
        if (order == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of("error", "Order not found: " + orderRefNumber))
                    .build();
        }
        return Response.ok(order).build();
    }
    
    @GET
    @Path("/symbol/{symbol}")
    public Response getOrdersBySymbol(@PathParam("symbol") String symbol) {
        return Response.ok(orderDao.findBySymbol(symbol)).build();
    }
    
    @GET
    @Path("/status/{status}")
    public Response getOrdersByStatus(@PathParam("status") String status) {
        return Response.ok(orderDao.findByStatus(status)).build();
    }
    
    @GET
    @Path("/client/{clientId}")
    public Response getOrdersByClient(@PathParam("clientId") String clientId) {
        return Response.ok(orderDao.findByClientId(clientId)).build();
    }
    
    // ================== Order Cancel Endpoints ==================
    
    @POST
    @Path("/{orderRefNumber}/cancel")
    public Response cancelOrder(
            @PathParam("orderRefNumber") String orderRefNumber,
            CancelOrderRequest request) {
        
        String clientId = request != null ? request.clientId : null;
        String reason = request != null ? request.reason : "User requested cancel";
        
        OrderCancelService.CancelResult result = cancelService.requestCancel(orderRefNumber, clientId, reason);
        
        if (result.success) {
            return Response.ok(Map.of(
                    "success", true,
                    "message", result.message,
                    "canceledQuantity", result.canceledQuantity,
                    "filledQuantity", result.filledQuantity
            )).build();
        } else {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("success", false, "error", result.message))
                    .build();
        }
    }
    
    @GET
    @Path("/pending-cancels")
    public Response getPendingCancels() {
        return Response.ok(cancelService.getPendingCancels()).build();
    }
    
    // ================== Audit Trail Endpoints ==================
    
    @GET
    @Path("/audit")
    public Response getFullAuditTrail() {
        return Response.ok(cancelService.getFullAuditTrail()).build();
    }
    
    @GET
    @Path("/audit/order/{orderRefNumber}")
    public Response getOrderAuditTrail(@PathParam("orderRefNumber") String orderRefNumber) {
        return Response.ok(cancelService.getOrderAuditTrail(orderRefNumber)).build();
    }
    
    @GET
    @Path("/audit/client/{clientId}")
    public Response getClientAuditTrail(@PathParam("clientId") String clientId) {
        return Response.ok(cancelService.getClientAuditTrail(clientId)).build();
    }
    
    // ================== Order Submission (for testing) ==================
    
    @POST
    @Path("/submit")
    public Response submitOrder(OrderSubmitRequest request) {
        // Validate request
        if (request.symbol == null || request.side == null || request.quantity <= 0) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Invalid order: symbol, side, quantity required"))
                    .build();
        }
        
        // Convert order type codes to names
        String orderType = convertOrderType(request.orderType);
        String timeInForce = convertTimeInForce(request.timeInForce);
        String side = request.side;
        // Convert side if specified as BUY/SELL
        if ("BUY".equalsIgnoreCase(side)) side = "1";
        else if ("SELL".equalsIgnoreCase(side)) side = "2";
        
        // Create order entity
        OrderEntity order = new OrderEntity();
        order.setSymbol(request.symbol);
        order.setSide(side);
        order.setQuantity((long) request.quantity);
        order.setPrice(request.price);
        order.setOrderType(orderType);
        order.setTimeInForce(timeInForce);
        order.setClientId(request.clientId != null ? request.clientId : "CLIENT001");
        order.setClOrdId(request.clOrdId != null ? request.clOrdId : UUID.randomUUID().toString());
        
        // Validate order
        OrderValidationService.ValidationResult validation = validationService.validateOrder(order);
        if (!validation.isValid()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Validation failed", "errors", validation.getErrors()))
                    .build();
        }
        
        // Enrich order
        validationService.enrichOrder(order);
        
        // Set initial status
        order.setStatus("NEW");
        order.setFilledQty(0L);
        order.setLeavesQty(order.getQuantity());
        order.setAvgPrice(0.0);
        
        // Persist order
        orderDao.persistOrder(order);
        
        // Try to match the order
        OrderBookManager.BookOrder bookOrder = new OrderBookManager.BookOrder();
        bookOrder.orderId = order.getOrderRefNumber();
        bookOrder.clOrdId = order.getClOrdId();
        bookOrder.symbol = order.getSymbol();
        bookOrder.side = order.getSide();
        bookOrder.price = order.getPrice();
        bookOrder.originalQty = order.getQuantity().intValue();
        bookOrder.leavesQty = order.getQuantity().intValue();
        bookOrder.orderType = order.getOrderType();
        bookOrder.timeInForce = order.getTimeInForce();
        bookOrder.clientId = order.getClientId();
        
        MatchingEngine.MatchResult matchResult = matchingEngine.matchOrder(bookOrder);
        
        // Update order with match result
        order.setStatus(matchResult.status.name());
        order.setFilledQty((long) matchResult.filledQty);
        order.setLeavesQty((long) matchResult.leavesQty);
        order.setAvgPrice(matchResult.avgPrice);
        orderDao.updateOrder(order);
        
        // Create trades for fills
        for (MatchingEngine.Fill fill : matchResult.fills) {
            tradeService.createTrade(fill, order.getOrderRefNumber(), order.getClOrdId(),
                    order.getClientId(), order.getSide(), order.getSymbol());
        }
        
        return Response.status(Response.Status.CREATED)
                .entity(Map.of(
                        "orderRefNumber", order.getOrderRefNumber(),
                        "clOrdId", order.getClOrdId(),
                        "status", order.getStatus(),
                        "filledQty", order.getFilledQty(),
                        "leavesQty", order.getLeavesQty(),
                        "avgPrice", order.getAvgPrice(),
                        "fills", matchResult.fills.size(),
                        "addedToBook", matchResult.addedToBook
                )).build();
    }
    
    // ================== Orchestrated Order Submission (with full checks) ==================
    
    /**
     * Submit an order through the full orchestrator pipeline including:
     * - Market state checks
     * - Rate limiting
     * - Validation
     * - Circuit breaker checks  
     * - Risk management
     * - Audit trail
     * - Performance tracking
     */
    @POST
    @Path("/orchestrated")
    public Response submitOrchestratedOrder(OrderSubmitRequest request) {
        if (request.symbol == null || request.side == null || request.quantity <= 0) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Invalid order: symbol, side, quantity required"))
                    .build();
        }
        
        OrderFlowOrchestrator.OrderRequest orchRequest = OrderFlowOrchestrator.OrderRequest
                .create(request.symbol, request.side, request.quantity, request.price)
                .withClientId(request.clientId != null ? request.clientId : "CLIENT001")
                .withOrderType(request.orderType != null ? request.orderType : "LIMIT")
                .withTimeInForce(request.timeInForce != null ? request.timeInForce : "DAY");
        
        if (request.clOrdId != null) {
            orchRequest.withClOrdId(request.clOrdId);
        }
        
        OrderFlowOrchestrator.OrderResult result = orchestrator.processOrder(orchRequest);
        
        if (result.success) {
            return Response.status(Response.Status.CREATED)
                    .entity(result.toMap())
                    .build();
        } else {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(result.toMap())
                    .build();
        }
    }
    
    /**
     * Cancel an order through the orchestrated pipeline
     */
    @POST
    @Path("/orchestrated/{orderRefNumber}/cancel")
    public Response cancelOrchestratedOrder(
            @PathParam("orderRefNumber") String orderRefNumber,
            CancelOrderRequest request) {
        
        String clientId = request != null ? request.clientId : null;
        String reason = request != null ? request.reason : "User requested cancel";
        
        OrderFlowOrchestrator.CancelResult result = orchestrator.cancelOrder(orderRefNumber, clientId, reason);
        
        if (result.success) {
            return Response.ok(Map.of(
                    "success", true,
                    "message", result.message,
                    "canceledQuantity", result.canceledQuantity,
                    "filledQuantity", result.filledQuantity
            )).build();
        } else {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("success", false, "error", result.message))
                    .build();
        }
    }
    
    // ================== Helper Methods ==================
    
    private String convertOrderType(String type) {
        if (type == null) return "LIMIT";
        switch (type.toUpperCase()) {
            case "1": case "MARKET": return "MARKET";
            case "2": case "LIMIT": return "LIMIT";
            case "3": case "STOP": return "STOP";
            case "4": case "STOP_LIMIT": return "STOP_LIMIT";
            default: return type.toUpperCase();
        }
    }
    
    private String convertTimeInForce(String tif) {
        if (tif == null) return "DAY";
        switch (tif.toUpperCase()) {
            case "0": case "DAY": return "DAY";
            case "1": case "GTC": return "GTC";
            case "3": case "IOC": return "IOC";
            case "4": case "FOK": return "FOK";
            case "6": case "GTD": return "GTD";
            default: return tif.toUpperCase();
        }
    }
    
    // ================== Request Classes ==================
    
    public static class CancelOrderRequest {
        public String clientId;
        public String reason;
    }
    
    public static class OrderSubmitRequest {
        public String symbol;
        public String side; // BUY, SELL, 1, 2
        public int quantity;
        public double price;
        public String orderType; // 1=MARKET, 2=LIMIT
        public String timeInForce; // 0=DAY, 1=GTC, 3=IOC, 4=FOK
        public String clientId;
        public String clOrdId;
    }
}
