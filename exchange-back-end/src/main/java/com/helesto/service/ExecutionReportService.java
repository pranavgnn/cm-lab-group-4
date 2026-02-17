package com.helesto.service;

import java.time.LocalDateTime;
import java.util.UUID;

import javax.enterprise.context.ApplicationScoped;
import javax.inject.Inject;
import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.helesto.core.Exchange;
import com.helesto.dao.OrderDao;
import com.helesto.model.OrderEntity;

import quickfix.FieldNotFound;
import quickfix.Session;
import quickfix.SessionID;
import quickfix.SessionNotFound;
import quickfix.field.AvgPx;
import quickfix.field.ClOrdID;
import quickfix.field.CumQty;
import quickfix.field.ExecID;
import quickfix.field.ExecType;
import quickfix.field.LeavesQty;
import quickfix.field.OrdStatus;
import quickfix.field.OrderID;
import quickfix.field.OrderQty;
import quickfix.field.Side;
import quickfix.field.Symbol;
import quickfix.fix44.ExecutionReport;
import quickfix.fix44.NewOrderSingle;
import quickfix.fix44.OrderCancelRequest;

@ApplicationScoped
public class ExecutionReportService {

    private static final Logger LOG = LoggerFactory.getLogger(ExecutionReportService.class.getName());
    private static long execIdCounter = System.currentTimeMillis();

    @Inject
    Exchange exchange;

    @Inject
    OrderDao orderDao;

    @Transactional
    public void executionReport(NewOrderSingle newOrderSingle, SessionID sessionID) throws FieldNotFound, SessionNotFound {
        LOG.info("Processing NewOrderSingle from FIX");
        
        String clOrdId = newOrderSingle.getClOrdID().getValue();
        String symbol = newOrderSingle.getSymbol().getValue();
        char side = newOrderSingle.getSide().getValue();
        double qty = newOrderSingle.getOrderQty().getValue();
        double price = 0;
        try {
            price = newOrderSingle.getPrice().getValue();
        } catch (FieldNotFound e) {
            // Market order - no price
        }
        
        // Generate unique order ID
        String orderID = "ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        
        // Persist order in Exchange database
        OrderEntity order = new OrderEntity();
        order.setClOrdId(clOrdId);
        order.setOrderRefNumber(orderID);
        order.setSymbol(symbol);
        order.setSide(String.valueOf(side));
        order.setQuantity((long) qty);
        order.setPrice(price);
        order.setStatus("NEW");
        order.setFilledQty(0L);
        order.setCreatedAt(LocalDateTime.now());
        orderDao.persistOrder(order);
        
        LOG.info("Order persisted in Exchange: {} -> {}", clOrdId, orderID);
        
        // Send NEW execution report
        sendExecutionReport(order, OrdStatus.NEW, ExecType.NEW, sessionID);
        
        // For simulation: auto-fill order immediately
        autoFillOrder(order, sessionID);
    }

    @Transactional
    public void executionReport(OrderCancelRequest orderCancelRequest, SessionID sessionID) throws FieldNotFound, SessionNotFound {
        LOG.info("Processing OrderCancelRequest from FIX");
        
        String origClOrdId = orderCancelRequest.getOrigClOrdID().getValue();
        
        // Find the original order
        OrderEntity order = orderDao.findByClOrdId(origClOrdId);
        if (order == null) {
            LOG.warn("Order not found for cancel: {}", origClOrdId);
            // Send reject
            return;
        }
        
        // Update order status
        order.setStatus("CANCELED");
        orderDao.updateOrder(order);
        
        LOG.info("Order canceled: {}", origClOrdId);
        
        // Send CANCELED execution report
        sendExecutionReport(order, OrdStatus.CANCELED, ExecType.CANCELED, sessionID);
    }

    private void autoFillOrder(OrderEntity order, SessionID sessionID) throws SessionNotFound {
        // Simulate immediate fill
        order.setFilledQty(order.getQuantity());
        order.setStatus("FILLED");
        order.setAvgPrice(order.getPrice());
        orderDao.updateOrder(order);
        
        LOG.info("Order auto-filled: {} qty={}", order.getClOrdId(), order.getFilledQty());
        
        // Send FILL execution report
        sendExecutionReport(order, OrdStatus.FILLED, ExecType.FILL, sessionID);
    }

    private void sendExecutionReport(OrderEntity order, char ordStatus, char execType, SessionID sessionID) throws SessionNotFound {
        ExecutionReport executionReport = new ExecutionReport();
        
        // Required fields
        executionReport.set(new OrderID(order.getOrderRefNumber() != null ? order.getOrderRefNumber() : order.getClOrdId()));
        executionReport.set(new ExecID("EXEC-" + (++execIdCounter)));
        executionReport.set(new ExecType(execType));
        executionReport.set(new OrdStatus(ordStatus));
        executionReport.set(new Symbol(order.getSymbol()));
        executionReport.set(new Side(order.getSide().charAt(0)));
        executionReport.set(new OrderQty(order.getQuantity()));
        executionReport.set(new ClOrdID(order.getClOrdId()));
        
        // Fill information
        long filledQty = order.getFilledQty() != null ? order.getFilledQty() : 0L;
        long totalQty = order.getQuantity() != null ? order.getQuantity() : 0L;
        executionReport.set(new LeavesQty((double)(totalQty - filledQty)));
        executionReport.set(new CumQty((double)filledQty));
        executionReport.set(new AvgPx(order.getAvgPrice() != null ? order.getAvgPrice() : order.getPrice()));
        
        // Send via FIX
        Session.sendToTarget(executionReport, sessionID);
        LOG.info("ExecutionReport sent: {} status={} execType={}", order.getClOrdId(), ordStatus, execType);
    }
}
