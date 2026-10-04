// Leslie to Ian's Heart: Muni widget for Scriptable (iPhone / iPad).
// Shows inbound 5 / 5R predictions at McAllister & Baker and McAllister & Divisadero.
//
// Setup: paste this into a new Scriptable script and run it once in the app.
// It asks for your 511.org API key and stores it in the device Keychain
// (never in this file). Then add a Scriptable widget and pick this script.
//
// Note: iOS decides when widgets refresh (roughly every 5-15 min), so the
// minutes are "as of" the time shown at the bottom, not a live countdown.

const TITLE = "Leslie to Ian’s Heart";
const CLOCK_URL = "https://thevoterthink.github.io/subway-clock/sf/";
const KEYCHAIN_KEY = "ians-heart-511-key";
const STOPS = [
  { label: "Baker",      short: "Baker", code: "15385", lines: ["5"] },
  { label: "Divisadero", short: "Divis", code: "15390", lines: ["5", "5R"] },
];
const COLORS = { "5": "#005B95", "5R": "#BF2B45" };
const REFRESH_MINUTES = 5;  // a request (not a promise): iOS may refresh less often

// ---------- data ----------

async function askForKey() {
  const a = new Alert();
  a.title = "511.org API key";
  a.message = "Saved in this device's Keychain only.";
  a.addTextField("API key", Keychain.contains(KEYCHAIN_KEY) ? Keychain.get(KEYCHAIN_KEY) : "");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if (await a.presentAlert() === -1) return null;
  const key = a.textFieldValue(0).trim();
  if (key) Keychain.set(KEYCHAIN_KEY, key);
  return key || null;
}

async function fetchStop(stop, key) {
  const url = "https://api.511.org/transit/StopMonitoring?agency=SF&format=json"
    + "&stopcode=" + stop.code + "&api_key=" + encodeURIComponent(key);
  const req = new Request(url);
  req.timeoutInterval = 20;
  const body = await req.loadString();
  const status = req.response && req.response.statusCode;
  if (status !== 200) throw new Error("511 returned HTTP " + status);
  const json = JSON.parse(body.replace(/^﻿/, ""));  // 511 starts its JSON with a BOM
  let d = (json.ServiceDelivery || {}).StopMonitoringDelivery || {};
  if (Array.isArray(d)) d = d[0] || {};
  const now = Date.now();
  const buses = [];
  for (const v of d.MonitoredStopVisit || []) {
    const j = v.MonitoredVehicleJourney || {};
    if (!stop.lines.includes(j.LineRef)) continue;
    const c = j.MonitoredCall || {};
    const when = c.ExpectedArrivalTime || c.ExpectedDepartureTime || c.AimedArrivalTime || c.AimedDepartureTime;
    if (!when) continue;
    const t = Date.parse(when);
    if (t < now - 30 * 1000) continue;
    buses.push({ route: j.LineRef, time: t,
                 scheduled: !(c.ExpectedArrivalTime || c.ExpectedDepartureTime) });
  }
  return buses.sort((a, b) => a.time - b.time);
}

// Last good result is cached so a failed refresh still shows something.
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.cacheDirectory(), "ians-heart-cache.json");

async function loadData(key) {
  try {
    const stops = [];
    for (const s of STOPS) stops.push(await fetchStop(s, key));
    const data = { fetchedAt: Date.now(), stops };
    fm.writeString(cachePath, JSON.stringify(data));
    return { ...data, error: null };
  } catch (e) {
    if (fm.fileExists(cachePath)) {
      const cached = JSON.parse(fm.readString(cachePath));
      return { ...cached, error: String(e.message || e) };
    }
    return { fetchedAt: null, stops: STOPS.map(() => []), error: String(e.message || e) };
  }
}

const minsUntil = t => Math.max(0, Math.floor((t - Date.now()) / 60000));
function timeStr(ms) {
  const df = new DateFormatter();
  df.useNoDateStyle();
  df.useShortTimeStyle();
  return df.string(new Date(ms));
}

// ---------- drawing ----------

function addBullet(stack, route, size) {
  const b = stack.addStack();
  b.size = new Size(size, size);
  b.cornerRadius = size / 2;
  b.backgroundColor = new Color(COLORS[route] || "#808183");
  b.centerAlignContent();
  const t = b.addText(route);
  t.font = Font.boldSystemFont(route.length > 1 ? size * 0.42 : size * 0.6);
  t.textColor = Color.white();
}

function text(stack, str, font, color) {
  const t = stack.addText(str);
  t.font = font;
  t.textColor = color || Color.white();
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

const GRAY = new Color("#9b9b9b");

function homeWidget(data, family) {
  const big = family === "large" || family === "extraLarge";
  const small = family === "small";
  const perStop = small ? 2 : big ? 4 : 3;
  const w = new ListWidget();
  w.backgroundColor = Color.black();
  w.setPadding(small ? 12 : 14, 14, small ? 10 : 12, 14);

  const head = w.addStack();
  head.centerAlignContent();
  text(head, small ? "Ian’s Heart" : TITLE, Font.boldSystemFont(small ? 12 : 14));
  w.addSpacer(small ? 6 : 8);

  STOPS.forEach((stop, i) => {
    text(w.addStack(), stop.label.toUpperCase() + " · DOWNTOWN",
         Font.semiboldSystemFont(small ? 8 : 9), GRAY);
    w.addSpacer(3);
    const buses = data.stops[i].filter(b => b.time >= Date.now() - 30000).slice(0, perStop);
    if (!buses.length) {
      text(w.addStack(), "No buses", Font.systemFont(small ? 11 : 13), GRAY);
    }
    if (big) {
      // One line per bus, like the station clock.
      for (const b of buses) {
        const row = w.addStack();
        row.centerAlignContent();
        addBullet(row, b.route, 22);
        row.addSpacer(8);
        text(row, "Transit Center", Font.boldSystemFont(16));
        row.addSpacer();
        text(row, minsUntil(b.time) + " min" + (b.scheduled ? "*" : ""), Font.boldSystemFont(16));
        w.addSpacer(5);
      }
    } else {
      // Compact: bullets and minutes side by side.
      const row = w.addStack();
      row.centerAlignContent();
      buses.forEach((b, j) => {
        if (j) row.addSpacer(small ? 6 : 12);
        addBullet(row, b.route, small ? 16 : 20);
        row.addSpacer(4);
        text(row, String(minsUntil(b.time)), Font.boldSystemFont(small ? 15 : 18));
        text(row, b.scheduled ? "m*" : "m", Font.semiboldSystemFont(small ? 10 : 11), GRAY);
      });
    }
    if (i < STOPS.length - 1) w.addSpacer(small ? 6 : 8);
  });

  w.addSpacer();
  const foot = w.addStack();
  const note = data.error && !data.fetchedAt ? "511 error"
    : (data.error ? "offline · " : "as of ") + (data.fetchedAt ? timeStr(data.fetchedAt) : "");
  text(foot, note, Font.systemFont(8), new Color("#6e6e6e"));
  return w;
}

// Lock Screen widgets are tinted by iOS, so these are text-only.
function lockWidget(data, family) {
  const w = new ListWidget();
  const next = i => data.stops[i].filter(b => b.time >= Date.now() - 30000);
  if (family === "accessoryInline") {
    const b = next(1)[0] || next(0)[0];
    text(w.addStack(), b ? `${b.route} in ${minsUntil(b.time)} min` : "No buses", Font.systemFont(12));
    return w;
  }
  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const b = next(1)[0] || next(0)[0];
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    const r = text(s, b ? b.route : "–", Font.boldSystemFont(12)); r.centerAlignText();
    const m = text(s, b ? minsUntil(b.time) + "m" : "", Font.boldSystemFont(16)); m.centerAlignText();
    return w;
  }
  // accessoryRectangular: one line per stop
  STOPS.forEach((stop, i) => {
    const list = next(i).slice(0, 3).map(b => (stop.lines.length > 1 ? b.route + " " : "") + minsUntil(b.time));
    text(w.addStack(), `${stop.short}  ${list.length ? list.join(", ") + " min" : "–"}`,
         Font.semiboldSystemFont(13));
  });
  text(w.addStack(), data.fetchedAt ? "as of " + timeStr(data.fetchedAt) : "", Font.systemFont(10));
  return w;
}

function build(data, family) {
  const w = family.startsWith("accessory") ? lockWidget(data, family) : homeWidget(data, family);
  w.url = CLOCK_URL;  // tap to open the full clock
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);
  return w;
}

function messageWidget(msg) {
  const w = new ListWidget();
  w.backgroundColor = Color.black();
  text(w.addStack(), TITLE, Font.boldSystemFont(13));
  w.addSpacer(6);
  const t = w.addText(msg);
  t.font = Font.systemFont(11);
  t.textColor = GRAY;
  return w;
}

// ---------- main ----------

let key = Keychain.contains(KEYCHAIN_KEY) ? Keychain.get(KEYCHAIN_KEY) : null;

if (config.runsInWidget) {
  const family = config.widgetFamily || "medium";
  Script.setWidget(key ? build(await loadData(key), family)
                       : messageWidget("Open Scriptable and run this script once to enter your 511 key."));
} else {
  if (!key) key = await askForKey();
  if (key) {
    const menu = new Alert();
    menu.title = TITLE;
    menu.message = "Preview a widget size";
    ["Small", "Medium", "Large"].forEach(s => menu.addAction(s));
    menu.addAction("Change API key");
    menu.addCancelAction("Done");
    const choice = await menu.presentSheet();
    if (choice === 3) {
      await askForKey();
    } else if (choice >= 0) {
      const data = await loadData(Keychain.get(KEYCHAIN_KEY));
      const w = build(data, ["small", "medium", "large"][choice]);
      await [() => w.presentSmall(), () => w.presentMedium(), () => w.presentLarge()][choice]();
    }
  }
}
Script.complete();
