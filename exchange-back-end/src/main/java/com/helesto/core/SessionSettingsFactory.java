package com.helesto.core;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import javax.inject.Singleton;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import quickfix.ConfigError;
import quickfix.SessionSettings;

@Singleton
public class SessionSettingsFactory {

    private static final Logger LOG = LoggerFactory.getLogger(SessionSettingsFactory.class.getName());

    public SessionSettingsFactory() {
        LOG.info("SessionSettingsFactory Constructor");
    }

    public SessionSettings getSessionSettings() throws ConfigError {
        LOG.info("getSessionSettings called");
        
        // FIX 4.4 Acceptor settings
        String settings = "[DEFAULT]\n" +
                "ConnectionType=acceptor\n" +
                "StartTime=00:00:00\n" +
                "EndTime=00:00:00\n" +
                "HeartBtInt=30\n" +
                "ReconnectInterval=5\n" +
                "FileStorePath=./target/data/exchange\n" +
                "FileLogPath=./target/logs/exchange\n" +
                "UseDataDictionary=Y\n" +
                "DataDictionary=FIX44.xml\n" +
                "ValidateUserDefinedFields=N\n" +
                "ValidateFieldsOutOfOrder=N\n" +
                "AllowUnknownMsgFields=Y\n" +
                "\n" +
                "[SESSION]\n" +
                "BeginString=FIX.4.4\n" +
                "SenderCompID=EXCHANGE\n" +
                "TargetCompID=BROKER\n" +
                "SocketAcceptPort=9876\n";
        
        ByteArrayInputStream inputStream = new ByteArrayInputStream(settings.getBytes(StandardCharsets.UTF_8));
        return new SessionSettings(inputStream);
    }
}
