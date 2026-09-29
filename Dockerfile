# アプリ全体（React の画面 ＋ Spring Boot の API）を1つのコンテナにまとめる手順書。
#
# 画面は Spring Boot の jar に同梱し、同じサーバーの同じポートから配る
# （docs/07_deployment.md 12章）。こうすると画面と API が「同じオリジン」になり、
# CORS の許可設定も、CSRF トークンを画面側から読むための手当ても不要になる。
#
# 3段構えにしている理由：
#   1段目で画面をビルドし、2段目でそれを取り込んで jar を作り、
#   3段目には出来上がった jar と実行環境だけを入れる。
#   Node も Gradle も本番のイメージには残らないため、大きさと危険が減る。
#
# ビルドはリポジトリのルートで実行する（backend/ ではない）:
#   docker build -t taskboard-backend .

# --- 1段目：画面（React）をビルドする ---
# Node の版数は CI（.github/workflows/ci.yml）と揃える
FROM node:24-alpine AS frontend
WORKDIR /frontend

# 先に依存の定義だけを入れて依存を取得する。
# ソースだけが変わったときに、npm ci をやり直さずに済む
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# 型チェック・lint・テストは CI で実行済みのため、ここではビルドだけ行う
RUN npm run build

# --- 2段目：サーバー（Spring Boot）をビルドする ---
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# ここも同じく、先に依存の定義だけを入れて依存を取得する
COPY backend/gradlew ./
COPY backend/gradle ./gradle
COPY backend/build.gradle.kts backend/settings.gradle.kts ./
RUN chmod +x ./gradlew && ./gradlew --no-daemon dependencies

COPY backend/src ./src
COPY backend/config ./config

# 1段目で作った画面を、Spring Boot が静的ファイルとして配る場所に置く。
# src/main/resources/static/ に入れたものは、jar の中から "/" で配信される。
#
# ★この COPY は上の「COPY backend/src ./src」より後に置くこと。
#   先に置くと src ごと上書きされ、画面がイメージに入らない
COPY --from=frontend /frontend/dist ./src/main/resources/static

# テストはビルド前に CI で実行済みのため、ここでは実行しない
RUN ./gradlew --no-daemon clean bootJar -x test

# --- 3段目：実行 ---
FROM eclipse-temurin:21-jre
WORKDIR /app

# root のままで動かさない（乗っ取られたときの被害を小さくするため）
RUN useradd --system --create-home taskboard
USER taskboard

COPY --from=build /app/build/libs/*.jar app.jar

# 実際の待ち受けポートは環境変数 PORT で決まる（application.yml）
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
