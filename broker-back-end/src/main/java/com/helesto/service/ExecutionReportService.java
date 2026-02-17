package com.helesto.service;

import javax.enterprise.context.ApplicationScoped;
import javax.inject.Inject;
import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.helesto.dao.OrderDao;
import com.helesto.model.OrderEntity;

import quickfix.FieldNotFound;
import quickfix.SessionID;
import quickfix.field.AvgPx;
import quickfix.field.ClOrdID;
import quickfix.field.CumQty;
import quickfix.field.ExecType;
import quickfix.field.OrdStatus;
import quickfix.field.OrderID;
import quickfix.fix44.ExecutionReport;

@ApplicationScoped
public class ExecutionReportService {

    private static final Logger LOG = LoggerFactory.getLogger(ExecutionReportService.class);

    @Inject
    OrderDao orderDao;

    public ExecutionReportService() {
        LOG.info("ExecutionReportService Constructor");
    }

    @Transactional
    public void processExecutionReport(ExecutionReport executionReport, SessionID sessionID) throws FieldNotFound {
        LOG.info("Processing ExecutionReport");

        try {
            String clOrdID = executionReport.getString(ClOrdID.FIELD);
            String orderID = executionReport.getString(OrderID.FIELD);
            char ordStatus = executionReport.getChar(OrdStatus.FIELD);
            char execType = executionReport.getChar(ExecType.FIELD);

            LOG.info("ExecutionReport - ClOrdID: {}, OrderID: {}, Status: {}, ExecType: {}", 
                     clOrdID, orderID, ordStatus, execType);

            // Find and update order in database
            OrderEntity order = orderDao.findByClOrdId(clOrdID);
            if (order != null) {
                // Update order status based on OrdStatus
                order.setStatus(mapOrdStatus(ordStatus));
                order.setOrderRefNumber(orderID);
                
                // Update fill information
                try {
                    double cumQty = executionReport.getDouble(CumQty.FIELD);
                    order.setFilledQty((long) cumQty);
                } catch (FieldNotFound e) {
                    // CumQty not present
                }
                
                try {
                    double avgPx = executionReport.getDouble(AvgPx.FIELD);
                    order.setAvgPrice(avgPx);
                } catch (FieldNotFound e) {
                    // AvgPx not present
                }
                
                orderDao.updateOrder(order);
                LOG.info("Order updated: {} -> status={}, filledQty={}", 
                         clOrdID, order.getStatus(), order.getFilledQty());
            } else {
                LOG.warn("Order not found for ClOrdID: {}", clOrdID);
            }

        } catch (FieldNotFound e) {
            LOG.error("Required field not found in ExecutionReport", e);
        }
    }

    private String mapOrdStatus(char ordStatus) {
        switch (ordStatus) {
            case OrdStatus.NEW: return "NEW";
            case OrdStatus.PARTIALLY_FILLED: return "PARTIALLY_FILLED";
            case OrdStatus.FILLED: return "FILLED";
            case OrdStatus.CANCELED: return "CANCELED";
            case OrdStatus.REJECTED: return "REJECTED";
            case OrdStatus.PENDING_CANCEL: return "PENDING_CANCEL";
            case OrdStatus.PENDING_NEW: return "PENDING_NEW";
            default: return "UNKNOWN";
        }
    }
}
