import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  LoaderCircle,
  Map,
  MapPin,
  RefreshCw,
} from "lucide-react";
import {
  calendarPlaces,
  googleMapsLink,
  type CalendarPlace,
} from "../../shared/locations";
import { formatDate, type CalendarContent } from "../../shared/calendar";
import { api } from "../lib/api";
import { loadGoogleMaps, type MapsConfig } from "../lib/google-maps";
const pinColors = {
  sage: "#d6e2c9",
  lavender: "#ded6ed",
  peach: "#f0d5bc",
  sky: "#d0e2ec",
  rose: "#edcfd9",
  sand: "#e8dfb3",
};
export function CalendarMap({
  content,
  readOnly,
}: {
  content: CalendarContent;
  readOnly: boolean;
}) {
  const placesJson = JSON.stringify(calendarPlaces(content));
  const places = useMemo(
    () => JSON.parse(placesJson) as CalendarPlace[],
    [placesJson],
  );
  const [config, setConfig] = useState<MapsConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef(
    new globalThis.Map<string, google.maps.marker.AdvancedMarkerElement>(),
  );
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const geocodeCache = useRef(new globalThis.Map<string, google.maps.LatLng>());
  useEffect(() => {
    let active = true;
    void api<MapsConfig>("/api/config")
      .then((value) => {
        if (active) {
          setConfig(value);
          setConfigError(false);
        }
      })
      .catch(() => {
        if (active) setConfigError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!requested || !config?.googleMapsKey || !places.length) return;
    let cancelled = false;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    const markerIndex = markerRefs.current;
    const showError = () => {
      setStatus("");
      setError(
        "The map is unavailable right now. You can still open each location in Google Maps below.",
      );
    };
    window.addEventListener("daylight-map-error", showError);
    async function renderMap() {
      setError("");
      setStatus("Finding your places…");
      setUnresolved([]);
      const sdk = await loadGoogleMaps(config!.googleMapsKey!);
      if (cancelled || !host.current) return;
      const map = new sdk.Map(host.current, {
        center: { lat: 1.3521, lng: 103.8198 },
        zoom: 11,
        mapId: config!.googleMapsMapId,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "cooperative",
      });
      mapRef.current = map;
      const info = new sdk.InfoWindow();
      infoRef.current = info;
      const geocoder = new sdk.Geocoder();
      const bounds = new sdk.LatLngBounds();
      const missing: string[] = [];
      let resolved = 0;
      // Geocode unique addresses only, in small batches. Results stay in this view,
      // never in D1 or localStorage; only the user's own location text is persisted.
      for (let start = 0; start < places.length; start += 3) {
        if (cancelled) break;
        await Promise.all(
          places.slice(start, start + 3).map(async (place) => {
            try {
              let position = geocodeCache.current.get(place.key);
              if (!position) {
                const response = await geocoder.geocode({
                  address: place.address,
                });
                position = response.results[0]?.geometry.location;
                if (position && !cancelled)
                  geocodeCache.current.set(place.key, position);
              }
              if (cancelled) return;
              if (!position) {
                missing.push(place.address);
                return;
              }
              const pin = new sdk.marker.PinElement({
                background: pinColors[place.color],
                borderColor: "#58694f",
                glyphColor: "#405640",
                glyphText: String(place.number),
              });
              const marker = new sdk.marker.AdvancedMarkerElement({
                map,
                position,
                title: place.address,
                gmpClickable: true,
              });
              marker.appendChild(pin);
              marker.addEventListener("gmp-click", () => {
                const panel = document.createElement("div");
                panel.className = "map-info";
                const title = document.createElement("strong");
                title.textContent = place.address;
                panel.appendChild(title);
                for (const stop of place.stops) {
                  const line = document.createElement("p");
                  line.textContent = `${stop.title} · ${formatDate(stop.date, { month: "short", day: "numeric" })}`;
                  panel.appendChild(line);
                }
                const link = document.createElement("a");
                link.href = googleMapsLink(place.address);
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = "Open in Google Maps";
                panel.appendChild(link);
                info.setContent(panel);
                info.open({ map, anchor: marker });
              });
              markers.push(marker);
              markerIndex.set(place.key, marker);
              bounds.extend(position);
              resolved++;
            } catch {
              if (!cancelled) missing.push(place.address);
            }
          }),
        );
        if (cancelled) break;
        if (resolved) {
          map.fitBounds(bounds, 36);
          if (resolved === 1) map.setZoom(14);
        }
        setStatus(`Pinned ${resolved} of ${places.length} locations`);
        setUnresolved([...missing]);
      }
      if (!cancelled && !resolved)
        setError(
          "We couldn’t pin these places. Add a complete address to each slot and try again.",
        );
    }
    void renderMap().catch(() => {
      if (!cancelled) showError();
    });
    return () => {
      cancelled = true;
      markers.forEach((marker) => {
        marker.map = null;
      });
      markerIndex.clear();
      infoRef.current?.close();
      mapRef.current = null;
      window.removeEventListener("daylight-map-error", showError);
    };
  }, [requested, config, places, attempt]);
  const focusPlace = (key: string) => {
    const marker = markerRefs.current.get(key);
    if (!marker?.position || !mapRef.current) return;
    mapRef.current.panTo(marker.position);
    mapRef.current.setZoom(16);
    marker.dispatchEvent(new Event("gmp-click"));
    host.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <section className="places-panel" aria-labelledby="places-heading">
      <header className="places-header">
        <div>
          <h2 id="places-heading">
            <Map size={18} /> Map & places
          </h2>
          <p>
            {places.length
              ? "Every stop, in one place."
              : "Add a location to a time slot to see it here."}
          </p>
        </div>
      </header>
      <div className="map-stage">
        <div
          ref={host}
          className={`google-map-canvas ${requested && config?.googleMapsKey ? "map-visible" : ""}`}
          aria-label="Google Map of calendar locations"
        />
        {(!requested || !config?.googleMapsKey) && (
          <div className="map-placeholder">
            <div className="map-placeholder-art" aria-hidden="true">
              <span className="map-road road-one" />
              <span className="map-road road-two" />
              <span className="map-road road-three" />
              <MapPin size={34} />
            </div>
            {places.length === 0 ? (
              <p>Your calendar’s locations will appear here.</p>
            ) : !config && !configError ? (
              <p role="status">
                <LoaderCircle size={16} className="spin" /> Preparing map…
              </p>
            ) : config?.googleMapsKey ? (
              <>
                <p>
                  See all {places.length}{" "}
                  {places.length === 1 ? "location" : "locations"} on Google
                  Maps.
                </p>
                <button
                  className="button primary small"
                  onClick={() => setRequested(true)}
                >
                  <Map size={15} /> Load Google Map
                </button>
                <span className="map-privacy">
                  Locations are sent to Google when the map loads.
                </span>
              </>
            ) : (
              <>
                <p>
                  {readOnly
                    ? "The map isn’t available yet. Explore the locations below."
                    : "Google Maps is not connected yet. Your locations are saved below."}
                </p>
                {configError && (
                  <button
                    className="button secondary small"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Try again
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {requested && config?.googleMapsKey && (
        <div className="map-status" role="status">
          {status}
          {error && <p className="map-error">{error}</p>}
          {(error || unresolved.length > 0) && (
            <button
              className="text-button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RefreshCw size={13} /> Retry map
            </button>
          )}
        </div>
      )}
      {unresolved.length > 0 && (
        <p className="map-unresolved">
          {unresolved.length}{" "}
          {unresolved.length === 1 ? "location needs" : "locations need"} a
          clearer address. All locations remain listed below.
        </p>
      )}
      <ol className="places-list">
        {places.map((place) => (
          <li key={place.key}>
            <button
              className="place-focus"
              onClick={() => focusPlace(place.key)}
              disabled={!requested || !config?.googleMapsKey || Boolean(error)}
            >
              <span className={`place-number color-${place.color}`}>
                {place.number}
              </span>
              <span>
                <strong>{place.address}</strong>
                <small>
                  {place.stops.map((stop) => stop.title).join(" · ")}
                </small>
              </span>
            </button>
            <a
              href={googleMapsLink(place.address)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${place.address} in Google Maps`}
            >
              <ArrowUpRight size={16} />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
