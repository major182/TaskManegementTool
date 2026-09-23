# バックエンド（Spring Boot）をコンテナとして動かすための手順書。
# App Runner・ECS・EC2 のいずれでも同じものが使える（docs/02_tech-stack.md 3.4）。
#
# 2段構えにしている理由：
#   1段目でビルドし、2段目には出来上がった jar と実行環境だけを入れる。
#   Gradle や依存ライブラリを本番のイメージに持ち込まずに済み、大きさと危険が減る。

# --- 1段目：ビルド ---
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# 先に Wrapper と依存の定義だけを入れて依存を取得する。
# ソースだけが変わったときに、依存のダウンロードをやり直さずに済む
COPY gradlew ./
COPY gradle ./gradle
COPY build.gradle.kts settings.gradle.kts ./
RUN chmod +x ./gradlew && ./gradlew --no-daemon dependencies

COPY src ./src
COPY config ./config
# テストはビルド前に CI で実行済みのため、ここでは実行しない
RUN ./gradlew --no-daemon clean bootJar -x test

# --- 2段目：実行 ---
FROM eclipse-temurin:21-jre
WORKDIR /app

# root のままで動かさない（乗っ取られたときの被害を小さくするため）
RUN useradd --system --create-home taskboard
USER taskboard

COPY --from=build /app/build/libs/*.jar app.jar

# 実際の待ち受けポートは環境変数 PORT で決まる（application.yml）
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
