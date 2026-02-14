FROM openjdk:11-jre-slim

ENV APP_HOME=/opt/app
RUN mkdir -p $APP_HOME

WORKDIR $APP_HOME

COPY broker-back-end/target/broker-back-end-1.0.0-SNAPSHOT-runner.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
