# 📬 Open-Temp-Mail

[![Deploy to Cloudflare Workers](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/Syntax-Error-1337/Open-Temp-Mail)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Syntax-Error-1337/Open-Temp-Mail)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)

**Open-Temp-Mail** is a modern, high-performance temporary email service built for speed, privacy, and ease of deployment. Engineered with React, Vite, and Cloudflare Workers, it provides a seamless disposable email experience with a premium UI.

---

## ✨ Features

- **🚀 Blazing Fast**: Powered by Cloudflare Workers for edge-latency global performance.
- **🛡️ Privacy First**: Completely anonymous and disposable inboxes.
- **🎨 Stunning UI**: A beautiful, dark-mode focused interface built with **Tailwind CSS v4**.
- **📱 Fully Responsive**: Optimized for mobile, tablet, and desktop experiences.
- **🔐 Secure Access**: Role-based authentication for Admins and Users.
- **📨 Advanced Mailbox Tools**:
    - **⭐ Favorites**: Pin important inboxes for quick access.
    - **🔄 Forwarding Rules**: Set up auto-forwarding to real email addresses.
    - **👁️ Sanitized Viewing**: Safe HTML email rendering with XSS protection.
    - **🔍 Filtering**: Filter by All, Favorites, or Forwarding status.

## 🛠️ Tech Stack

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![D1 Database](https://img.shields.io/badge/Cloudflare_D1-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+
- **Cloudflare Account** (for Workers & D1)
- **Wrangler CLI** (`npm install -g wrangler`)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/open-temp-mail.git
    cd open-temp-mail
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Visit `http://localhost:5173` to view the app.

## 🤝 Contributing

We love contributions! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

- report bugs using our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md)
- suggest features using our [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md)
- please respect our [Code of Conduct](CODE_OF_CONDUCT.md)

## ⚙️ Configuration

Open-Temp-Mail uses `wrangler.toml` for configuration.

| Variable | Description | Example |
| :--- | :--- | :--- |
| `MAIL_DOMAIN` | Your email domain(s), comma-separated | `"example.com, temp.io"` |
| `ADMIN_NAME` | Username for the admin dashboard | `"admin"` |

**Secrets** (Set via `wrangler secret put`):
- `ADMIN_PASSWORD`: Secure password for admin access.
- `JWT_TOKEN`: Random string for session security.
- `RESEND_API_KEY`: (Optional) For sending emails via Resend.
  > **Note**: Resend offers a free tier with 3000 emails/month, which is perfect for personal use.

## 📦 Deployment

### One-Click Deployment
Run the automated setup script to create resources and deploy:
```bash
npm run deploy:setup
```

### Manual Deployment
For detailed steps on manually configuring Cloudflare D1, R2, and Secrets, please refer to our **[Deployment Guide](./DEPLOY.md)**.

## 📂 Project Structure

```bash
open-temp-mail/
├── 📂 src/             # React Frontend Data & Components
├── 📂 worker/          # Cloudflare Worker Backend Logic
├── 📂 scripts/         # Setup & Utility Scripts
├── 📜 wrangler.toml    # Cloudflare Configuration
└── 📄 package.json     # Project Dependencies
```

---

<p align="center">
  Built with ❤️ by the Syntax-Error-1337
</p>
 
