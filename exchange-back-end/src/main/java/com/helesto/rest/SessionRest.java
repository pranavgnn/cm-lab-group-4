package com.helesto.rest;

import javax.inject.Inject;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.helesto.core.Exchange;

@Path("/api/session")
@Produces(MediaType.APPLICATION_JSON)
public class SessionRest {

    private static final Logger LOG = LoggerFactory.getLogger(SessionRest.class.getName());

    @Inject
    Exchange exchange;

    public static class SessionStatus {
        public boolean connected;
        public boolean isAccepting;
        public String sessionId;
        public String acceptorPort;
        public int messagesSent;
        public int messagesReceived;

        public SessionStatus(boolean connected, boolean isAccepting, String sessionId, String acceptorPort, int messagesSent, int messagesReceived) {
            this.connected = connected;
            this.isAccepting = isAccepting;
            this.sessionId = sessionId;
            this.acceptorPort = acceptorPort;
            this.messagesSent = messagesSent;
            this.messagesReceived = messagesReceived;
        }
    }

    @GET
    @Operation(summary = "Get session status", description = "Get the current FIX session status for the Exchange")
    @APIResponse(responseCode = "200", description = "Session status retrieved")
    public SessionStatus getSessionStatus() {
        LOG.info("GET /session");
        return new SessionStatus(
                true,
                true,
                "EXCHANGE->BROKER",
                "9876",
                0, // TODO: Get actual message counts
                0
        );
    }

    @POST
    @Path("/events")
    @Operation(summary = "Get session events", description = "Get recent session events")
    @APIResponse(responseCode = "200", description = "Session events retrieved")
    public String getSessionEvents() {
        LOG.info("POST /session/events");
        return "[]"; // TODO: Implement event logging
    }
}
