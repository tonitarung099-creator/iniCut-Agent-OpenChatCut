import type { BrowserWindow } from 'electron';
import { externalMcpToken } from '../server/editor-auth.ts';
import { runDesktopMcpRecoverySmoke } from './smoke-mcp-recovery.ts';
import { runDesktopRendererRecoverySmoke } from './smoke-renderer-recovery.ts';

const RENDER_DRAIN_MS = 500;
// Under the app's 240s watchdog, over any plausible healthy render (previous
// green runs finished the whole smoke in ~3 minutes).
const RENDER_DEADLINE_MS = 180_000;

async function visibleCjkLeaks(win: BrowserWindow): Promise<string[]> {
  return await win.webContents.executeJavaScript(`(() => {
    const cjk = /[\\u3400-\\u9FFF\\uF900-\\uFAFF]/;
    const leaks = new Set();
    const visible = (el) => {
      if (!(el instanceof HTMLElement)) return true;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const value = String(node.nodeValue || '').replace(/\\s+/g, ' ').trim();
      if (!value || !cjk.test(value)) continue;
      const parent = node.parentElement;
      if (parent && !visible(parent)) continue;
      leaks.add(value.slice(0, 180));
    }
    for (const el of document.querySelectorAll('[title],[placeholder],[aria-label]')) {
      if (!visible(el)) continue;
      for (const attr of ['title', 'placeholder', 'aria-label']) {
        const value = el.getAttribute(attr);
        if (value && cjk.test(value)) leaks.add(value.slice(0, 180));
      }
    }
    return [...leaks].slice(0, 30);
  })()`) as string[];
}

async function assertNoVisibleCjk(win: BrowserWindow, surface: string): Promise<void> {
  const leaks = await visibleCjkLeaks(win);
  if (leaks.length) {
    throw new Error(`Visible Chinese text leaked on ${surface}: ${leaks.join(' | ')}`);
  }
  console.log(`[smoke] Indonesian UI has no visible CJK on ${surface}`);
}

async function waitForUiReady(win: BrowserWindow): Promise<void> {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const state = await win.webContents.executeJavaScript(`(() => {
      const buttons = [...document.querySelectorAll('button')];
      const hasSettings = buttons.some((button) => {
        const label = button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '';
        return /Pengaturan/i.test(label);
      });
      const text = String(document.body?.innerText || '').replace(/\\s+/g, ' ').trim();
      return { ready: document.readyState, hasSettings, textLength: text.length };
    })()`) as { ready?: string; hasSettings?: boolean; textLength?: number };
    if (state.ready === 'complete' && state.hasSettings && (state.textLength ?? 0) > 20) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('MiniCut UI did not become ready with an Indonesian Settings control');
}

async function openSettingsForLocaleAudit(win: BrowserWindow): Promise<void> {
  const clicked = await win.webContents.executeJavaScript(`(() => {
    const buttons = [...document.querySelectorAll('button')];
    const target = buttons.find((button) => {
      const label = button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '';
      return /Pengaturan/i.test(label);
    });
    if (!target) return false;
    target.click();
    return true;
  })()`) as boolean;
  if (!clicked) throw new Error('MiniCut Settings button could not be opened for locale audit');

  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const opened = await win.webContents.executeJavaScript(`(() => {
      const text = String(document.body?.innerText || '').replace(/\\s+/g, ' ');
      return /Google\\s*[·•-]?\\s*Gemini/i.test(text) && /API Key Gemini/i.test(text);
    })()`) as boolean;
    if (opened) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('MiniCut Gemini Settings did not finish opening for locale audit');
}

export async function runDesktopSmokeProbe(
  origin: string,
  win: BrowserWindow,
  render: boolean,
): Promise<void> {
  const res = await fetch(`${origin}/api/keys`);
  if (!res.ok) throw new Error(`/api/keys → HTTP ${res.status}`);
  const mcp = await fetch(`${origin}/api/external-mcp/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${externalMcpToken()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'desktop-smoke', version: '1' },
      },
    }),
  });
  if (!mcp.ok || !(await mcp.text()).includes('"name":"openchatcut"')) {
    throw new Error(`/api/external-mcp/mcp → HTTP ${mcp.status}`);
  }
  console.log('[smoke] external MCP endpoint ok');
  if (process.env.CC_SMOKE_MCP_RECOVERY === '1') {
    await runDesktopMcpRecoverySmoke(origin, externalMcpToken());
  }
  const pickerType = await win.webContents.executeJavaScript(
    'typeof window.openChatCutDesktop?.selectDirectory',
  ) as unknown;
  if (pickerType !== 'function') throw new Error('desktop directory picker preload is unavailable');
  console.log('[smoke] desktop directory picker preload ok');
  const updaterType = await win.webContents.executeJavaScript(
    'typeof window.openChatCutDesktop?.updates?.check',
  ) as unknown;
  if (updaterType !== 'function') throw new Error('desktop updater preload is unavailable');
  console.log('[smoke] desktop updater preload ok');
  // Editor bridge heartbeat (issue #86): the long poll is timer-driven, so
  // background throttling must be off or minimizing the window drops the
  // MCP bridge offline. Assert the RUNTIME value, not just the source flag.
  const throttlingDisabled = win.webContents.getBackgroundThrottling();
  if (throttlingDisabled !== false) {
    throw new Error(`background throttling is enabled (${String(throttlingDisabled)}); the MCP bridge heartbeat will stall in background windows`);
  }
  console.log('[smoke] background throttling disabled (bridge heartbeat safe)');
  const inference = await win.webContents.executeJavaScript(
    'window.openChatCutDesktop?.inference?.getCapabilities()',
  ) as {
    version?: unknown;
    asr?: { available?: unknown };
    semantic?: { available?: unknown };
    clap?: { available?: unknown };
    rhythm?: { available?: unknown };
    hardware?: {
      cpu?: { logicalCores?: unknown; totalMemoryBytes?: unknown };
      gpus?: unknown;
      hardwareAcceleration?: unknown;
    };
  } | null;
  if (inference?.version !== 3
    || typeof inference.asr?.available !== 'boolean'
    || typeof inference.semantic?.available !== 'boolean'
    || typeof inference.clap?.available !== 'boolean'
    || typeof inference.rhythm?.available !== 'boolean'
    || !Array.isArray(inference.hardware?.gpus)
    || typeof inference.hardware?.cpu?.logicalCores !== 'number'
    || typeof inference.hardware?.cpu?.totalMemoryBytes !== 'number'
    || typeof inference.hardware?.hardwareAcceleration !== 'boolean') {
    throw new Error('desktop native inference preload is unavailable');
  }
  console.log('[smoke] desktop native inference preload ok');

  // Release gate: MiniCut is Indonesian-only. Wait for the real React UI,
  // then fail the packaged executable if Chinese survives either the main
  // surface or the actual Gemini Settings dialog.
  await waitForUiReady(win);
  await assertNoVisibleCjk(win, 'dashboard/editor');
  await openSettingsForLocaleAudit(win);
  await assertNoVisibleCjk(win, 'Gemini settings');
  const windowTitle = win.getTitle();
  if (!/MiniCut/i.test(windowTitle)) {
    throw new Error(`Packaged window title is not MiniCut: ${windowTitle}`);
  }
  console.log('[smoke] MiniCut branding and Indonesian Gemini settings verified');

  if (render) {
    // The render runs BEFORE the renderer-recovery phase: on the v0.2.12
    // windows-latest run the app wedged after the deliberate renderer crashes
    // so hard that neither the 240s watchdog's process.exit nor app.exit ran —
    // no log line, killed externally at 420s. Destructive probes go last so
    // the release-gating render is not downstream of them, and the fetch
    // carries its own deadline so a slow or stuck render names itself instead
    // of relying on the watchdog.
    console.log('[smoke] render-still starting');
    const state = { fps: 30, width: 640, height: 360, items: [], selectedId: null };
    const response = await fetch(`${origin}/render-still`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'Sec-Fetch-Site': 'same-origin',
      },
      body: JSON.stringify({ state, frames: [0] }),
      signal: AbortSignal.timeout(RENDER_DEADLINE_MS),
    });
    if (!response.ok) {
      throw new Error(`/render-still → HTTP ${response.status}: ${await response.text()}`);
    }
    const rendered = (await response.json()) as { frames?: Array<{ base64?: string }> };
    if (!rendered.frames?.[0]?.base64) throw new Error('/render-still returned no frame');
    console.log(`[smoke] render-still ok, base64 ${rendered.frames[0].base64.length}B`);
    // Remotion can emit late DevTools protocol callbacks after the response.
    await new Promise((resolve) => setTimeout(resolve, RENDER_DRAIN_MS));
  }
  if (process.env.CC_SMOKE_RENDERER_RECOVERY === '1') {
    await runDesktopRendererRecoverySmoke(win);
  }
}
