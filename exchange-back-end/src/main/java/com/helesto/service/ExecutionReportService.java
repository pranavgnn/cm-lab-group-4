package com.helesto.service;

import java.util.concurrent.Callable;

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
import quickfix.field.Side;
import quickfix.field.Symbol;
import quickfix.fix44.ExecutionReport;
import quickfix.fix44.NewOrderSingle;
import quickfix.fix44.OrderCancelRequest;

@ApplicationScoped
public class ExecutionReportService {

    private static final Logger LOG = LoggerFactory.getLogger(ExecutionReportService.class.getName());

    @Inject
    Exchange exchange;

    @Inject
    OrderDao orderDao;

    public void executionReport(NewOrderSingle newOrderSingle, SessionID sessionID) throws FieldNotFound, SessionNotFound {
        LOG.info("Processing NewOrderSingle");
        
        // Create execution report
        ExecutionReport executionReport = new ExecutionReport();
        executionReport.getHeader().setField(new ClOrdID(newOrderSingle.getClOrdID().getValue()));
        executionReport.getHeader().setField(new OrdStatus(OrdStatus.NEW));
        executionReport.getHeader().setField(new ExecID("EXEC-001"));
        
        // Send via FIX
        Session.sendToTarget(executionReport, sessionID);
        LOG.info("ExecutionReport sent");
    }

    public void executionReport(OrderCancelRequest orderCancelRequest, SessionID sessionID) throws FieldNotFound, SessionNotFound {
        LOG.info("Processing OrderCancelRequest");
        
        // Create execution report for cancel
        ExecutionReport executionReport = new ExecutionReport();
        executionReport.getHeader().setField(new ClOrdID(orderCancelRequest.getClOrdID().getValue()));
        executionReport.getHeader().setField(new OrdStatus(OrdStatus.CANCELED));
        executionReport.getHeader().setField(new ExecID("EXEC-002"));
        
        // Send via FIX
        Session.sendToTarget(executionReport, sessionID);
        LOG.info("ExecutionReport (Cancel) sent");
    }

    @Transactional
    public void updateOrderAndSendExecutionReport(OrderEntity order, SessionID sessionID) throws SessionNotFound {
        LOG.info("Updating order and sending execution report");
        orderDao.updateOrder(order);
        
        // Send execution report via FIX
        try {
            ExecutionReport executionReport = new ExecutionReport();
            executionReport.getHeader().setField(new ExecID("EXEC-003"));
            Session.sendToTarget(executionReport, sessionID);
        } catch (Exception e) {
            LOG.error("Error sending execution report", e);
        }
    }
}
