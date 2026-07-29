<div align="center">
  <h1 align="center">Spectre</h1>

  <p align="center">
    A web vulnerability-hunting and reconnaissance browser extension
    <br />
    Built for teaching students to discover and understand web security flaws
  </p>
</div>

<!-- ABOUT THE PROJECT -->
## About Spectre

Spectre is a **browser extension** for web vulnerability hunting and reconnaissance, built as a hands-on teaching tool. It gives students and security researchers an efficient, intelligent way to surface the APIs, endpoints, domains, and sensitive information a web page exposes — turning any site into a live lab for learning how real-world reconnaissance works.

### Key Advantages

- **Smart detection**: Automatically extracts APIs, domains, sensitive information and other key data from a page
- **Deep discovery**: Supports multi-level recursive scanning so no potential vulnerability point is missed
- **High throughput**: A concurrent scanning architecture that greatly improves scan speed
- **Modern UI**: Dark-themed design for a great user experience
- **Highly customizable**: Supports custom regular expressions and scan rules

<!-- FEATURES -->
## Core Features

### One-click basic scan

Automatically extracts all kinds of sensitive information from the page:
- **API endpoints**: absolute paths, relative paths, RESTful endpoints
- **Network resources**: URLs, domains, subdomains, ports, path parameters
- **File resources**: JS files, CSS files, images, audio and video
- **Sensitive data**: email addresses, phone numbers, IP addresses, JWTs, auth information
- **Security credentials**: AWS keys, GitHub tokens, API keys and more

### Deep recursive scan

- **Multi-layer discovery**: Supports recursive scanning 1-5 levels deep
- **Concurrency control**: Configurable from 2 to 32 concurrent requests
- **Smart filtering**: Automatically filters out static files and invalid links
- **Live updates**: Results are displayed in real time while the scan runs

### Batch API testing

- **Multiple request methods**: Supports GET, POST and other HTTP methods
- **Batch processing**: Run batch API tests against the scan results
- **Result preview**: Supports response body preview and status code checks
- **Flexible configuration**: Custom request headers and timeouts

### Data export and analysis

- **Multiple formats**: Exports to JSON and Excel
- **Smart naming**: Automatically generates a filename that includes the domain
- **Complete data**: Retains every piece of sensitive information found

### Custom configuration

- **Regular expressions**: Supports custom regex rules
- **Request header configuration**: Flexible cookie and auth configuration
- **Filter rules**: Custom domain blocklists and filter conditions
- **JS script injection**: Supports custom JavaScript scripts

<!-- TECHNOLOGY -->
## Technical Architecture

### Frontend
- **HTML5 + CSS3**: Modern interface design
- **JavaScript ES6+**: Uses the latest JavaScript features
- **Chrome Extension API**: Deep integration with browser extension capabilities

### Core Modules
- **PatternExtractor**: Regular expression engine with support for custom rules
- **ContentExtractor**: Content extractor that intelligently identifies sensitive information
- **DeepScanner**: Deep scanner with recursive discovery
- **ApiTester**: API testing engine for batch endpoint verification

### Data Storage
- **IndexedDB**: Local data storage that protects user privacy
- **Chrome Storage**: Persists configuration
- **In-memory cache**: Improves scan performance and responsiveness

<!-- INSTALLATION -->
## Getting Started

### Installation

1. **Clone the project**
   ```bash
   git clone https://github.com/sahmsec/spectre.git
   ```

2. **Open the browser extensions page**
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`

3. **Enable Developer Mode**

4. **Load the extension**
   Click "Load unpacked" and select the project folder

5. **Start using it**
   Click the Spectre icon in the browser toolbar to get started

### Basic Usage

#### Quick scan
<details>
<summary>Click to view the quick scan steps</summary>

1. Open the target web page
2. Click the Spectre extension icon
3. Click the "Start Scan" button
4. Review the scan results

</details>

#### Deep scan
<details>
<summary>Click to view the deep scan steps</summary>

1. Switch to the "Deep Scan" page
2. Configure the scan parameters (depth, concurrency)
3. Click "Start Deep Scan"
4. View live results in the new window

</details>

#### API testing
<details>
<summary>Click to view the API testing steps</summary>

1. Switch to the "API Test" page
2. Select the data category you want to test
3. Configure the request parameters
4. Run the batch test

</details>

<!-- DATA CATEGORIES -->
## Supported Data Types

### Network and Resources
| Category | Description | Example |
|------|------|------|
| `absoluteApis` | Absolute-path API | `https://api.example.com/users` |
| `relativeApis` | Relative-path API | `/api/v1/users` |
| `urls` | Full URL | `https://example.com/page` |
| `domains` | Domain information | `example.com` |
| `subdomains` | Subdomain | `api.example.com` |
| `jsFiles` | JavaScript file | `/static/app.js` |
| `cssFiles` | CSS stylesheet | `/static/style.css` |
| `images` | Image resource | `/img/logo.png` |

### Security-sensitive Information
| Category | Description | Example |
|------|------|------|
| `emails` | Email address | `admin@example.com` |
| `phoneNumbers` | Phone number | `13800138000` |
| `ipAddresses` | IP address | `192.168.1.1` |
| `jwts` | JWT token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `awsKeys` | AWS key | `AKIAIOSFODNN7EXAMPLE` |
| `githubTokens` | GitHub token | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| `credentials` | Auth credentials | `username:password` |

### Other Information
| Category | Description |
|------|------|
| `paths` | Path information |
| `parameters` | URL parameters |
| `ports` | Port information |
| `comments` | Code comments |
| `companies` | Company names |
| `cryptoUsage` | Crypto algorithm usage |

<!-- CONFIGURATION -->
## Advanced Configuration

### Deep scan parameters
- **Max depth**: 2-3 levels recommended, to avoid over-crawling
- **Concurrency**: 5-16 recommended, balancing speed and stability
- **Timeout**: 5-10 seconds recommended
- **Scan scope**: Choose same-domain, subdomains, or all domains

### Custom regular expressions
<details>
<summary>Click to view code examples</summary>

```javascript
// Example: custom API rule
const customApiRegex = /\/api\/v[0-9]+\/[a-zA-Z]+/g;

// Example: custom sensitive information
const customSensitiveRegex = /password[=:]\s*[\'"]?([^\'"\s]+)/gi;
```

</details>

### Request header configuration
- **Cookie management**: Automatically fetches the current site's cookies
- **Custom headers**: Supports any HTTP request header
- **Auth information**: Supports Bearer Token, Basic Auth and more

<!-- TROUBLESHOOTING -->
## FAQ

### No results, or very few results?
<details>
<summary>Click to view the detailed solution</summary>

**Possible causes:**
- The target is a system page (chrome://, chrome-extension://)
- The page is in a silent throttling window for 5 minutes after its first scan
- Custom rules are too strict or contain errors

**Solutions:**
- Make sure you are scanning a normal web page
- Click "Start Scan" manually to force a scan
- Check the custom regex rules in the settings

</details>

### Deep scan has no effect?
<details>
<summary>Click to view the detailed solution</summary>

**Possible causes:**
- The target site requires authentication
- Concurrency is set too high, causing requests to fail
- The network timeout is set too low

**Solutions:**
- Add the target site's cookies in the settings
- Lower the concurrency (5-10 recommended)
- Increase the network timeout (10 seconds or more recommended)

</details>

### Excel file will not open?
<details>
<summary>Click to view the detailed solution</summary>

**Solutions:**
- Make sure you are using an Excel version that supports the XML format
- If prompted about encoding, choose UTF-8
- Try exporting to JSON instead

</details>

### Browser feels sluggish?
<details>
<summary>Click to view detailed optimization tips</summary>

**Optimization tips:**
- Lower the deep scan concurrency
- Reduce the maximum scan depth
- Turn off scan options you do not need

</details>

<!-- SECURITY -->
## Security and Compliance

### Compliant use
- This tool is intended only for security testing within an authorized scope
- Suitable for SRC vulnerability hunting and self-assessment
- Please follow the security policy of the target site

### Privacy protection
- All data is stored locally and is never uploaded to a server
- Uses IndexedDB for local data persistence
- Supports clearing all scan data with one click

### Legal notice
- Users are solely responsible for how they use this tool
- Any illegal use is prohibited
- Please comply with all applicable laws and regulations

<!-- CONTRIBUTING -->
## Contributing

We welcome contributions from the community.

### Reporting issues
- Use GitHub Issues to report bugs
- Provide detailed reproduction steps
- Include relevant screenshots and logs

### Feature suggestions
- Propose new features in Issues
- Describe the specific use case
- Explain how you would like it implemented

### Code contributions
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

Spectre is built on the open-source **Phantom** project, released under the Apache-2.0 License. Full credit and thanks to the original authors and contributors:

- Original authors: D3f4ultX, findsomething, SnowEyes, 0xsdeo, zeroqing
- Original teams: Sunmu Security, Zhigong Shanfang Lab, Lingyang Web, Biaoge Daiwo
- Upstream project: [Team-intN18-SoybeanSeclab/Phantom](https://github.com/Team-intN18-SoybeanSeclab/Phantom)

## Changelog

### v1.8.1
- Scan performance: result render cap + event delegation + DocumentFragment; deduplication complexity reduced from O(n^2) to O(n); work scheduled during browser idle time, resolving stutter with large data volumes
- Deep scan: added third-party JS library blocking (toggle and custom rules configurable in settings); removed artificial delays for a noticeable overall speed-up
- Basic scan: manual scans now also fetch same-origin external JS (with a per-file timeout and an overall deadline); the content script ships with built-in fallback default regexes
- Extraction accuracy: added AK/SK patterns for multiple cloud vendors (AWS, Alibaba Cloud, Tencent Cloud, JD, Alipay, Apple); ID card, JWT, IP and phone number regexes comprehensively upgraded with version migration; false-positive filtering for credentials, endpoints and comments
- Interface: two-column high-density layout, larger window, overall visual polish; action buttons collapse automatically once a scan completes
- JS Hook: reversible toggle mechanism for injection and shutdown; added reversible anti-debugging presets (bypass infinite debugger, disable console.clear, freeze window size, freeze time, and more)
- Engineering: removed all emoji and redundant comments, normalized file naming, cleaned up dead code

<!-- LICENSE -->
## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p><strong>Spectre</strong></p>
  <p>Teaching the next generation to find what others miss</p>
</div>
