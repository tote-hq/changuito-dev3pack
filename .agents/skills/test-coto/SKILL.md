---
name: test-coto
description: Records the Changuito app in headless Chrome for Testing with a video file. Use when the user asks to record a demo, capture a flow, or run Chrome for Testing headless with video.
---

# test-coto

Headless [Chrome for Testing](https://developer.chrome.com/blog/chrome-for-testing) plus a Playwright video. The browser is the CfT binary, not the system Chrome and not Playwright's bundled Chromium.

## Run

From `.agents/skills/test-coto`:

```bash
npm install
node scripts/record.mjs --url http://127.0.0.1:3000 --seconds 8 --out out
```

The last line of stdout is `video: <path>` (WebM). Default viewport is 1280×720. Cap is 180 seconds.

Override the binary with `CHROME_FOR_TESTING`. The downloaded browser is cached in `~/.cache/chrome-for-testing` (`CFT_CACHE` to move it).

## A scripted flow

`--actions file.json` is an array. Prefer `data-testid` selectors.

```json
[
  { "goto": "http://127.0.0.1:3000" },
  { "click": "[data-testid=rail-pay]" },
  { "fill": "input#email", "value": "bia@example.com" },
  { "press": "Enter" },
  { "wait": 1000 }
]
```

`goto` uses `domcontentloaded`. `click` and `fill` take a selector. `press` is a key name. `wait` is milliseconds.

Start the app yourself before recording. This skill does not boot the dev server.

## Demo video

Dev3pack wants a video under 3 minutes of the product working. Record the path, then cut. Do not commit `out/` or `node_modules/`.
