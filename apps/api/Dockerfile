FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

# 루트 컨텍스트 기준 경로로 수정
COPY apps/api/gradlew gradlew
COPY apps/api/gradle gradle
COPY apps/api/build.gradle.kts apps/api/settings.gradle.kts ./
COPY apps/api/src src
RUN chmod +x gradlew
RUN ./gradlew bootJar -x test

FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
ENV JAVA_OPTS=""
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]