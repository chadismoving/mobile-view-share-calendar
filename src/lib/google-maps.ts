export type MapsConfig = {
  googleMapsKey: string | null;
  googleMapsMapId: string;
};
declare global {
  interface Window {
    daylightMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}
let loading: Promise<typeof google.maps> | null = null;
export function loadGoogleMaps(key: string): Promise<typeof google.maps> {
  if (
    typeof google !== "undefined" &&
    google.maps?.marker?.AdvancedMarkerElement
  )
    return Promise.resolve(google.maps);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      loading = null;
      reject(new Error("Google Maps could not load. Please try again later."));
    };
    const timeout = window.setTimeout(fail, 25000);
    window.daylightMapsReady = () => {
      window.clearTimeout(timeout);
      resolve(google.maps);
      delete window.daylightMapsReady;
    };
    window.gm_authFailure = () => {
      fail();
      window.dispatchEvent(new Event("daylight-map-error"));
    };
    const src = new URL("https://maps.googleapis.com/maps/api/js");
    src.search = new URLSearchParams({
      key,
      callback: "daylightMapsReady",
      libraries: "maps,marker,geocoding",
      loading: "async",
      v: "quarterly",
    }).toString();
    script.src = src.toString();
    script.async = true;
    script.referrerPolicy = "strict-origin";
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
