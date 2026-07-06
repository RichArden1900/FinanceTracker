// This file exists because the app was originally built as a Claude
// artifact, which provides a `window.storage` key-value API backed by
// Anthropic's servers. That API does not exist in a plain browser, so this
// module replicates just enough of its shape (get/set/delete/list, and the
// "throws on missing key" behavior of get) using the browser's own
// localStorage — so App.jsx did not need to be rewritten.
//
// Real limitation to know about: this is genuinely local to one browser on
// one device. There is no account, no sync, and no server. Clearing site
// data / browser storage, or opening the app in a different browser or
// device, means starting over with no data. If you need the data to follow
// you across devices, this is the file to replace with a real backend
// (or something like Supabase / Firebase) — not App.jsx.
//
// The `shared` flag from the original API (which distinguished per-user vs
// shared-across-users data inside the Claude sandbox) has no meaning here:
// there is no multi-user concept in a static site with no backend, so both
// branches just read/write the same localStorage bucket.

const NAMESPACE = "finance-tracker:v1";

function readStore() {
  try {
    const raw = window.localStorage.getItem(NAMESPACE);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    // localStorage can throw in private/incognito modes with storage
    // disabled, or if the stored JSON is somehow corrupted. Fail soft.
    console.warn("finance-tracker: localStorage unavailable, using memory only.", err);
    return {};
  }
}

function writeStore(data) {
  try {
    window.localStorage.setItem(NAMESPACE, JSON.stringify(data));
  } catch (err) {
    console.warn("finance-tracker: failed to persist to localStorage.", err);
  }
}

window.storage = {
  async get(key, _shared) {
    const data = readStore();
    if (!(key in data)) throw new Error(`No stored value for key "${key}"`);
    return { key, value: data[key], shared: false };
  },
  async set(key, value, _shared) {
    const data = readStore();
    data[key] = value;
    writeStore(data);
    return { key, value, shared: false };
  },
  async delete(key, _shared) {
    const data = readStore();
    const existed = key in data;
    delete data[key];
    writeStore(data);
    return { key, deleted: existed, shared: false };
  },
  async list(prefix = "", _shared) {
    const data = readStore();
    const keys = Object.keys(data).filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};
