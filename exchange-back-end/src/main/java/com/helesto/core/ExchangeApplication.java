package com.helesto.core;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

import javax.inject.Inject;
import javax.inject.Singleton;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.helesto.dao.OrderDao;
import com.helesto.model.OrderEntity;
import com.helesto.service.ExecutionReportService;
import com.helesto.service.MatchingEngine;
import com.helesto.service.OrderBookManager;
import com.helesto.service.OrderValidationService;
import com.helesto.service.TelemetryService;
import com.helesto.service.TradeService;

import quickfix.Application;
import quickfix.DoNotSend;
import quickfix.FieldNotFound;
import quickfix.IncorrectDataFormat;
import quickfix.IncorrectTagValue;
import quickfix.Message;
import quickfix.MessageCracker;
import quickfix.RejectLogon;
import quickfix.Session;
import quickfix.SessionID;
import quickfix.SessionNotFound;
import quickfix.UnsupportedMessageType;
import quickfix.field.AvgPx;
import quickfix.field.BusinessRejectReason;
import quickfix.field.ClOrdID;
import quickfix.field.CumQty;
import quickfix.field.CxlRejReason;
import quickfix.field.CxlRejResponseTo;
import quickfix.field.ExecID;
import quickfix.field.ExecType;
import quickfix.field.LeavesQty;
import quickfix.field.MsgSeqNum;
import quickfix.field.MsgType;
import quickfix.field.OrdRejReason;
import quickfix.field.OrdStatus;
import quickfix.field.OrdType;
import quickfix.field.OrderID;
import quickfix.field.OrderQty;
import quickfix.field.OrigClOrdID;
import quickfix.field.RawData;
import quickfix.field.RefMsgType;
import quickfix.field.RefSeqNum;
import quickfix.field.Side;
import quickfix.field.Symbol;
import quickfix.field.Text;
import quickfix.field.TimeInForce;
import quickfix.fix44.BusinessMessageReject;
import quickfix.fix44.ExecutionReport;
import quickfix.fix44.NewOrderSingle;
import quickfix.fix44.OrderCancelReject;
import quickfix.fix44.OrderCancelReplaceRequest;
import quickfix.fix44.OrderCancelRequest;
import quickfix.fix44.OrderStatusRequest;

@Singleton
public class ExchangeApplication extends MessageCracker implements Application {

    private static final Logger LOG = LoggerFactory.getLogger(ExchangeApplication.class);

    @Inject
    ExecutionReportService executionReportService;

    @Inject
    OrderValidationService orderValidationService;

    @Inject
    OrderDao orderDao;

    @Inject
    MatchingEngine matchingEngine;

    @Inject
    OrderBookManager orderBookManager;

    @Inject
    TradeService tradeService;

    @Inject
    TelemetryService telemetryService;

    // Session event tracking
    private final List<SessionEvent> sessionEvents = new CopyOnWriteArrayList<>();
    private final List<Consumer<SessionEvent>> sessionEventListeners = new CopyOnWriteArrayList<>();
    private volatile boolean sessionLoggedOn = false;
    private volatile SessionID currentSessionId = null;

    public ExchangeApplication() {
        LOG.info("ExchangeApplication Constructor");
    }

    @Override
    public void onCreate(SessionID sessionID) {
        LOG.info("FIX Session created - SessionID: {}", sessionID);
        addSessionEvent("SESSION_CREATED", "Session created: " + sessionID);
    }

    @Override
    public void onLogon(SessionID sessionID) {
        LOG.info("FIX Logon successful - SessionID: {}", sessionID);
        sessionLoggedOn = true;
        currentSessionId = sessionID;
        addSessionEvent("LOGON", "Broker connected: " + sessionID.getTargetCompID());
    }

    @Override
    public void onLogout(SessionID sessionID) {
        LOG.info("FIX Logout - SessionID: {}", sessionID);
        sessionLoggedOn = false;
        addSessionEvent("LOGOUT", "Broker disconnected: " + sessionID.getTargetCompID());
    }

    @Override
    public void toAdmin(Message message, SessionID sessionID) {
        try {
            String msgType = message.getHeader().getString(MsgType.FIELD);
            LOG.debug("toAdmin - MsgType: {}, SessionID: {}", msgType, sessionID);
            
            // Log heartbeats at trace level
            if (MsgType.HEARTBEAT.equals(msgType)) {
                LOG.trace("Sending Heartbeat");
            } else if (MsgType.LOGON.equals(msgType)) {
                LOG.info("Sending Logon response");
                addSessionEvent("LOGON_SENT", "Logon response sent");
            } else if (MsgType.LOGOUT.equals(msgType)) {
                LOG.info("Sending Logout");
                addSessionEvent("LOGOUT_SENT", "Logout sent");
            } else if (MsgType.REJECT.equals(msgType)) {
                LOG.warn("Sending Session Reject: {}", message);
                addSessionEvent("SESSION_REJECT_SENT", "Session reject sent");
            }
        } catch (FieldNotFound e) {
            LOG.debug("toAdmin - cannot get MsgType");
        }
    }

    @Override
    public void fromAdmin(Message message, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, RejectLogon {
        String msgType = message.getHeader().getString(MsgType.FIELD);
        LOG.debug("fromAdmin - MsgType: {}, SessionID: {}", msgType, sessionID);
        
        if (MsgType.LOGON.equals(msgType)) {
            LOG.info("Received Logon request from {}", sessionID.getTargetCompID());
            addSessionEvent("LOGON_RECEIVED", "Logon request from " + sessionID.getTargetCompID());
            // Validate logon credentials if needed
            validateLogon(message, sessionID);
        } else if (MsgType.LOGOUT.equals(msgType)) {
            LOG.info("Received Logout from {}", sessionID.getTargetCompID());
            addSessionEvent("LOGOUT_RECEIVED", "Logout from " + sessionID.getTargetCompID());
        } else if (MsgType.HEARTBEAT.equals(msgType)) {
            LOG.trace("Received Heartbeat");
        } else if (MsgType.TEST_REQUEST.equals(msgType)) {
            LOG.debug("Received Test Request");
            addSessionEvent("TEST_REQUEST", "Test request received");
        } else if (MsgType.RESEND_REQUEST.equals(msgType)) {
            LOG.info("Received Resend Request");
            addSessionEvent("RESEND_REQUEST", "Resend request received");
        } else if (MsgType.SEQUENCE_RESET.equals(msgType)) {
            LOG.info("Received Sequence Reset");
            addSessionEvent("SEQUENCE_RESET", "Sequence reset received");
        }
    }

    @Override
    public void toApp(Message message, SessionID sessionID) throws DoNotSend {
        try {
            String msgType = message.getHeader().getString(MsgType.FIELD);
            LOG.debug("toApp - Sending MsgType: {}", msgType);
            
            // Record FIX message sent
            if (telemetryService != null) {
                telemetryService.recordFixMessageSent();
            }
        } catch (FieldNotFound e) {
            LOG.debug("toApp - cannot get MsgType");
        }
    }

    @Override
    public void fromApp(Message message, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, UnsupportedMessageType {
        long startTime = System.nanoTime();
        String msgType = message.getHeader().getString(MsgType.FIELD);
        LOG.info("fromApp - Received MsgType: {} from {}", msgType, sessionID.getTargetCompID());
        
        // Record FIX message received
        if (telemetryService != null) {
            telemetryService.recordFixMessageReceived();
        }
        
        try {
            crack(message, sessionID);
            
            // Record message lag
            if (telemetryService != null) {
                long lagNanos = System.nanoTime() - startTime;
                telemetryService.recordFixMessageLag(lagNanos);
            }
        } catch (UnsupportedMessageType e) {
            LOG.warn("Unsupported message type: {}", msgType);
            if (telemetryService != null) {
                telemetryService.recordFixMessageRejected();
            }
            sendBusinessReject(message, sessionID, BusinessRejectReason.UNSUPPORTED_MESSAGE_TYPE, 
                    "Message type " + msgType + " not supported");
            throw e;
        }
    }

    /**
     * Handle NewOrderSingle (MsgType=D)
     */
    public void onMessage(NewOrderSingle newOrderSingle, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, UnsupportedMessageType {
        long orderStartTime = System.nanoTime();
        LOG.info("Processing NewOrderSingle");
        
        // Record order received
        if (telemetryService != null) {
            telemetryService.recordOrderReceived();
        }
        
        try {
            // Extract order details
            String clOrdId = newOrderSingle.getClOrdID().getValue();
            String symbol = newOrderSingle.getSymbol().getValue();
            char side = newOrderSingle.getSide().getValue();
            double qty = newOrderSingle.getOrderQty().getValue();
            char ordType = newOrderSingle.getOrdType().getValue();
            
            double price = 0;
            if (ordType == OrdType.LIMIT || ordType == OrdType.STOP_LIMIT) {
                try {
                    price = newOrderSingle.getPrice().getValue();
                } catch (FieldNotFound e) {
                    // Price required for limit orders - send reject
                    sendRejectExecutionReport(clOrdId, symbol, side, qty, OrdRejReason.OTHER, 
                            "Price required for LIMIT orders", sessionID);
                    return;
                }
            }
            
            String timeInForce = "DAY";
            try {
                char tif = newOrderSingle.getTimeInForce().getValue();
                timeInForce = mapTimeInForce(tif);
            } catch (FieldNotFound e) {
                // Default to DAY
            }
            
            // Create order entity
            OrderEntity order = new OrderEntity();
            order.setClOrdId(clOrdId);
            order.setSymbol(symbol);
            order.setSide(String.valueOf(side));
            order.setQuantity((long) qty);
            order.setPrice(price);
            order.setOrderType(mapOrdType(ordType));
            order.setTimeInForce(timeInForce);
            order.setCreatedAt(LocalDateTime.now());
            
            // Validate order
            OrderValidationService.ValidationResult validationResult = orderValidationService.validateOrder(order);
            if (!validationResult.isValid()) {
                LOG.warn("Order validation failed: {}", validationResult.getErrors());
                if (telemetryService != null) {
                    telemetryService.recordOrderRejected();
                }
                sendRejectExecutionReport(clOrdId, symbol, side, qty, OrdRejReason.OTHER, 
                        String.join("; ", validationResult.getErrors()), sessionID);
                return;
            }
            
            // Enrich order
            orderValidationService.enrichOrder(order);
            order.setStatus("NEW");
            orderDao.persistOrder(order);
            
            LOG.info("Order validated and persisted: {} -> {}", clOrdId, order.getOrderRefNumber());
            addSessionEvent("ORDER_RECEIVED", "Order " + clOrdId + " received and validated");
            
            // Record order processed
            if (telemetryService != null) {
                long processingTime = System.nanoTime() - orderStartTime;
                telemetryService.recordOrderProcessed(processingTime);
            }
            
            // Send NEW acknowledgment
            executionReportService.sendAck(order, sessionID);
            
            // Process through matching engine
            processOrderMatch(order, sessionID);
            
        } catch (Exception e) {
            LOG.error("Error processing NewOrderSingle", e);
            if (telemetryService != null) {
                telemetryService.recordError();
            }
            try {
                String clOrdId = newOrderSingle.getClOrdID().getValue();
                sendRejectExecutionReport(clOrdId, "UNKNOWN", Side.BUY, 0, OrdRejReason.OTHER, 
                        "Internal error: " + e.getMessage(), sessionID);
            } catch (FieldNotFound ex) {
                LOG.error("Cannot extract ClOrdID for reject", ex);
            }
        }
    }

    /**
     * Handle OrderCancelRequest (MsgType=F)
     */
    public void onMessage(OrderCancelRequest orderCancelRequest, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, UnsupportedMessageType {
        LOG.info("Processing OrderCancelRequest");
        
        try {
            String origClOrdId = orderCancelRequest.getOrigClOrdID().getValue();
            String clOrdId = orderCancelRequest.getClOrdID().getValue();
            String symbol = orderCancelRequest.getSymbol().getValue();
            char side = orderCancelRequest.getSide().getValue();
            
            // Find the original order
            OrderEntity order = orderDao.findByClOrdId(origClOrdId);
            if (order == null) {
                LOG.warn("Order not found for cancel: {}", origClOrdId);
                sendCancelReject(clOrdId, origClOrdId, "UNKNOWN", CxlRejReason.UNKNOWN_ORDER, 
                        "Order not found", sessionID);
                return;
            }
            
            // Check if order can be canceled
            String status = order.getStatus();
            if ("FILLED".equals(status) || "CANCELED".equals(status) || "REJECTED".equals(status)) {
                LOG.warn("Cannot cancel order in status: {}", status);
                sendCancelReject(clOrdId, origClOrdId, order.getOrderRefNumber(), 
                        CxlRejReason.TOO_LATE_TO_CANCEL, "Order already " + status, sessionID);
                return;
            }
            
            // Check if order is pending cancel
            if ("PENDING_CANCEL".equals(status)) {
                sendCancelReject(clOrdId, origClOrdId, order.getOrderRefNumber(),
                        CxlRejReason.ORDER_ALREADY_IN_PENDING_CANCEL_OR_PENDING_REPLACE_STATUS,
                        "Order already pending cancel", sessionID);
                return;
            }
            
            // Remove from order book
            orderBookManager.removeOrder(order.getSymbol(), order.getOrderRefNumber());
            
            // Update order status
            order.setStatus("CANCELED");
            order.setUpdatedAt(LocalDateTime.now());
            orderDao.updateOrder(order);
            
            LOG.info("Order canceled: {}", origClOrdId);
            addSessionEvent("ORDER_CANCELED", "Order " + origClOrdId + " canceled");
            
            // Send CANCELED execution report
            executionReportService.sendCancel(order, sessionID);
            
        } catch (Exception e) {
            LOG.error("Error processing OrderCancelRequest", e);
        }
    }

    /**
     * Handle OrderCancelReplaceRequest (MsgType=G)
     */
    public void onMessage(OrderCancelReplaceRequest replaceRequest, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, UnsupportedMessageType {
        LOG.info("Processing OrderCancelReplaceRequest");
        
        try {
            String origClOrdId = replaceRequest.getOrigClOrdID().getValue();
            String clOrdId = replaceRequest.getClOrdID().getValue();
            
            // Find the original order
            OrderEntity order = orderDao.findByClOrdId(origClOrdId);
            if (order == null) {
                LOG.warn("Order not found for replace: {}", origClOrdId);
                sendCancelReject(clOrdId, origClOrdId, "UNKNOWN", CxlRejReason.UNKNOWN_ORDER,
                        "Order not found", sessionID);
                return;
            }
            
            // Check if order can be modified
            String status = order.getStatus();
            if ("FILLED".equals(status) || "CANCELED".equals(status) || "REJECTED".equals(status)) {
                sendCancelReject(clOrdId, origClOrdId, order.getOrderRefNumber(),
                        CxlRejReason.TOO_LATE_TO_CANCEL, "Order already " + status, sessionID);
                return;
            }
            
            // Remove old order from book
            orderBookManager.removeOrder(order.getSymbol(), order.getOrderRefNumber());
            
            // Update order with new values
            try {
                double newQty = replaceRequest.getOrderQty().getValue();
                order.setQuantity((long) newQty);
                order.setLeavesQty((long) newQty - order.getFilledQty());
            } catch (FieldNotFound e) {
                // Keep original qty
            }
            
            try {
                double newPrice = replaceRequest.getPrice().getValue();
                order.setPrice(newPrice);
            } catch (FieldNotFound e) {
                // Keep original price
            }
            
            order.setClOrdId(clOrdId); // Update to new ClOrdID
            order.setStatus("NEW");
            order.setUpdatedAt(LocalDateTime.now());
            orderDao.updateOrder(order);
            
            LOG.info("Order replaced: {} -> {}", origClOrdId, clOrdId);
            addSessionEvent("ORDER_REPLACED", "Order " + origClOrdId + " replaced with " + clOrdId);
            
            // Send REPLACED execution report
            executionReportService.sendReplace(order, origClOrdId, sessionID);
            
            // Re-process through matching
            processOrderMatch(order, sessionID);
            
        } catch (Exception e) {
            LOG.error("Error processing OrderCancelReplaceRequest", e);
        }
    }

    /**
     * Handle OrderStatusRequest (MsgType=H)
     */
    public void onMessage(OrderStatusRequest statusRequest, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, UnsupportedMessageType {
        LOG.info("Processing OrderStatusRequest");
        
        try {
            String clOrdId = statusRequest.getClOrdID().getValue();
            OrderEntity order = orderDao.findByClOrdId(clOrdId);
            
            if (order == null) {
                LOG.warn("Order not found for status request: {}", clOrdId);
                // Send business reject
                sendBusinessReject(statusRequest, sessionID, BusinessRejectReason.UNKNOWN_ID,
                        "Order not found: " + clOrdId);
                return;
            }
            
            // Send order status
            executionReportService.sendOrderStatus(order, sessionID);
            
        } catch (Exception e) {
            LOG.error("Error processing OrderStatusRequest", e);
        }
    }

    // Helper methods for message processing

    private void processOrderMatch(OrderEntity order, SessionID sessionID) {
        try {
            // Create book order from entity
            OrderBookManager.BookOrder bookOrder = new OrderBookManager.BookOrder();
            bookOrder.orderId = order.getOrderRefNumber();
            bookOrder.clOrdId = order.getClOrdId();
            bookOrder.symbol = order.getSymbol();
            bookOrder.side = order.getSide();
            bookOrder.price = order.getPrice();
            bookOrder.originalQty = order.getQuantity().intValue();
            bookOrder.leavesQty = order.getLeavesQty() != null ? order.getLeavesQty().intValue() : bookOrder.originalQty;
            bookOrder.orderType = order.getOrderType();
            bookOrder.timeInForce = order.getTimeInForce();
            bookOrder.clientId = order.getClientId();
            bookOrder.timestamp = System.currentTimeMillis();
            
            // Process through matching engine
            MatchingEngine.MatchResult result = matchingEngine.matchOrder(bookOrder);
            
            // Process fills
            if (result.filledQty > 0) {
                order.setFilledQty((long) result.filledQty);
                order.setLeavesQty((long) result.leavesQty);
                
                // Calculate average price
                double totalValue = 0;
                for (MatchingEngine.Fill fill : result.fills) {
                    totalValue += fill.price * fill.quantity;
                    
                    // Create trade record - this records trade for both sides
                    tradeService.createTrade(fill, order.getOrderRefNumber(), order.getClOrdId(),
                            order.getClientId(), order.getSide(), order.getSymbol());
                    
                    // Send fill to contra order (resting order in book)
                    sendContraFill(fill, order.getSide(), sessionID);
                }
                order.setAvgPrice(totalValue / result.filledQty);
                
                // Update status
                if (result.leavesQty == 0) {
                    order.setStatus("FILLED");
                    if (telemetryService != null) {
                        telemetryService.recordOrderFilled();
                    }
                } else {
                    order.setStatus("PARTIALLY_FILLED");
                }
                
                order.setUpdatedAt(LocalDateTime.now());
                orderDao.updateOrder(order);
                
                // Send fill execution report for incoming order
                for (MatchingEngine.Fill fill : result.fills) {
                    executionReportService.sendFill(order, fill, sessionID);
                }
                
                addSessionEvent("ORDER_FILLED", "Order " + order.getClOrdId() + 
                        " filled qty=" + result.filledQty + " @ " + order.getAvgPrice());
            }
            
            // If added to book
            if (result.addedToBook) {
                LOG.info("Order {} added to book with leaves qty {}", 
                        order.getClOrdId(), result.leavesQty);
            }
            
        } catch (Exception e) {
            LOG.error("Error in matching process", e);
        }
    }

    /**
     * Send fill execution report to the contra (resting) order
     * Delegates to ExecutionReportService for transactional handling
     */
    private void sendContraFill(MatchingEngine.Fill fill, String incomingSide, SessionID sessionID) {
        // Delegate to transactional service method
        executionReportService.processContraFill(fill, sessionID);
    }

    private void validateLogon(Message message, SessionID sessionID) throws RejectLogon {
        // Add custom logon validation here if needed
        // For example, validate credentials from RawData field
        try {
            if (message.isSetField(RawData.FIELD)) {
                String password = message.getString(RawData.FIELD);
                LOG.debug("Logon with password provided");
                // Validate password here if needed
            }
        } catch (FieldNotFound e) {
            // No password field - continue
        }
    }

    private void sendRejectExecutionReport(String clOrdId, String symbol, char side, double qty,
            int rejectReason, String text, SessionID sessionID) {
        try {
            ExecutionReport reject = new ExecutionReport();
            reject.set(new OrderID("NONE"));
            reject.set(new ExecID("REJ-" + System.currentTimeMillis()));
            reject.set(new ExecType(ExecType.REJECTED));
            reject.set(new OrdStatus(OrdStatus.REJECTED));
            reject.set(new Symbol(symbol));
            reject.set(new Side(side));
            reject.set(new LeavesQty(0));
            reject.set(new CumQty(0));
            reject.set(new AvgPx(0));
            reject.set(new ClOrdID(clOrdId));
            reject.set(new OrdRejReason(rejectReason));
            reject.set(new Text(text));
            
            if (qty > 0) {
                reject.set(new OrderQty(qty));
            }
            
            Session.sendToTarget(reject, sessionID);
            LOG.info("Sent reject for order {}: {}", clOrdId, text);
            addSessionEvent("ORDER_REJECTED", "Order " + clOrdId + " rejected: " + text);
            
        } catch (SessionNotFound e) {
            LOG.error("Cannot send reject - session not found", e);
        }
    }

    private void sendCancelReject(String clOrdId, String origClOrdId, String orderId, 
            int rejectReason, String text, SessionID sessionID) {
        try {
            OrderCancelReject reject = new OrderCancelReject();
            reject.set(new OrderID(orderId != null ? orderId : "NONE"));
            reject.set(new ClOrdID(clOrdId));
            reject.set(new OrigClOrdID(origClOrdId));
            reject.set(new OrdStatus(OrdStatus.REJECTED));
            reject.set(new CxlRejResponseTo(CxlRejResponseTo.ORDER_CANCEL_REQUEST));
            reject.set(new CxlRejReason(rejectReason));
            reject.set(new Text(text));
            
            Session.sendToTarget(reject, sessionID);
            LOG.info("Sent cancel reject for order {}: {}", origClOrdId, text);
            addSessionEvent("CANCEL_REJECTED", "Cancel rejected for " + origClOrdId + ": " + text);
            
        } catch (SessionNotFound e) {
            LOG.error("Cannot send cancel reject - session not found", e);
        }
    }

    private void sendBusinessReject(Message refMessage, SessionID sessionID, 
            int rejectReason, String text) {
        try {
            BusinessMessageReject reject = new BusinessMessageReject();
            reject.set(new RefMsgType(refMessage.getHeader().getString(MsgType.FIELD)));
            reject.set(new BusinessRejectReason(rejectReason));
            reject.set(new Text(text));
            
            try {
                reject.set(new RefSeqNum(refMessage.getHeader().getInt(MsgSeqNum.FIELD)));
            } catch (FieldNotFound e) {
                // Skip RefSeqNum
            }
            
            Session.sendToTarget(reject, sessionID);
            LOG.warn("Sent business reject: {}", text);
            addSessionEvent("BUSINESS_REJECT", text);
            
        } catch (Exception e) {
            LOG.error("Cannot send business reject", e);
        }
    }

    private String mapOrdType(char ordType) {
        switch (ordType) {
            case OrdType.MARKET: return "MARKET";
            case OrdType.LIMIT: return "LIMIT";
            case '3': return "STOP"; // FIX Stop order type
            case OrdType.STOP_LIMIT: return "STOP_LIMIT";
            default: return "LIMIT";
        }
    }

    private String mapTimeInForce(char tif) {
        switch (tif) {
            case TimeInForce.DAY: return "DAY";
            case TimeInForce.GOOD_TILL_CANCEL: return "GTC";
            case TimeInForce.IMMEDIATE_OR_CANCEL: return "IOC";
            case TimeInForce.FILL_OR_KILL: return "FOK";
            case TimeInForce.GOOD_TILL_DATE: return "GTD";
            default: return "DAY";
        }
    }

    // Session event tracking

    private void addSessionEvent(String type, String message) {
        SessionEvent event = new SessionEvent(type, message, System.currentTimeMillis());
        sessionEvents.add(event);
        
        // Notify listeners
        for (Consumer<SessionEvent> listener : sessionEventListeners) {
            try {
                listener.accept(event);
            } catch (Exception e) {
                LOG.error("Error notifying session event listener", e);
            }
        }
        
        // Keep only last 1000 events
        while (sessionEvents.size() > 1000) {
            sessionEvents.remove(0);
        }
    }

    public void addSessionEventListener(Consumer<SessionEvent> listener) {
        sessionEventListeners.add(listener);
    }

    public void removeSessionEventListener(Consumer<SessionEvent> listener) {
        sessionEventListeners.remove(listener);
    }

    public List<SessionEvent> getSessionEvents() {
        return new ArrayList<>(sessionEvents);
    }

    public List<SessionEvent> getRecentSessionEvents(int count) {
        int size = sessionEvents.size();
        int start = Math.max(0, size - count);
        return new ArrayList<>(sessionEvents.subList(start, size));
    }

    public boolean isSessionLoggedOn() {
        return sessionLoggedOn;
    }

    public SessionID getCurrentSessionId() {
        return currentSessionId;
    }

    // Session event class
    public static class SessionEvent {
        public final String type;
        public final String message;
        public final long timestamp;

        public SessionEvent(String type, String message, long timestamp) {
            this.type = type;
            this.message = message;
            this.timestamp = timestamp;
        }
    }
}
