---
title: "Spring Boot 4.1: gRPC Auto-Configuration, SSRF Protection, and Smarter Connections"
date: 2026-07-05
draft: false
description: "Spring Boot 4.1 lands with first-class gRPC support, built-in SSRF mitigation via InetAddressFilter, lazy JDBC connection fetching, and observability upgrades."
summary: "Spring Boot 4.1 brings gRPC auto-configuration into the core, hardens HTTP clients against SSRF, and adds lazy connection fetching — here's what to adopt first."
tags: ["java", "spring-boot", "grpc", "security", "release-news", "backend"]
categories: ["Backend Development"]
featured_image: "featured.jpg"
keywords: ["spring boot 4.1 features", "spring boot grpc", "ssrf mitigation spring", "lazy connection datasource", "spring boot release notes"]
---

Spring Boot 4.1 shipped on June 10, 2026 — the first minor release on the Boot 4.x line that arrived last November. After building Spring services for the better part of a decade, I'd call this a quietly important release: no big-bang rewrites, but several features that solve problems most enterprise teams have been hand-rolling for years.

Here's what stands out, and what I'd adopt first.

## gRPC Becomes a First-Class Citizen

The headline feature: **Spring gRPC auto-configuration is now part of Spring Boot itself**, for both servers and clients, supporting standalone Netty and Servlet HTTP/2 transports.

Two pieces make this feel genuinely "Spring" rather than bolted on:

- **`@GrpcAdvice`** — centralized exception handling for gRPC services, mirroring the `@ControllerAdvice` pattern every Spring MVC developer already knows. If you read my [Spring Boot best practices post]({{< ref "/blog/spring-boot-best-practices" >}}), you know I consider centralized exception handling non-negotiable — now the same discipline extends to gRPC without custom interceptor plumbing.
- **Auto-configured `ObservationGrpcServerInterceptor`** — server-side metrics and tracing through Micrometer Observation, with support for custom conventions. Your gRPC endpoints show up in the same observability stack as your REST endpoints, for free.

If your organization runs a mixed REST/gRPC estate (increasingly common in microservices platforms), this removes a whole category of homegrown starter modules.

## SSRF Mitigation Built Into HTTP Clients

This is the feature I'd deploy first. Both blocking and reactive HTTP clients can now be configured with an **`InetAddressFilter`** that blocks outgoing requests to specific addresses.

Server-Side Request Forgery is consistently in the OWASP Top 10, and the classic attack path is an application that fetches user-supplied URLs being tricked into calling internal endpoints — cloud metadata services (`169.254.169.254`), internal admin APIs, and the like. Until now, defending against this in Spring meant custom `ClientHttpRequestFactory` wrappers or network-layer policy. Having a supported, declarative filter in the framework means the security baseline goes up for everyone.

If your app fetches any externally-influenced URL, turn this on before you touch anything else in 4.1.

## Lazy JDBC Connection Fetching

A new `spring.datasource.connection-fetch` property (`eager` or `lazy`) wraps the pooled `DataSource` in a `LazyConnectionDataSourceProxy` when set to `lazy` — a physical connection is only taken from the pool when a JDBC statement actually executes.

Why this matters in practice: with the traditional eager model, a transaction holds a pool connection for its entire duration — including time spent on cache reads, HTTP calls, or business logic that never touches the database. On high-throughput services, that's pool exhaustion waiting to happen. I've debugged exactly this failure mode in payment systems; the fix used to require manually wiring the proxy. Now it's one property.

## Observability and Startup Improvements

A few smaller items that add up:

- **`@Async` context propagation** — observation context now automatically propagates to methods running on separate threads. Traces no longer mysteriously break at every `@Async` boundary.
- **OTLP improvements** — a `management.opentelemetry.enabled` toggle, OTLP exemplar support, and **SSL bundles for OTLP exporters** (finally, mTLS to your collector without custom exporter beans).
- **Async JPA bootstrap** — the new `spring.jpa.bootstrap` property enables background Spring Data JPA bootstrapping, cutting startup time for applications with large JPA models. If you have hundreds of entities, measure this.
- **Redis listener auto-configuration** — `@RedisListener` endpoints now get a default `RedisMessageListenerContainer` without manual wiring.
- **Log4j configurable file rotation** — four strategies: size, time, size-and-time, and cron.

## Platform Baseline Notes

Spring Boot 4.1 moves the Kotlin baseline to **Kotlin 2.3**. If you're still on Boot 3.x, remember the 4.x line is built on Spring Framework 7, Jakarta EE 11, and a Java 17+ baseline — the 3.x → 4.x jump is the bigger migration; 4.0 → 4.1 is routine.

## My Adoption Order

1. **`InetAddressFilter`** on any service fetching external URLs — it's a security win with near-zero risk.
2. **Lazy connection fetching** on high-throughput services with mixed DB/non-DB work — after load testing.
3. **gRPC auto-configuration** — replace homegrown gRPC starters incrementally.
4. **OTLP SSL bundles and `@Async` propagation** — if you run OpenTelemetry, this cleans up real gaps.

Minor releases like this are where Spring earns its keep in the enterprise: the framework keeps absorbing the boilerplate we all wrote by hand.

## Sources

- [Spring Boot 4.1.0 Available Now (spring.io)](https://spring.io/blog/2026/06/10/spring-boot-4/)
- [Spring Boot 4.1 Release Notes (GitHub Wiki)](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.1-Release-Notes)
- [InfoQ: Spring Boot 4.1 Adds gRPC Auto-Configuration, SSRF Mitigation, and Kotlin 2.3 Support](https://www.infoq.com/news/2026/06/spring-boot-4-1/)
