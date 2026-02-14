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
import quickfix.LogUtil;
import quickfix.Message;
import quickfix.MessageCracker;
import quickfix.MessageUtils;
import quickfix.RejectLogon;
import quickfix.SessionID;
import quickfix.UnsupportedMessageType;
import quickfix.field.MsgType;
import quickfix.field.RawData;
import quickfix.field.RawDataLength;
import quickfix.fix44.ExecutionReport;

@Singleton
public class TraderApplication extends MessageCracker implements Application {

    private static final Logger LOG = LoggerFactory.getLogger(TraderApplication.class);

    @Inject
    Bootstrap bootstrap;

    @Inject
    ExecutionReportService executionReportService;

    public TraderApplication() {
        LOG.info("TraderApplication Constructor");
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
        if (isMessageOfType(message, MsgType.LOGON)) {
            addLogonField(message, sessionID);
        }
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
        try {
            crack(message, sessionID);
        } catch (UnsupportedMessageType e) {
            LOG.error("UnsupportedMessageType: {}", message.toRawString(), e);
        }
    }

    private void addLogonField(Message message, SessionID sessionID) {
        LOG.debug("Adding Logon fields");
        try {
            // Tag 95 RawDataLength
            message.getHeader().setField(new RawDataLength(bootstrap.getTrader().getPassword().length()));
            // Tag 96 RawData
            message.getHeader().setField(new RawData(bootstrap.getTrader().getPassword()));
        } catch (Exception e) {
            LOG.error("Error adding logon fields", e);
        }
    }

    private boolean isMessageOfType(Message message, String msgType) {
        try {
            return message.getHeader().getString(MsgType.FIELD).equals(msgType);
        } catch (FieldNotFound e) {
            return false;
        }
    }

    public void onMessage(ExecutionReport executionReport, SessionID sessionID)
            throws FieldNotFound, IncorrectDataFormat, IncorrectTagValue, UnsupportedMessageType {
        LOG.info("ExecutionReport received");
        try {
            executionReportService.processExecutionReport(executionReport, sessionID);
        } catch (Exception e) {
            LOG.error("Error processing ExecutionReport", e);
        }
    }

}
