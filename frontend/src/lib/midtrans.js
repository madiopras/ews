// Loads Midtrans Snap.js using the key/host reported by the backend.
let loading = null;

export function loadSnap(snapJsUrl, clientKey) {
  if (window.snap) return Promise.resolve(window.snap);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = snapJsUrl;
    s.setAttribute("data-client-key", clientKey);
    s.onload = () => resolve(window.snap);
    s.onerror = () => reject(new Error("Failed to load Midtrans Snap"));
    document.body.appendChild(s);
  });
  return loading;
}
