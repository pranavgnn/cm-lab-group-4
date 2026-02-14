package com.helesto.service;

import javax.enterprise.context.ApplicationScoped;
import javax.inject.Inject;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import quickfix.FieldNotFound;
import quickfix.SessionID;
import quickfix.field.ClOrdID;
import quickfix.field.OrderID;
import quickfix.field.OrdStatus;
import quickfix.fix44.ExecutionReport;

@ApplicationScoped
public class ExecutionReportService {

    private static final Logger LOG = LoggerFactory.getLogger(ExecutionReportService.class);

    public ExecutionReportService() {
        LOG.info("ExecutionReportService Constructor");
    }

    public void processExecutionReport(ExecutionReport executionReport, SessionID sessionID) throws FieldNotFound {
        LOG.info("Processing ExecutionReport");

        try {
            String clOrdID = executionReport.getString(ClOrdID.FIELD);
            String orderID = executionReport.getString(OrderID.FIELD);
            String ordStatus = executionReport.getString(OrdStatus.FIELD);

            LOG.info("ExecutionReport - ClOrdID: {}, OrderID: {}, Status: {}", clOrdID, orderID, ordStatus);

            // TODO: Update order status in database
            // TODO: Broadcast update to WebSocket clients

        } catch (FieldNotFound e) {
            LOG.error("Required field not found in ExecutionReport", e);
        }
    }

}
