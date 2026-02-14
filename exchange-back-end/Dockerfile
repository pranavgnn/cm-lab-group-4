FROM openjdk:11-jre-slim

ENV APP_HOME=/opt/app
RUN mkdir -p $APP_HOME

WORKDIR $APP_HOME

COPY exchange-back-end/target/exchange-back-end-1.0.0-SNAPSHOT-runner.jar app.jar

EXPOSE 8090

ENTRYPOINT ["java", "-jar", "app.jar"]
