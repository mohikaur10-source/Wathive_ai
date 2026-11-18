# WatHive

> **Meet your people.**
> A centralized community event platform built exclusively for University of Waterloo students, combining smart event aggregation with algorithmic platonic buddy matching.

## Overview

Information overload makes it hard to find the right campus events, and showing up alone can be a barrier. WatHive solves both. By leveraging automated collation engines to scrape and structure events from across campus, combined with a unique compatibility engine, WatHive helps UWaterloo students filter through the noise. Using personality-based questions, WatHive determines compatibility to perfectly match students with similar, verified peers who are already attending the same event.

## Core Capabilities

| Feature | Description | Core Components |
| --- | --- | --- |
| **Automated Aggregation** | Scrapes and structures WUSA and campus events into a centralized feed. | `wusaCollector.ts`, `htmlParser.ts`, `eventAggregationEngine.ts`
| **Platonic Buddy Matching** | Asks personality-based questions to determine compatibility and match students with event buddies. Provides chat ice-breakers to kickstart conversations.| `compatibilityEngine.ts`, `PersonalityQuizModal.tsx`
| **Verified UW Community** | Secure environment requiring strict University of Waterloo verification. | `UWVerificationModal.tsx`, `AdminModerationModal.tsx`
| **Interactive Discovery** | Integrated campus mapping to visually discover live events. | `CampusEventMap.tsx`, `LocationMapPicker.tsx`
| **Student Ecosystem** | Built-in notifications, direct messaging, and a detailed filtering system for checking events. | `CalendarNotificationsTab.tsx`, `StudentDiscountsModal.tsx`

## Technical Stack

| Layer | Technologies Used | Key Repository Files |
| --- | --- | --- |
| **Frontend** | React, TypeScript, Vite | `vite.config.ts`, `tsconfig.json`
| **Backend** | Custom Server / Data Pipelines | `server.ts`, `scheduler.ts`
| **Database** | SQLite (Local caching for scraped events) | `wusa_collector.db`
| **Package Manager** | Bun | `bun.lock`

## Getting Started

### Prerequisites

* [Bun](https://bun.sh/)
* Git

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/mohikaur10-source/Wathive_ai.git
cd Wathive_ai

```


2. **Install dependencies:**
```bash
bun install 

```


3. **Environment Setup:** Create your environment variables from the provided example.


```bash
cp .env.example .env

```


4. **Start the development environment:**
```bash
bun run dev

```



## Team

Built by a collaborative group of University of Waterloo students across different years of study:

* **Armin Zubair**
* **Isha Saxena**
* **Vanshika Bansal**
* **Mohi Kambo**
* **Elleena**
* **Lakshmi**
