import { isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, Menu, net, protocol, type MessageBoxOptions } from "electron";
import { autoUpdater } from "electron-updater";

// The Windows app's main process (ADR-0051): one window showing the page that
// `vite build --mode desktop` put beside this file, and the update check.

/**
 * Where the page is served from. Autosave lives in `localStorage`, which is
 * scoped to the origin, so changing the scheme or the host strands the design
 * in every installed copy (ADR-0012). Never change either. The same goes for
 * package.json's `name`, which names the folder it is kept in,
 * %APPDATA%\ptsblite.
 */
const SCHEME = "app";
const HOST = "ptsblite";
const ORIGIN = `${SCHEME}://${HOST}`;

/** Matches `appId` in electron-builder.yml, so Windows groups the window with its shortcuts. */
const APP_ID = "com.kellytubesystems.ptsblite";

const PAGE_DIR = join(__dirname, "renderer");

/**
 * Cloudflare applies web-public/_headers to the website; nothing applies it
 * here. The same policy, except that the page may connect nowhere: the Windows
 * app sends nothing (ADR-0056). The update check runs in this process, outside
 * the page.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join("; ");

/** How often a copy left open looks for a newer release, after the check at launch. */
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Standard and secure so the page gets a real origin, with `localStorage` and
// module scripts, rather than being treated like a file.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

async function servePage(request: Request): Promise<Response> {
  const { host, pathname } = new URL(request.url);
  const file = join(PAGE_DIR, decodeURIComponent(pathname === "/" ? "/index.html" : pathname));
  const inside = relative(PAGE_DIR, file);
  if (host !== HOST || inside.startsWith("..") || isAbsolute(inside)) {
    return new Response(null, { status: 404 });
  }
  try {
    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}

function openWindow(): void {
  // No minimum size: the page scrolls in a small window, as it does in a
  // browser, where a minimum would push the window off a small screen.
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    // The page's own background, so the window does not flash white while it loads.
    backgroundColor: "#05070a",
    show: false
  });
  // A planner wants the whole screen. Maximizing shows the window too.
  window.once("ready-to-show", () => window.maximize());

  // The page opens no windows and never navigates away. Refused outright, so
  // there is no list of allowed destinations to get wrong later.
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });

  // The page asks to stay only once autosave has failed. A browser puts that
  // to the visitor; Electron would refuse to close without a word.
  window.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: "warning",
      title: "Close PTSBLite?",
      message: "Your latest changes have not been saved.",
      detail: "PTSBLite could not save your design. If you close it now, those changes are lost.",
      buttons: ["Close anyway", "Stay"],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    });
    if (choice === 0) event.preventDefault();
  });

  void window.loadURL(`${ORIGIN}/`);
}

/**
 * Look for a newer release on this repository's GitHub Releases, download it in
 * the background, and offer to restart into it (ADR-0051). With no network the
 * check fails quietly and the app carries on.
 */
function watchForUpdates(): void {
  // Only an installed copy has a release to update from. The smoke suite
  // turns this off, or a test run could install a real release.
  if (!app.isPackaged || process.env.PTSBLITE_NO_UPDATES) return;

  const offered = new Set<string>();
  autoUpdater.on("error", (error) => console.error("PTSBLite: update check failed", error));
  autoUpdater.on("update-downloaded", ({ version }) => {
    // A copy left open finds the same download again on its next check.
    if (offered.has(version)) return;
    offered.add(version);
    void offerRestart(version);
  });

  // Failures arrive on the error event as well; this only stops them escaping as unhandled.
  const check = () => void autoUpdater.checkForUpdates().catch(() => undefined);
  check();
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
}

async function offerRestart(version: string): Promise<void> {
  const options: MessageBoxOptions = {
    type: "info",
    title: "Update ready",
    message: `PTSBLite ${version} is ready to install.`,
    detail:
      "Restart now to update. Your design is saved and will be there when PTSBLite reopens. " +
      "If you choose Later, the update installs the next time you close PTSBLite.",
    buttons: ["Restart now", "Later"],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  };
  const [window] = BrowserWindow.getAllWindows();
  const { response } = window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options);
  // Silent, because this user has already said yes, and reopened afterwards.
  if (response === 0) autoUpdater.quitAndInstall(true, true);
}

// One copy at a time: two windows would take turns overwriting the one
// autosaved design. Starting it again brings the open one forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.setAppUserModelId(APP_ID);
  // The page has its own menus and shortcuts. Electron's default menu would
  // add a second Undo on Ctrl+Z, and reload and developer tools besides.
  Menu.setApplicationMenu(null);

  void app.whenReady().then(() => {
    protocol.handle(SCHEME, servePage);
    openWindow();
    watchForUpdates();
  });
}
