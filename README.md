<div align="center">
    <img src="https://raw.githubusercontent.com/kollakek1/Relay/refs/heads/main/public/banner.png">
<br />

<h1>⚡ RELAY</h1>

<p>
    <b>The Enterprise-Grade Workflow Engine for Modern Teams.</b>
</p>

<p>
    <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
</p>
</div>

---

## 🚀 Overview

**Relay** is a high-performance, open-source workflow engine designed to handle complex business logic with ease. Unlike standard task trackers, Relay focuses on the **flow**—moving tasks through strictly defined pipelines, ensuring that the right people do the right work at the right time.

## ✨ Key Features

- 🏗 **Dynamic Workflow Builder:** Create custom pipelines with as many stages as your business needs.
- 🔐 **Role-Based Access (RBAC):** Bind specific stages to specific roles (Designers, Developers, Managers).
- 📦 **The Task Pool:** "Claim" system where eligible team members pick up tasks from a shared queue.
- ⚡ **Electric Glass UI:** A stunning, high-performance dark-mode interface built with `shadcn/ui`.
- 🤖 **Telegram Integration:** Get real-time notifications when a task lands in your department's pool.

## 🛠 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (Strict)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Better-Auth (SSO & Credentials)
- **UI:** Tailwind CSS + Radix UI + Lucide Icons

## 🏁 Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kollakek1/relay.git
   ```
2. **Install dependencies:**
   ```bash
   npm i
   ```
3. **Setup Environment:**
   Create a `.env` file and add your `DATABASE_URL` and `BASE_URL`.
4. **Initialize Database & Seed Root:**
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
5. **Run the engine:**
   ```bash
   npm run dev
   ```

<div align="center"> Developed with ❤️ by <b>kollakek</b> </div>
