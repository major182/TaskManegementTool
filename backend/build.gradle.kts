plugins {
	java
	checkstyle
	// 書式のずれ（未使用の import・行末の空白・タブ混在など）を検出・自動修正する
	id("com.diffplug.spotless") version "8.10.2"
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.example"
version = "0.0.1-SNAPSHOT"
description = "Task management tool backend"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	// 死活確認（/actuator/health）。ロードバランサのヘルスチェックに使う
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.flywaydb:flyway-database-postgresql")
	// API を画面から確認・実行できるようにする（docs/02_tech-stack.md 3.1）
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.0")
	runtimeOnly("org.postgresql:postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
	testImplementation("org.springframework.boot:spring-boot-starter-flyway-test")
	testImplementation("org.springframework.boot:spring-boot-starter-security-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testImplementation("org.springframework.boot:spring-boot-testcontainers")
	testImplementation("org.testcontainers:testcontainers-junit-jupiter")
	testImplementation("org.testcontainers:testcontainers-postgresql")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()
}

// ./gradlew check で test と一緒に動く静的チェック（docs/02_tech-stack.md 3.1）
spotless {
	java {
		target("src/**/*.java")
		removeUnusedImports()
		leadingTabsToSpaces(4)
		trimTrailingWhitespace()
		endWithNewline()
	}
}

checkstyle {
	toolVersion = "14.1.0"
	configFile = file("config/checkstyle/checkstyle.xml")
	maxWarnings = 0
}
