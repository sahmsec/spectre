# Update notification for Spectre

**Date:** 2026-07-30
**Status:** design, awaiting review

## Problem

Spectre is installed by `git clone` plus Chrome's *Load unpacked*. Chrome never
auto-updates an unpacked extension, so a student who installed once stays on that
build forever. When we ship a fix, nobody finds out.

An update check already exists in `src/main.js` and runs on every popup open, but it
is inherited from the codebase this was forked from and is broken in two ways:

1. It fetches `https://www.cn-fnst.top/huanying/` — a third-party domain we do not
   control. It will never report a Spectre release.
2. It pipes that response into `innerHTML` with no sanitization. Whoever controls
   that domain can execute arbitrary JavaScript inside the popup, which holds
   `<all_urls>`, `cookies`, `scripting`, and `storage` permissions.

The second point is a live vulnerability in a tool handed to students. It must be
removed regardless of what replaces it.

## Constraints

- **No Chrome Web Store.** Publishing is not available to us, so silent auto-update
  is off the table. The final step will always be manual.
- **Unpacked install.** The extension cannot write to its own directory and cannot
  install a `.crx` from a link. A "Download" button is actively harmful — it produces
  a second copy on disk and two conflicting installs.
- **Fixed dark theme.** The palette is hardcoded; there is no
  `prefers-color-scheme` query anywhere in the codebase, and the UI renders
  identically regardless of the OS setting. New UI is styled to the dark palette only.
- **No new permissions.** `<all_urls>` in `host_permissions` already covers the fetch.

## Prerequisite: fix the default branch

`origin/HEAD` points at `master`, but all current work is on `main`:

```
main / origin/main   a95eb26
origin/master        657b5df
divergence (master...main):  1 | 18
```

`main` is 18 commits ahead. Because `master` is the default branch, `git clone`
gives students the stale tree, so today even a diligent `git pull` would not get
them current.

**Required action:** set `main` as the default branch in GitHub → Settings →
Branches, then reconcile or delete `master`. This design assumes `main` is the
branch users clone and therefore the branch `version.json` is read from. If we ship
from `master` instead, only the raw URL changes.

## Non-goals

- Self-updating the extension. A CLI like nuclei can overwrite its own binary; an
  extension cannot. There is no equivalent of `nuclei -up`.
- Auto-running `git pull` for the user.
- Any telemetry, analytics, or phone-home beyond fetching a static file.
- Migrating to a store listing.

## Design

The pattern is the one ProjectDiscovery tools use — build-time version constant,
compare against a remote value on startup, cache the result, show a banner — minus
the self-update step the browser denies us.

### 1. Signal: `version.json` at the repo root

```json
{
  "version": "1.9.0",
  "notes": [
    "Faster deep scan on large bundles",
    "New multi-cloud AK/SK patterns",
    "Fixed false positives in JWT detection"
  ]
}
```

Fetched from:

```
https://raw.githubusercontent.com/sahmsec/spectre/main/version.json
```

Chosen over the GitHub Releases API because it requires no tags and no published
releases — the version bump rides along in the same commit as the change. The repo
currently has zero tags, so a release-based check would add a step we would
eventually skip, leaving the feature silently dead again. `raw.githubusercontent.com`
also has no practical rate limit, whereas `api.github.com` allows 60 requests/hour
per IP unauthenticated, which a classroom behind one campus NAT can exhaust.

The response deliberately carries no URL. The repo link is hardcoded in the
extension so a compromised or malformed response cannot redirect users.

`raw.githubusercontent.com` serves a short CDN cache (~5 minutes). That is well
inside our 24-hour check interval, but the fetch uses `cache: 'no-store'` to avoid
the browser holding a stale copy longer.

### 2. Check module

Replaces `CURRENT_VERSION`, `showUpdateModal`, and `checkForUpdate` in
`src/main.js` (lines 1356–1411). The existing `compareVersion` helper is correct and
is kept as-is.

```
REMOTE_URL       https://raw.githubusercontent.com/sahmsec/spectre/main/version.json
CACHE_KEY        spectreUpdateCache          (chrome.storage.local)
MODAL_SEEN_KEY   spectreUpdateModalSeen      (chrome.storage.local)
INTERVAL         24 hours
VERSION_RE       /^\d+(\.\d+){0,3}$/
```

Logic:

1. Read the local version from `chrome.runtime.getManifest().version`.
2. Read the cache. If `Date.now() - cache.checkedAt < INTERVAL`, use the cached
   `remoteVersion` and `notes` and skip the network entirely.
3. Otherwise fetch. On success, validate and store
   `{ remoteVersion, notes, checkedAt }`. On any failure — offline, 404, non-JSON,
   version failing `VERSION_RE` — return without changing the cache and without
   surfacing anything. The check is invisible when it cannot run.
4. Return an update state only when `compareVersion(local, remoteVersion) < 0`.

**The cache stores the remote version number, not an "outdated" verdict.** This is
what makes the indicator self-clearing: after a student pulls and reloads, the
manifest reads `1.9.0`, the cached remote reads `1.9.0`, they compare equal, and the
indicator disappears on the next popup open. No dismissal state to track, and a
stale cache cannot leave a badge showing after the update landed.

Validation of `notes`: must be an array of strings; capped at 10 entries and 200
characters each; anything else is dropped and the modal renders without notes.

The check stays in the popup rather than the background service worker. MV3 workers
sleep, so a periodic check would need the `alarms` permission, which we do not
currently request. Popup-open with a 24-hour throttle costs at most one request per
day per user and needs no manifest change.

### 3. UI: two layers

Neither element renders unless an update is actually available. With no update
pending, the header is byte-for-byte what it is today.

**Header pill.** A small element in `.brand-text`, below the wordmark, reading
`1.9.0 available`. Hidden by default (`display: none`), shown only on a positive
update state. It persists for as long as the update is outstanding — dismissing the
modal silences the interruption, the pill remains as the quiet reminder. Clicking it
reopens the modal. Styled to the existing violet accent: background
`rgba(109,76,184,.18)`, border `1px solid rgba(109,76,184,.45)`, text `#c9b8f0`,
11px, pill radius.

**Modal.** Opens automatically **once per new version**, then only on pill click.
Gated by `spectreUpdateModalSeen`: if it does not equal the remote version, show and
then set it. This is a deliberate change from the current behaviour, which re-nags
every 24 hours for the same version.

Contents:

- Heading: `Update available — 1.8.1 → 1.9.0`
- The notes list, if present and valid.
- The two literal steps, which are the point of the whole feature:
  1. `git pull` in the Spectre folder — with a copy-to-clipboard button.
  2. Open `chrome://extensions` and click **reload** on the Spectre card.
- A single **Close** button.

`chrome://extensions` is rendered as copyable text, not a link. Extension pages
cannot reliably navigate to `chrome://` URLs, so an anchor would look clickable and
do nothing.

There is no download button, by design. Downloading a zip is what produces the
duplicate-install failure mode.

### 4. Security requirements

These are requirements, not suggestions — the bug being replaced was exactly this
class of mistake.

- The `cn-fnst.top` fetch is deleted.
- The modal is built with `document.createElement` and `textContent`. No `innerHTML`
  anywhere in the update path.
- The remote version is validated against `VERSION_RE` before being displayed or
  compared.
- The repo URL is a hardcoded constant, never read from the response.
- The mangled upstream string `"Xuan8a1 notice"` is removed.

### 5. Single source of truth for the version

The version currently appears in four places, all reading `1.8.1`, with the update
check reading the hardcoded constant rather than the manifest. The day these drift,
the feature breaks silently.

| Location | Change |
|---|---|
| `manifest.json:4` | Stays. Becomes the only authoritative value. |
| `src/main.js:1356` | Constant deleted; use `chrome.runtime.getManifest().version`. |
| `popup.html:2013` | Hardcoded `1.8.1` replaced with a span populated at runtime from the manifest. |
| `README.md` badge + changelog | Updated by hand at release time; documented in the workflow below. |

## Release workflow

What shipping an update looks like after this lands:

1. Make the change.
2. Bump `version` in `manifest.json`.
3. Bump `version` in `version.json` to match and write 1–3 note lines.
4. Update the README badge and changelog.
5. Commit and push to `main`.

Within 24 hours every user sees the pill on their next popup open, and the modal
once. Steps 2 and 3 must agree; if `version.json` is ahead of a user's manifest the
notification fires, which is the intended trigger.

## Testing

Manual, in Chrome with the extension loaded unpacked:

| Case | Expected |
|---|---|
| `version.json` equals manifest | No pill, no modal. Header unchanged. |
| `version.json` ahead | Pill visible; modal opens once. |
| Reopen popup after dismissing | Pill still visible; modal does not reopen. |
| Bump manifest to match, reload | Pill gone on next open. |
| Offline, no prior cache | No pill, no modal, no console errors. |
| Offline, cache says update pending | Pill still visible from cached values; no console errors. |
| Malformed JSON, or `version: "<img src=x onerror=alert(1)>"` | Rejected by `VERSION_RE`; nothing rendered; no script execution. |
| `notes` containing HTML | Rendered as literal text via `textContent`. |
| Second open within 24h | No network request; cached values used. |
| OS light theme | UI identical to dark; no palette shift. |

## Files touched

- `version.json` — new.
- `src/main.js` — replace lines 1356–1411; update the call site at line 1460.
- `popup.html` — pill markup in `.brand-text`, pill and modal CSS, runtime-populated
  version span on the About page.
- `README.md` — document the release workflow; note that updating means
  `git pull` plus a reload.

## Open question

Confirm the default branch decision in the prerequisite section above. Everything
else is settled.
