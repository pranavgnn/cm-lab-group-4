FROM maven:3.9.9-eclipse-temurin-11 AS build

WORKDIR /workspace

COPY pom.xml .
COPY src ./src

RUN mkdir -p src/main/resources && touch src/main/resources/import.sql \
	&& mvn -B -DskipTests -Dquarkus.package.type=uber-jar -Dquarkus.datasource.db-kind=postgresql package \
    && cp target/*-runner.jar target/app.jar

FROM eclipse-temurin:11-jre-jammy

ENV APP_HOME=/opt/app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends tini \
	&& rm -rf /var/lib/apt/lists/* \
	&& mkdir -p $APP_HOME

WORKDIR $APP_HOME

COPY --from=build /workspace/target/app.jar app.jar

EXPOSE 8090

ENTRYPOINT ["tini", "--", "java", "-jar", "app.jar"]
