const SCRIPT_ID = "google-identity-services";

let scriptPromise;
let initializedClientId = "";
let activeCredentialHandler = null;

export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    const script = existing || document.createElement("script");
    const loaded = () => {
      if (window.google?.accounts?.id) resolve(window.google);
      else reject(new Error("Google Identity Services did not initialize"));
    };
    const failed = () => reject(new Error("Google Identity Services could not be loaded"));
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    document.getElementById(SCRIPT_ID)?.remove();
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

export async function renderGoogleIdentityButton(element, clientId, onCredential) {
  if (!element || !clientId) throw new Error("Google Client ID is unavailable");
  const google = await loadGoogleIdentity();

  activeCredentialHandler = onCredential;
  if (!initializedClientId) {
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => activeCredentialHandler?.(response),
    });
    initializedClientId = clientId;
  } else if (initializedClientId !== clientId) {
    throw new Error("Google Client ID changed during the browser session");
  }

  element.replaceChildren();
  google.accounts.id.renderButton(element, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: Math.min(Math.max(element.clientWidth || 320, 240), 400),
  });

  return () => {
    if (activeCredentialHandler === onCredential) activeCredentialHandler = null;
    element.replaceChildren();
  };
}

export function resetGoogleIdentityForTests() {
  scriptPromise = null;
  initializedClientId = "";
  activeCredentialHandler = null;
}
