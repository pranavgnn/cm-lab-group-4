package com.helesto.core;

import javax.inject.Inject;
import javax.inject.Singleton;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.helesto.service.ExecutionReportService;

import quickfix.Application;
import quickfix.DoNotSend;
import quickfix.FieldNotFound;
import quickfix.IncorrectDataFormat;
import quickfix.IncorrectTagValue;
import quickfix.Message;
import quickfix.MessageCracker;
import quickfix.RejectLogon;
import quickfix.SessionID;
import quickfix.UnsupportedMessageType;
import quickfix.fix44.NewOrderSingle;
import quickfix.fix44.OrderCancelRequest;

@Singleton
public class ExchangeApplication extends MessageCracker implements Application {

    private static final Logger LOG = LoggerFactory.getLogger(ExchangeApplication.class);

    @Inject
    ExecutionReportService executionReportService;

    public ExchangeApplication() {
        LOG.info("ExchangeApplication Constructor");
    }

    @Override
    public void onCreate(SessionID sessionID) {
        LOG.info("onCreate - SessionID: {}", sessionID);
    }

    @Override
    public void onLogon(SessionID sessionID) {
        LOG.info("onLogon - SessionID: {}", sessionID);
    }

    @Override
    public void onLogout(SessionID sessionID) {
        LOG.info("onLogout - SessionID: {}", sessionID);
    }

    @Override
    public void toAdmin(Message message, SessionID sessionID) {
        LOG.debug("toAdmin - SessionID: {}", sessionID);
    }

    @Override
    public void fromAdmin(Message message, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, RejectLogon {
        LOG.debug("fromAdmin - SessionID: {}", sessionID);
    }

    @Override
    public void toApp(Message message, SessionID sessionID) throws DoNotSend {
        LOG.debug("toApp - SessionID: {}", sessionID);
    }

    @Override
    public void fromApp(Message message, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, UnsupportedMessageType {
        LOG.info("fromApp - Message received");
        crack(message, sessionID);
    }

    public void onMessage(NewOrderSingle newOrderSingle, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, UnsupportedMessageType {
        LOG.info("onMessage NewOrderSingle received");
        try {
            executionReportService.executionReport(newOrderSingle, sessionID);
        } catch (Exception e) {
            LOG.error("Error processing NewOrderSingle", e);
        }
    }

    public void onMessage(OrderCancelRequest orderCancelRequest, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, UnsupportedMessageType {
        LOG.info("onMessage OrderCancelRequest received");
        try {
            executionReportService.executionReport(orderCancelRequest, sessionID);
        } catch (Exception e) {
            LOG.error("Error processing OrderCancelRequest", e);
        }
    }

}
