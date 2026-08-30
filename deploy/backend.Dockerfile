FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY backend/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY backend/src src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:17-jre
RUN useradd --system --uid 10001 --shell /usr/sbin/nologin app
COPY --from=build /src/target/*.jar /app.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
