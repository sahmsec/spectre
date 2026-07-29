<div align="center">

# Spectre

**Web reconnaissance and vulnerability hunting, right in your browser.**

A Chrome and Edge extension that surfaces the APIs, endpoints, secrets, and sensitive
data a web page exposes — a hands-on lab for learning real-world reconnaissance.

<br />

![License](https://img.shields.io/badge/License-Apache_2.0-5e81ac?style=flat-square&labelColor=2e3440)
![Manifest](https://img.shields.io/badge/Manifest-V3-5e81ac?style=flat-square&labelColor=2e3440)
![Platform](https://img.shields.io/badge/Chrome_%7C_Edge-supported-5e81ac?style=flat-square&labelColor=2e3440)
![Version](https://img.shields.io/badge/Version-1.8.1-5e81ac?style=flat-square&labelColor=2e3440)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-5e81ac?style=flat-square&labelColor=2e3440)

<br />

[Getting Started](#getting-started) · [Features](#features) · [Data Types](#supported-data-types) · [Configuration](#advanced-configuration) · [FAQ](#faq)

</div>

---

## Overview

Spectre is a browser extension for web vulnerability hunting and reconnaissance, built as a
hands-on teaching tool. It gives students and security researchers a fast, intelligent way to
surface the hidden surface area of a web page — turning any site into a live lab for learning
how real-world reconnaissance works.

- **Smart detection** — automatically extracts APIs, domains, and sensitive data from a page
- **Deep discovery** — multi-level recursive scanning that misses nothing
- **High throughput** — concurrent scanning architecture for speed at scale
- **Private by design** — all data stays local; nothing is ever uploaded
- **Fully customizable** — bring your own regex, headers, and filter rules

---

## Features

| Capability | What it does |
|---|---|
| **Basic scan** | One click extracts APIs, URLs, domains, files, and credentials from the current page |
| **Deep recursive scan** | Crawls 1–5 levels deep with 2–32 concurrent requests, live-updating as it runs |
| **Batch API testing** | Fires GET / POST requests at discovered endpoints with custom headers and response previews |
| **Data export** | Saves findings to JSON or Excel, auto-named by domain |
| **Custom rules** | Your own regex, request headers, domain blocklists, and injected JavaScript |

**What Spectre surfaces on a page:**

- **API endpoints** — absolute paths, relative paths, RESTful routes
- **Network resources** — URLs, domains, subdomains, ports, path parameters
- **File resources** — JS, CSS, images, audio, and video
- **Sensitive data** — emails, phone numbers, IP addresses, JWTs, auth tokens
- **Security credentials** — AWS keys, GitHub tokens, API keys, and more

---

## Getting Started

### Installation

```bash
git clone https://github.com/sahmsec/spectre.git
```

1. Open your browser's extensions page — `chrome://extensions` or `edge://extensions`
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked** and select the project folder
4. Click the **Spectre** icon in the toolbar to start

### Usage

<details>
<summary><strong>Quick scan</strong></summary>

1. Open the target web page
2. Click the Spectre extension icon
3. Click **Start Scan**
4. Review the results

</details>

<details>
<summary><strong>Deep scan</strong></summary>

1. Switch to the **Deep Scan** page
2. Configure depth and concurrency
3. Click **Start Deep Scan**
4. Watch live results in the new window

</details>

<details>
<summary><strong>API testing</strong></summary>

1. Switch to the **API Test** page
2. Select the data category to test
3. Configure request parameters
4. Run the batch test

</details>

---

## Supported Data Types

**Network and resources**

| Category | Description | Example |
|---|---|---|
| `absoluteApis` | Absolute-path API | `https://api.example.com/users` |
| `relativeApis` | Relative-path API | `/api/v1/users` |
| `urls` | Full URL | `https://example.com/page` |
| `domains` | Domain | `example.com` |
| `subdomains` | Subdomain | `api.example.com` |
| `jsFiles` | JavaScript file | `/static/app.js` |
| `cssFiles` | CSS stylesheet | `/static/style.css` |
| `images` | Image resource | `/img/logo.png` |

**Security-sensitive information**

| Category | Description | Example |
|---|---|---|
| `emails` | Email address | `admin@example.com` |
| `phoneNumbers` | Phone number | `13800138000` |
| `ipAddresses` | IP address | `192.168.1.1` |
| `jwts` | JWT token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `awsKeys` | AWS key | `AKIAIOSFODNN7EXAMPLE` |
| `githubTokens` | GitHub token | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| `credentials` | Auth credentials | `username:password` |

**Other**

| Category | Description |
|---|---|
| `paths` | Path information |
| `parameters` | URL parameters |
| `ports` | Port information |
| `comments` | Code comments |
| `companies` | Company names |
| `cryptoUsage` | Crypto algorithm usage |

---

## Advanced Configuration

**Deep scan parameters**

| Setting | Recommendation |
|---|---|
| Max depth | 2–3 levels (avoids over-crawling) |
| Concurrency | 5–16 (balances speed and stability) |
| Timeout | 5–10 seconds |
| Scan scope | Same-domain, subdomains, or all domains |

**Custom regular expressions**

<details>
<summary>Code examples</summary>

```javascript
// Custom API rule
const customApiRegex = /\/api\/v[0-9]+\/[a-zA-Z]+/g;

// Custom sensitive-info rule
const customSensitiveRegex = /password[=:]\s*[\'"]?([^\'"\s]+)/gi;
```

</details>

**Request headers**

- **Cookie management** — automatically pulls the current site's cookies
- **Custom headers** — any HTTP request header
- **Auth** — Bearer Token, Basic Auth, and more

---

## Architecture

| Module | Role |
|---|---|
| `PatternExtractor` | Regex engine with support for custom rules |
| `ContentExtractor` | Intelligently identifies sensitive information |
| `DeepScanner` | Recursive multi-level discovery |
| `ApiTester` | Batch endpoint verification |

Built on **HTML5 + CSS3**, **JavaScript ES6+**, and the **Chrome Extension (MV3)** API.
Data is persisted locally with **IndexedDB** and **Chrome Storage**, with an in-memory cache
for responsiveness.

---

## FAQ

<details>
<summary><strong>No results, or very few?</strong></summary>

**Causes** — the target is a system page (`chrome://`, `chrome-extension://`); the page is in
its 5-minute silent-throttle window after a first scan; or a custom rule is too strict.

**Fixes** — scan a normal web page, click **Start Scan** to force a scan, and review your custom
regex rules in settings.

</details>

<details>
<summary><strong>Deep scan has no effect?</strong></summary>

**Causes** — the site requires authentication, concurrency is too high, or the timeout is too low.

**Fixes** — add the site's cookies in settings, lower concurrency to 5–10, and raise the timeout to
10 seconds or more.

</details>

<details>
<summary><strong>Excel file won't open?</strong></summary>

Use an Excel version that supports the XML format, choose **UTF-8** if prompted about encoding, or
export to JSON instead.

</details>

<details>
<summary><strong>Browser feels sluggish?</strong></summary>

Lower the deep-scan concurrency, reduce the maximum depth, and turn off scan options you don't need.

</details>

---

## Security and Compliance

> **Authorized use only.** Spectre is intended for security testing within an authorized scope and
> for educational use. You are solely responsible for how you use it — follow each target's security
> policy and comply with all applicable laws.

- **Local-only** — all data is stored on your machine via IndexedDB and is never uploaded
- **One-click wipe** — clear all scan data whenever you want

---

## Contributing

Contributions are welcome. Open an issue with clear reproduction steps for bugs, or a described use
case for feature requests. For code: fork, branch (`git checkout -b feature/your-feature`), commit,
push, and open a pull request.

---


## License

Licensed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.

<details>
<summary>Changelog — v1.8.1</summary>

- **Scan performance** — result render cap, event delegation, and DocumentFragment rendering; deduplication reduced from O(n²) to O(n); idle-time scheduling to eliminate stutter on large data
- **Deep scan** — third-party JS library blocking (configurable), artificial delays removed for a noticeable speed-up
- **Basic scan** — manual scans now fetch same-origin external JS (per-file timeout + overall deadline); built-in fallback regexes in the content script
- **Extraction accuracy** — multi-cloud AK/SK patterns (AWS, Alibaba, Tencent, JD, Alipay, Apple); upgraded ID, JWT, IP, and phone regexes with version migration; false-positive filtering
- **Interface** — two-column high-density layout, larger window, visual polish; auto-collapsing action buttons
- **JS Hook** — reversible injection/shutdown; reversible anti-debugging presets
- **Engineering** — normalized file naming and dead-code cleanup

</details>

---

<div align="center">
  <sub><strong>Spectre</strong> — teaching the next generation to find what others miss.</sub>
</div>
