import {
  Compass,
  GripVertical,
  LocateFixed,
  Pencil,
  Plus,
  Search,
  Settings,
  Thermometer,
  Waves,
  Wind,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import HeroWaveCanvas from "./components/HeroWaveCanvas";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./components/ui/sheet";

// ─── Types ────────────────────────────────────────────────────────────────────
type Spot = {
  name: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
};

type PresetSlots = (Spot | null)[];

interface ConditionsData {
  waveHeight: number;
  waveDirection: number;
  windSpeed: number;
  windDirection: number;
  waterTemp: number;
  airTemp: number;
  dailyWaveMax: number[];
  dailyWaveDir: number[];
  dailyDates: string[];
  dailyWindSpeed: number[];
  swellPeriod: number;
  dailySwellPeriod: number[];
  tideHeights: number[]; // 24 hourly sea-level values for today (metres, local time)
  utcOffsetSeconds: number; // location UTC offset in seconds
}

interface GeoResult {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  admin1?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function degreesToCompass(deg: number): string {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

type Status = "good" | "average" | "poor";

function waveStatus(h: number): Status {
  if (h >= 1.5) return "good";
  if (h >= 0.5) return "average";
  return "poor";
}

function windStatus(s: number): Status {
  if (s < 20) return "good";
  if (s <= 40) return "average";
  return "poor";
}

function tempStatus(t: number): Status {
  if (t >= 20) return "good";
  if (t >= 15) return "average";
  return "poor";
}

const STATUS_COLOR: Record<Status, string> = {
  good: "var(--color-good)",
  average: "var(--color-average)",
  poor: "var(--color-poor)",
};

function dayName(dateStr: string): string {
  // Parse as local noon to avoid UTC-midnight timezone rollover (e.g. Sun -> Sat for US browsers)
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

function conditionEmoji(wh: number, ws: number): string {
  if (wh >= 1.5 && ws < 25) return "😄";
  if (wh >= 0.5) return "😐";
  return "😞";
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
const PRESETS_KEY = "swell_presets";
const UNITS_KEY = "swell_units";

type HeightUnit = "ft" | "m";
type TempUnit = "F" | "C";
type SpeedUnit = "kts" | "mph" | "km/h";

interface UnitSettings {
  height: HeightUnit;
  temp: TempUnit;
  speed: SpeedUnit;
}

const DEFAULT_UNITS: UnitSettings = { height: "ft", temp: "F", speed: "kts" };

function loadUnits(): UnitSettings {
  try {
    const raw = localStorage.getItem(UNITS_KEY);
    if (!raw) return DEFAULT_UNITS;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.height === "string" &&
      typeof parsed.temp === "string" &&
      typeof parsed.speed === "string"
    ) {
      return parsed as UnitSettings;
    }
    return DEFAULT_UNITS;
  } catch {
    return DEFAULT_UNITS;
  }
}

function saveUnits(u: UnitSettings): void {
  try {
    localStorage.setItem(UNITS_KEY, JSON.stringify(u));
  } catch {
    /* ignore */
  }
}

const TILE_ORDER_KEY = "swell_tile_order";
type TileId =
  | "wave"
  | "wind"
  | "direction"
  | "waterTemp"
  | "airTemp"
  | "period"
  | "tide"
  | "forecast";
const DEFAULT_TILE_ORDER: TileId[] = [
  "wave",
  "wind",
  "direction",
  "waterTemp",
  "airTemp",
  "period",
  "tide",
  "forecast",
];

function loadTileOrder(): TileId[] {
  try {
    const raw = localStorage.getItem(TILE_ORDER_KEY);
    if (!raw) return DEFAULT_TILE_ORDER;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((id: string) =>
        [
          "wave",
          "wind",
          "direction",
          "waterTemp",
          "airTemp",
          "period",
          "tide",
          "forecast",
        ].includes(id),
      )
    ) {
      // Migrate old saves that lack tide/forecast
      const migrated = [...parsed] as TileId[];
      if (!migrated.includes("tide")) migrated.push("tide");
      if (!migrated.includes("forecast")) migrated.push("forecast");
      if (!migrated.includes("period"))
        migrated.splice(migrated.indexOf("tide"), 0, "period");
      return migrated;
    }
    return DEFAULT_TILE_ORDER;
  } catch {
    return DEFAULT_TILE_ORDER;
  }
}
function saveTileOrder(order: TileId[]): void {
  try {
    localStorage.setItem(TILE_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

// ─── Unit conversion helpers ──────────────────────────────────────────────────
function metresToFeet(m: number): number {
  return m * 3.28084;
}

function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

function kmhToKnots(k: number): number {
  return k * 0.539957;
}

function kmhToMph(k: number): number {
  return k * 0.621371;
}

function loadPresets(): PresetSlots {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return Array(5).fill(null);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return Array(5).fill(null);
    const slots: PresetSlots = Array(5).fill(null);
    for (let i = 0; i < 5; i++) {
      const s = parsed[i];
      if (
        s &&
        typeof s.name === "string" &&
        typeof s.country === "string" &&
        typeof s.lat === "number" &&
        typeof s.lng === "number" &&
        typeof s.timezone === "string"
      ) {
        slots[i] = s as Spot;
      }
    }
    return slots;
  } catch {
    return Array(5).fill(null);
  }
}

function savePresets(presets: PresetSlots): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /* ignore */
  }
}

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1000, decimals = 1): string {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) {
      setVal(0);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      setVal(eased * target);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return val.toFixed(decimals);
}

// ─── Local time hook ──────────────────────────────────────────────────────────
function useLocalTime(timezone: string): string {
  const [time, setTime] = useState(() =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date()),
  );

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timezone]);

  return time;
}

// ─── useSortable hook (pointer-event drag — works on iOS + Android) ──────────
function useSortable<T>(
  items: T[],
  onReorder: (newItems: T[]) => void,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const dragIndexRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const getHandlers = useCallback(
    (index: number) => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        dragIndexRef.current = index;
        startPosRef.current = { x: e.clientX, y: e.clientY };
        didDragRef.current = false;
        pointerIdRef.current = e.pointerId;
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (dragIndexRef.current === null) return;
        const dx = e.clientX - (startPosRef.current?.x ?? e.clientX);
        const dy = e.clientY - (startPosRef.current?.y ?? e.clientY);
        if (!didDragRef.current && Math.hypot(dx, dy) > 8) {
          didDragRef.current = true;
          setActiveIndex(dragIndexRef.current);
          if (pointerIdRef.current !== null) {
            (e.currentTarget as HTMLElement).setPointerCapture(
              pointerIdRef.current,
            );
          }
        }
        if (!didDragRef.current) return;
        const container = containerRef.current;
        if (!container) return;
        const children = Array.from(container.children) as HTMLElement[];
        let found = overIndex;
        for (let i = 0; i < children.length; i++) {
          const rect = children[i].getBoundingClientRect();
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            found = i;
            break;
          }
        }
        if (found !== overIndex) setOverIndex(found);
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (dragIndexRef.current === null) return;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (
          didDragRef.current &&
          overIndex !== null &&
          overIndex !== dragIndexRef.current
        ) {
          const next = [...items];
          const [moved] = next.splice(dragIndexRef.current, 1);
          next.splice(overIndex, 0, moved);
          onReorder(next);
        }
        dragIndexRef.current = null;
        startPosRef.current = null;
        didDragRef.current = false;
        setActiveIndex(null);
        setOverIndex(null);
      },
      onPointerCancel: () => {
        dragIndexRef.current = null;
        startPosRef.current = null;
        didDragRef.current = false;
        setActiveIndex(null);
        setOverIndex(null);
      },
    }),
    [items, onReorder, overIndex, containerRef],
  );

  return { getHandlers, activeIndex, overIndex };
}

// ─── Geocoding search ─────────────────────────────────────────────────────────
async function searchSpots(query: string): Promise<GeoResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`,
  );
  const data = await res.json();
  return (data.results ?? []) as GeoResult[];
}

function geoToSpot(g: GeoResult): Spot {
  return {
    name: g.name,
    country: g.admin1 ? `${g.admin1}, ${g.country}` : g.country,
    lat: g.latitude,
    lng: g.longitude,
    timezone: g.timezone,
  };
}

// ─── API fetch ────────────────────────────────────────────────────────────────
async function fetchConditions(spot: Spot): Promise<ConditionsData> {
  const { lat, lng } = spot;
  // Use timezone=auto to let Open-Meteo detect from coordinates (works for location-detected spots too)
  const tz =
    spot.timezone === "auto" ? "auto" : encodeURIComponent(spot.timezone);
  const [marineRes, weatherRes] = await Promise.all([
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_direction,wave_period,swell_wave_period,sea_level_height_msl&daily=wave_height_max,wave_direction_dominant,swell_wave_period_max&timezone=${tz}&past_days=16&forecast_days=16`,
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=windspeed_10m,winddirection_10m,apparent_temperature,temperature_2m&daily=windspeed_10m_max&current_weather=true&timezone=${tz}`,
    ),
  ]);
  const [marine, weather] = await Promise.all([
    marineRes.json(),
    weatherRes.json(),
  ]);

  // Use the location's UTC offset (from the marine API) to determine local time
  // at the *spot*, not the browser's local timezone. This ensures the current-hour
  // index is correct regardless of where the user's device is located.
  const utcOffsetSeconds: number = marine.utc_offset_seconds ?? 0;
  const nowLocalMs = Date.now() + utcOffsetSeconds * 1000;
  const nowLocal = new Date(nowLocalMs);
  const currentHourStr = `${nowLocal.getUTCFullYear()}-${String(nowLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(nowLocal.getUTCDate()).padStart(2, "0")}T${String(nowLocal.getUTCHours()).padStart(2, "0")}:00`;
  const hourlyTimes: string[] = marine.hourly?.time ?? [];
  let hi = hourlyTimes.findIndex((t: string) => t === currentHourStr);
  // Fallback: find the closest available hour rather than silently using index 0 (which is 16 days ago)
  if (hi < 0) {
    hi = hourlyTimes.reduce((best, t, idx) => {
      const diff = Math.abs(
        new Date(t).getTime() - (Date.now() + utcOffsetSeconds * 1000),
      );
      const bestDiff = Math.abs(
        new Date(hourlyTimes[best] ?? t).getTime() -
          (Date.now() + utcOffsetSeconds * 1000),
      );
      return diff < bestDiff ? idx : best;
    }, 0);
  }

  const wHourlyTimes: string[] = weather.hourly?.time ?? [];
  let wi = wHourlyTimes.findIndex((t: string) => t === currentHourStr);
  if (wi < 0) {
    wi = wHourlyTimes.reduce((best, t, idx) => {
      const diff = Math.abs(
        new Date(t).getTime() - (Date.now() + utcOffsetSeconds * 1000),
      );
      const bestDiff = Math.abs(
        new Date(wHourlyTimes[best] ?? t).getTime() -
          (Date.now() + utcOffsetSeconds * 1000),
      );
      return diff < bestDiff ? idx : best;
    }, 0);
  }

  const waveHeight = marine.hourly?.wave_height?.[hi] ?? 1.2;
  const waveDirection = marine.hourly?.wave_direction?.[hi] ?? 270;
  const swellPeriod = marine.hourly?.swell_wave_period?.[hi] ?? 0;
  const windSpeed =
    weather.current_weather?.windspeed ??
    weather.hourly?.windspeed_10m?.[wi] ??
    15;
  const windDirection =
    weather.current_weather?.winddirection ??
    weather.hourly?.winddirection_10m?.[wi] ??
    270;
  const waterTemp = weather.hourly?.apparent_temperature?.[wi] ?? 18;
  const airTemp = weather.hourly?.temperature_2m?.[wi] ?? 20;
  const dailyWindSpeed: number[] =
    weather.daily?.windspeed_10m_max ?? Array(7).fill(15);

  const dailyWaveMax: number[] = marine.daily?.wave_height_max ?? [
    1, 1.2, 0.8, 1.5, 2, 1.8, 1.1,
  ];
  const dailyWaveDir: number[] =
    marine.daily?.wave_direction_dominant ?? Array(7).fill(270);
  const dailySwellPeriod: number[] =
    marine.daily?.swell_wave_period_max ?? Array(7).fill(0);
  const dailyDates: string[] =
    marine.daily?.time ??
    [...Array(7).keys()].map((i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });

  // Extract today's tide heights (24 hourly values in location local time)
  // The marine API returns sea_level_height_msl referenced to Mean Sea Level (MSL),
  // NOT to Chart Datum (LAT/CD). To convert to Chart Datum-referenced heights
  // (matching official tide tables), we compute a Chart Datum offset by finding
  // the global minimum over a wide ±16-day window (proxy for Lowest Astronomical Tide).

  const allTideHeights: (number | null)[] =
    marine.hourly?.sea_level_height_msl ?? [];
  const marineHourlyTimes: string[] = marine.hourly?.time ?? [];

  // Find today's date in the location's local timezone using the UTC offset
  // (utcOffsetSeconds, nowLocalMs, nowLocal already computed above)
  const todayDateStr = `${nowLocal.getUTCFullYear()}-${String(nowLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(nowLocal.getUTCDate()).padStart(2, "0")}`;

  const todayStartIdx = marineHourlyTimes.findIndex((t: string) =>
    t.startsWith(todayDateStr),
  );
  const rawTide =
    todayStartIdx >= 0
      ? (allTideHeights.slice(todayStartIdx, todayStartIdx + 24) as number[])
      : Array(24).fill(null);
  // Fill nulls with linear interpolation from neighbours, or 0 as fallback
  const rawTideFilled: number[] = rawTide.map((v, i, arr) => {
    if (v !== null && v !== undefined) return v as number;
    let lo = i - 1;
    let hi = i + 1;
    while (lo >= 0 && (arr[lo] === null || arr[lo] === undefined)) lo--;
    while (hi < arr.length && (arr[hi] === null || arr[hi] === undefined)) hi++;
    const loVal = lo >= 0 ? arr[lo] : null;
    const hiVal = hi < arr.length ? arr[hi] : null;
    if (loVal !== null && hiVal !== null)
      return ((loVal as number) + (hiVal as number)) / 2;
    if (loVal !== null) return loVal as number;
    if (hiVal !== null) return hiVal as number;
    return 0;
  });
  // Compute Chart Datum offset: the global minimum over the full ±16-day window
  // approximates Lowest Astronomical Tide (LAT), which is 0m on Admiralty charts.
  // Subtracting this offset converts MSL-referenced values to Chart Datum-referenced
  // values matching official tide tables (e.g. +1.4m low, +12.6m high for Bristol).
  const allValidHeights = allTideHeights.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  const chartDatumOffset =
    allValidHeights.length > 0 ? Math.min(...allValidHeights) : 0;
  const tideHeights: number[] = rawTideFilled.map((v) => v - chartDatumOffset);

  return {
    waveHeight,
    waveDirection,
    swellPeriod,
    windSpeed,
    windDirection,
    waterTemp,
    airTemp,
    dailyWaveMax,
    dailyWaveDir,
    dailyDates,
    dailyWindSpeed,
    dailySwellPeriod,
    tideHeights,
    utcOffsetSeconds,
  };
}

// ─── SearchModal ──────────────────────────────────────────────────────────────
function SearchModal({
  slotIndex,
  currentSlot,
  onSelect,
  onClear,
  onClose,
}: {
  slotIndex: number;
  currentSlot: Spot | null;
  onSelect: (spot: Spot) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchSpots(query);
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to close is a standard modal UX pattern
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 100,
        background: "rgba(2,13,24,0.85)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
      aria-hidden="true"
    >
      <dialog
        open
        className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden bg-transparent border-0 p-0"
        style={{
          background:
            "linear-gradient(145deg, rgba(13,30,52,0.98) 0%, rgba(2,13,24,0.99) 100%)",
          border: "1px solid rgba(13,79,110,0.7)",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,180,216,0.08)",
        }}
        data-ocid="search.modal"
        aria-label={`Assign spot to Preset ${slotIndex + 1}`}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(13,79,110,0.4)" }}
        >
          <div>
            <h2 className="font-display font-bold text-white text-lg">
              Assign Preset {slotIndex + 1}
            </h2>
            <p
              className="font-body text-xs mt-0.5"
              style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
            >
              Search any surf spot worldwide
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{
              background: "rgba(13,79,110,0.3)",
              border: "1px solid rgba(13,79,110,0.5)",
              color: "var(--color-seafoam)",
            }}
            data-ocid="search.close_button"
            aria-label="Close search"
          >
            <X size={14} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-6 pt-5 pb-3">
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: "rgba(13,79,110,0.2)",
              border: "1px solid rgba(13,79,110,0.6)",
            }}
          >
            <Search
              size={15}
              style={{ color: "var(--color-electric)", flexShrink: 0 }}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Pipeline, Hossegor, Uluwatu…"
              className="flex-1 bg-transparent outline-none font-body text-sm text-white placeholder:opacity-40"
              data-ocid="search.input"
              aria-label="Search for a surf spot"
            />
            {searching && (
              <div
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{
                  borderColor: "var(--color-electric)",
                  borderTopColor: "transparent",
                }}
                aria-label="Searching..."
              />
            )}
          </div>
        </div>

        {/* Clear option */}
        {currentSlot && (
          <div className="px-6 pb-3">
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="w-full text-left rounded-xl px-4 py-3 font-body text-sm transition-all hover:scale-[1.01]"
              style={{
                background: "rgba(255,107,71,0.08)",
                border: "1px solid rgba(255,107,71,0.3)",
                color: "var(--color-coral)",
              }}
              data-ocid="search.cancel_button"
            >
              ✕ &nbsp;Clear "{currentSlot.name}" from this preset
            </button>
          </div>
        )}

        {/* Results list */}
        <div
          className="max-h-64 overflow-y-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(13,79,110,0.5) transparent",
          }}
        >
          {results.length === 0 && query.trim() && !searching && (
            <div
              className="px-6 py-8 text-center font-body text-sm"
              style={{ color: "var(--color-seafoam)", opacity: 0.5 }}
              data-ocid="search.empty_state"
            >
              No spots found for "{query}"
            </div>
          )}
          {results.length === 0 && !query.trim() && (
            <div
              className="px-6 py-6 text-center font-body text-xs"
              style={{ color: "var(--color-seafoam)", opacity: 0.4 }}
            >
              Start typing to search surf spots worldwide
            </div>
          )}
          {results.map((result, i) => (
            <button
              type="button"
              key={`${result.name}-${result.latitude}-${result.longitude}`}
              onClick={() => {
                onSelect(geoToSpot(result));
                onClose();
              }}
              className="w-full text-left flex items-center gap-3 px-6 py-3.5 transition-all duration-150"
              style={{
                borderTop: i === 0 ? "1px solid rgba(13,79,110,0.3)" : "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(13,79,110,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "";
              }}
              data-ocid={`search.item.${i + 1}`}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(0,180,216,0.12)",
                  border: "1px solid rgba(0,180,216,0.25)",
                }}
              >
                <Waves size={12} style={{ color: "var(--color-electric)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-body font-semibold text-white text-sm truncate">
                  {result.name}
                </div>
                <div
                  className="font-body text-xs truncate"
                  style={{ color: "var(--color-seafoam)", opacity: 0.65 }}
                >
                  {result.admin1 ? `${result.admin1}, ` : ""}
                  {result.country}
                </div>
              </div>
              <span
                className="text-xs flex-shrink-0"
                style={{ color: "var(--color-electric)", opacity: 0.5 }}
              >
                →
              </span>
            </button>
          ))}
        </div>

        {/* Bottom padding */}
        <div className="h-4" />
      </dialog>
    </div>
  );
}

// ─── PresetBar ────────────────────────────────────────────────────────────────
function PresetBar({
  presets,
  setPresets,
  selectedSpot,
  loadSpot,
}: {
  presets: PresetSlots;
  setPresets: (presets: PresetSlots) => void;
  selectedSpot: Spot | null;
  loadSpot: (spot: Spot) => void;
}) {
  const [modalSlot, setModalSlot] = useState<number | null>(null);

  const handleSelect = (spot: Spot, slotIndex: number) => {
    const next = [...presets];
    next[slotIndex] = spot;
    setPresets(next);
    loadSpot(spot);
  };

  const handleClear = (slotIndex: number) => {
    const next = [...presets];
    next[slotIndex] = null;
    setPresets(next);
  };

  const presetBarRef = useRef<HTMLDivElement | null>(null);
  const {
    getHandlers: getPresetHandlers,
    activeIndex: activePresetIndex,
    overIndex: overPresetIndex,
  } = useSortable(presets, setPresets, presetBarRef);

  return (
    <>
      <fieldset className="border-0 p-0 m-0">
        <legend className="sr-only">Preset surf spots</legend>
        <div ref={presetBarRef} className="flex flex-wrap gap-2 md:gap-3">
          {presets.map((spot, i) => {
            const isSelected =
              spot !== null && selectedSpot?.name === spot.name;
            const isEmpty = spot === null;
            const isDraggingThis = activePresetIndex === i;
            const isDragTarget = overPresetIndex === i;

            if (isEmpty) {
              return (
                <div
                  key={`slot-${i + 1}`}
                  {...getPresetHandlers(i)}
                  style={{
                    borderRadius: 9999,
                    transition:
                      "box-shadow 0.15s ease, border-color 0.15s ease, outline 0.15s ease",
                    outline:
                      overPresetIndex === i && activePresetIndex !== i
                        ? "2px solid var(--color-electric)"
                        : "none",
                    outlineOffset: "2px",
                    touchAction: "none",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setModalSlot(i)}
                    data-ocid={`preset.item.${i + 1}`}
                    className="group flex items-center gap-2 rounded-full px-4 py-2.5 font-body text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 min-h-[44px]"
                    style={{
                      background: isDragTarget
                        ? "rgba(0,180,216,0.12)"
                        : "rgba(13,79,110,0.15)",
                      border: isDragTarget
                        ? "1px dashed var(--color-electric)"
                        : "1px dashed rgba(13,79,110,0.5)",
                      color: isDragTarget
                        ? "var(--color-electric)"
                        : "rgba(168,216,200,0.45)",
                    }}
                    aria-label={`Set Preset ${i + 1}`}
                  >
                    <Plus
                      size={13}
                      className="transition-transform group-hover:rotate-90"
                      style={{
                        color: "var(--color-electric)",
                        opacity: isDragTarget ? 1 : 0.5,
                      }}
                    />
                    <span>Preset {i + 1}</span>
                  </button>
                </div>
              );
            }

            return (
              <div
                key={`slot-filled-${i + 1}`}
                className="relative flex items-center group"
                {...getPresetHandlers(i)}
                style={{
                  opacity: isDraggingThis ? 0.45 : 1,
                  transition: "opacity 0.15s ease, outline 0.15s ease",
                  borderRadius: 9999,
                  cursor: isDraggingThis ? "grabbing" : "grab",
                  outline:
                    isDragTarget && !isDraggingThis
                      ? "2px solid var(--color-electric)"
                      : "none",
                  outlineOffset: "2px",
                  touchAction: "none",
                }}
              >
                {/* Drag handle — visible on hover */}
                <span
                  className="absolute -left-1 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none"
                  style={{ color: "var(--color-seafoam)", zIndex: 1 }}
                  aria-hidden="true"
                >
                  <GripVertical size={14} />
                </span>

                <button
                  type="button"
                  onClick={() => loadSpot(spot)}
                  data-ocid={`preset.item.${i + 1}`}
                  className="flex items-center gap-2 rounded-full px-4 py-2.5 font-body text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 min-h-[44px]"
                  style={{
                    background: isSelected
                      ? "var(--color-electric)"
                      : "rgba(13,79,110,0.35)",
                    border: `1px solid ${
                      isSelected
                        ? "var(--color-electric)"
                        : "rgba(13,79,110,0.7)"
                    }`,
                    color: isSelected
                      ? "var(--color-bg)"
                      : "rgba(255,255,255,0.88)",
                    fontWeight: isSelected ? 700 : 400,
                    // Prevent text selection during drag
                    userSelect: "none",
                  }}
                  aria-label={`Load ${spot.name}`}
                  aria-pressed={isSelected}
                >
                  <span className="truncate max-w-[140px]">{spot.name}</span>
                </button>
                {/* Edit button overlaid on right edge */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalSlot(i);
                  }}
                  data-ocid={`preset.edit_button.${i + 1}`}
                  className="absolute right-2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: isSelected
                      ? "rgba(2,13,24,0.25)"
                      : "rgba(13,79,110,0.5)",
                    color: isSelected
                      ? "rgba(2,13,24,0.8)"
                      : "var(--color-seafoam)",
                  }}
                  aria-label={`Edit Preset ${i + 1}`}
                >
                  <Pencil size={10} />
                </button>
              </div>
            );
          })}
        </div>
      </fieldset>

      {modalSlot !== null && (
        <SearchModal
          slotIndex={modalSlot}
          currentSlot={presets[modalSlot]}
          onSelect={(spot) => handleSelect(spot, modalSlot)}
          onClear={() => handleClear(modalSlot)}
          onClose={() => setModalSlot(null)}
        />
      )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  status,
  icon,
  decimals = 1,
}: {
  label: string;
  value: number;
  unit: string;
  status: Status;
  icon: React.ReactNode;
  decimals?: number;
}) {
  const countedStr = useCountUp(value, 1000, decimals);
  const color = STATUS_COLOR[status];

  return (
    <div
      className="relative flex flex-col gap-2 rounded-xl p-4 sm:p-6 flex-1 min-w-0"
      style={{
        background:
          "linear-gradient(135deg, rgba(13,79,110,0.45) 0%, rgba(2,13,24,0.7) 100%)",
        border: "1px solid rgba(13,79,110,0.6)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div
        className="status-dot absolute top-4 right-4 w-3 h-3 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--color-electric)" }} className="opacity-70">
          {icon}
        </span>
        <span
          className="text-xs font-body tracking-widest uppercase"
          style={{ color: "var(--color-seafoam)", opacity: 0.8 }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2 leading-none flex-wrap min-w-0">
        <span
          className="font-display font-extrabold text-white"
          style={{ fontSize: "clamp(1.8rem, 6vw, 4.5rem)", lineHeight: 1 }}
        >
          {countedStr}
        </span>
        <span
          className="font-body text-sm tracking-wide"
          style={{ color: "var(--color-electric)", opacity: 0.8 }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}

function CompassCard({ degrees }: { degrees: number }) {
  return (
    <div
      className="relative flex flex-col gap-2 rounded-xl p-4 sm:p-6 flex-1 min-w-0"
      style={{
        background:
          "linear-gradient(135deg, rgba(13,79,110,0.45) 0%, rgba(2,13,24,0.7) 100%)",
        border: "1px solid rgba(13,79,110,0.6)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div
        className="status-dot absolute top-4 right-4 w-3 h-3 rounded-full"
        style={{
          background: STATUS_COLOR.average,
          boxShadow: `0 0 8px ${STATUS_COLOR.average}`,
        }}
      />
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--color-electric)" }} className="opacity-70">
          <Compass size={14} />
        </span>
        <span
          className="text-xs font-body tracking-widest uppercase"
          style={{ color: "var(--color-seafoam)", opacity: 0.8 }}
        >
          DIRECTION
        </span>
      </div>
      <div className="flex items-baseline gap-2 leading-none flex-wrap min-w-0">
        <span
          className="font-display font-extrabold text-white"
          style={{ fontSize: "clamp(1.8rem, 6vw, 4.5rem)", lineHeight: 1 }}
        >
          {degreesToCompass(degrees)}
        </span>
      </div>
    </div>
  );
}

function ForecastCard({
  date,
  waveMax,
  waveDir,
  windSpeed,
  index,
  displayHeight,
  heightLabel,
  displaySpeed,
  speedLabel,
  swellPeriod,
}: {
  date: string;
  waveMax: number;
  waveDir: number;
  windSpeed: number;
  swellPeriod: number;
  index: number;
  displayHeight: (m: number) => number;
  heightLabel: string;
  displaySpeed: (k: number) => number;
  speedLabel: string;
}) {
  const maxBar = 3.5;
  const barH = Math.min((waveMax / maxBar) * 60, 60);
  const _emoji = conditionEmoji(waveMax, 20);
  const compassDir = degreesToCompass(waveDir);

  return (
    <div
      className="forecast-card flex flex-col items-center gap-2 rounded-xl px-2 py-5 w-full"
      style={{
        animationDelay: `${index * 50}ms`,
        background: "rgba(13,79,110,0.25)",
        border: "1px solid rgba(13,79,110,0.5)",
      }}
      data-ocid={`forecast.item.${index + 1}`}
    >
      <span
        className="font-body text-sm tracking-widest font-semibold"
        style={{ color: "var(--color-seafoam)" }}
      >
        {dayName(date)}
      </span>
      <div className="flex items-end justify-center" style={{ height: 64 }}>
        <div
          style={{
            width: 12,
            height: barH,
            background:
              "linear-gradient(to top, var(--color-electric), var(--color-seafoam))",
            borderRadius: 4,
            transition: "height 0.5s ease",
          }}
        />
      </div>
      <span className="font-display font-bold text-white text-base">
        {displayHeight(waveMax).toFixed(1)}
        {heightLabel}
      </span>
      {swellPeriod > 0 && (
        <span className="font-display font-bold text-white text-base">
          {swellPeriod.toFixed(0)}s
        </span>
      )}
      <span
        className="text-sm font-semibold"
        style={{ color: "var(--color-electric)" }}
      >
        {displaySpeed(windSpeed).toFixed(0)}
        {speedLabel}
      </span>
      <span className="text-sm" style={{ color: "var(--color-electric)" }}>
        {compassDir}
      </span>
      <div
        style={{
          transform: `rotate(${(waveDir + 180) % 360}deg)`,
          transition: "transform 0.4s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        className="w-7 h-7 flex-shrink-0"
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 20 20"
          fill="none"
          role="img"
          aria-label="Wind direction compass"
        >
          <circle
            cx="10"
            cy="10"
            r="9"
            stroke="rgba(0,180,216,0.3)"
            strokeWidth="1.5"
          />
          <polygon
            points="10,2 13,14 10,12 7,14"
            fill="var(--color-electric)"
            opacity="0.9"
          />
          <circle cx="10" cy="10" r="1.5" fill="rgba(168,216,200,0.6)" />
        </svg>
      </div>
    </div>
  );
}

function TideChart({
  tideHeights,
  utcOffsetSeconds,
  displayHeight,
  heightLabel,
}: {
  tideHeights: number[];
  utcOffsetSeconds: number;
  displayHeight: (m: number) => number;
  heightLabel: string;
}) {
  const svgRef = useRef<SVGPathElement>(null);
  const W = 800;
  const H = 160;

  // Build 24 points from real hourly sea-level data (index = local hour 0-23)
  const points: { x: number; y: number }[] = [];
  const validHeights = tideHeights.filter(
    (v) => typeof v === "number" && Number.isFinite(v),
  );
  const hasRealData = validHeights.length >= 4;

  if (hasRealData) {
    for (let i = 0; i < Math.min(tideHeights.length, 24); i++) {
      const v = tideHeights[i];
      points.push({
        x: i / 23,
        y: typeof v === "number" && Number.isFinite(v) ? v : 0,
      });
    }
  } else {
    // Fallback: generate a plausible sinusoidal curve
    for (let i = 0; i <= 23; i++) {
      const h = 1.5 + 1.2 * Math.sin((2 * Math.PI * i) / 12.42);
      points.push({ x: i / 23, y: h });
    }
  }

  const tideYValues = points.map((p) => p.y);
  const tideMax = Math.max(...tideYValues);
  const tideMin = Math.min(...tideYValues);
  const yRange = tideMax - tideMin || 1;
  const yPad = yRange * 0.15;
  const yLo = tideMin - yPad;
  const yHi = tideMax + yPad;

  // SVG path using actual y range
  const toSVGY = (v: number) =>
    H - ((v - yLo) / (yHi - yLo)) * (H * 0.8) - H * 0.1;
  let pathD = "";
  for (let i = 0; i < points.length; i++) {
    const sx = points[i].x * W;
    const sy = toSVGY(points[i].y);
    if (i === 0) {
      pathD += `M ${sx} ${sy}`;
    } else {
      const prevSx = points[i - 1].x * W;
      const prevSy = toSVGY(points[i - 1].y);
      const cpx = (prevSx + sx) / 2;
      pathD += ` C ${cpx} ${prevSy}, ${cpx} ${sy}, ${sx} ${sy}`;
    }
  }

  // Current time position relative to local time at the location
  const nowUtcMs = Date.now();
  const localMs = nowUtcMs + utcOffsetSeconds * 1000;
  const localDate = new Date(localMs);
  const localHour = localDate.getUTCHours();
  const localMin = localDate.getUTCMinutes();
  const currentHourFrac = (localHour + localMin / 60) / 24;
  const currentX = currentHourFrac * W;

  // Time labels in location local time (every 6 hours)
  const timeLabels = [0, 6, 12, 18, 24].map((h) => {
    const displayH = h % 24;
    return `${String(displayH).padStart(2, "0")}:00`;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: tideHeights triggers re-animation
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.setProperty("--path-length", String(len));
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    el.style.transition = "none";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 1.5s ease-in-out";
        el.style.strokeDashoffset = "0";
      });
    });
  }, [tideHeights]);

  const gridFracs = [0.25, 0.5, 0.75];

  return (
    <div
      className="w-full overflow-hidden rounded-xl"
      style={{
        border: "1px solid rgba(13,79,110,0.5)",
        background: "rgba(2,13,24,0.8)",
      }}
    >
      <div className="px-6 pt-5 pb-2">
        <h3
          className="font-body text-xs tracking-widest uppercase font-semibold"
          style={{ color: "var(--color-seafoam)", opacity: 0.8 }}
        >
          Tide Chart — Today
        </h3>
      </div>
      <div className="px-4 pb-4">
        <svg
          viewBox={`0 0 ${W} ${H + 38}`}
          className="w-full"
          style={{ height: 200 }}
        >
          <title>Today's Tide Chart</title>
          {gridFracs.map((frac) => (
            <line
              key={frac}
              x1={0}
              y1={H * frac}
              x2={W}
              y2={H * frac}
              stroke="rgba(13,79,110,0.3)"
              strokeWidth={1}
            />
          ))}
          <path
            ref={svgRef}
            d={pathD}
            fill="none"
            stroke="var(--color-electric)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <path
            d={`${pathD} L ${W} ${H} L 0 ${H} Z`}
            fill="url(#tideGradient)"
            opacity={0.15}
          />
          <defs>
            <linearGradient id="tideGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00b4d8" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#00b4d8" stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Current local-time position marker */}
          <line
            x1={currentX}
            y1={0}
            x2={currentX}
            y2={H}
            stroke="var(--color-average)"
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.9}
          />
          <circle
            cx={currentX}
            cy={4}
            r={4}
            fill="var(--color-average)"
            opacity={0.9}
          />
          {/* X-axis time labels (local time) */}
          {timeLabels.map((label, i) => (
            <text
              key={label}
              x={(i / 4) * W}
              y={H + 25}
              fill="rgba(168,216,200,0.5)"
              fontSize={15}
              fontFamily="General Sans, sans-serif"
              textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
            >
              {label}
            </text>
          ))}
          {/* Y-axis scale: actual daily max and min tide heights */}
          {[
            { value: tideMax, y: toSVGY(tideMax) },
            { value: tideMin, y: toSVGY(tideMin) },
          ].map(({ value, y }) => {
            const label = `${displayHeight(value).toFixed(1)}${heightLabel}`;
            const labelW = label.length * 11;
            return (
              <g key={value}>
                <rect
                  x={W - labelW - 10}
                  y={y - 13}
                  width={labelW + 8}
                  height={22}
                  rx={4}
                  fill="rgba(2,13,24,0.72)"
                />
                <text
                  x={W - 8}
                  y={y}
                  fill="rgba(168,216,200,0.95)"
                  fontSize={18}
                  fontWeight="600"
                  fontFamily="General Sans, sans-serif"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div
      className="animate-pulse space-y-6"
      data-ocid="dashboard.loading_state"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-40 rounded-xl"
            style={{ background: "rgba(13,79,110,0.2)" }}
          />
        ))}
      </div>
      <div
        className="h-24 rounded-xl"
        style={{ background: "rgba(13,79,110,0.2)" }}
      />
      <div
        className="h-48 rounded-xl"
        style={{ background: "rgba(13,79,110,0.2)" }}
      />
    </div>
  );
}

// ─── Spot Header with live local time ────────────────────────────────────────
function SpotHeader({ spot }: { spot: Spot }) {
  const localTime = useLocalTime(
    spot.timezone === "auto" ? "UTC" : spot.timezone,
  );
  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      <h2 className="font-display font-bold text-2xl text-white">
        {spot.name}
      </h2>
      <span
        className="font-body text-sm"
        style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
      >
        {spot.country}
      </span>
      <span
        className="font-body text-xs tracking-widest font-medium px-2 py-0.5 rounded-full"
        style={{
          color: "var(--color-seafoam)",
          background: "rgba(168,216,200,0.08)",
          border: "1px solid rgba(168,216,200,0.18)",
        }}
      >
        {localTime} local
      </span>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [presets, setPresetsState] = useState<PresetSlots>(() => loadPresets());
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [data, setData] = useState<ConditionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Units of measure settings
  const [units, setUnitsState] = useState<UnitSettings>(loadUnits);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setUnits = useCallback((next: UnitSettings) => {
    setUnitsState(next);
    saveUnits(next);
  }, []);

  // Tile order state
  const [tileOrder, setTileOrderState] = useState<TileId[]>(() =>
    loadTileOrder(),
  );
  const setTileOrder = useCallback((next: TileId[]) => {
    setTileOrderState(next);
    saveTileOrder(next);
  }, []);
  const conditionGridRef = useRef<HTMLDivElement | null>(null);
  const {
    getHandlers: getTileHandlers,
    activeIndex: activeTileIndex,
    overIndex: overTileIndex,
  } = useSortable(tileOrder, setTileOrder, conditionGridRef);

  // Current location state
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Persist presets to localStorage on every change
  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  const setPresets = useCallback((next: PresetSlots) => {
    setPresetsState(next);
  }, []);

  const loadSpot = useCallback(async (spot: Spot) => {
    setSelectedSpot(spot);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await fetchConditions(spot);
      setData(result);
    } catch (e) {
      setError("Failed to load conditions. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            { headers: { "User-Agent": "SWELL-App" } },
          );
          const geoData = await res.json();
          const name =
            geoData.address?.city ||
            geoData.address?.town ||
            geoData.address?.village ||
            geoData.name ||
            "My Location";
          const country = geoData.address?.country ?? "";
          const spot: Spot = {
            name,
            country,
            lat,
            lng: lon,
            timezone: "auto",
          };
          await loadSpot(spot);
        } catch {
          setLocationError("Couldn't detect your location. Try again.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocationError(
          "Location access denied. Please enable it in your browser.",
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }, [loadSpot]);

  // Display value helpers (convert from raw metric API values)
  const displayHeight = (m: number) =>
    units.height === "ft" ? metresToFeet(m) : m;
  const heightLabel = units.height === "ft" ? "ft" : "m";
  const displayTemp = (c: number) =>
    units.temp === "F" ? celsiusToFahrenheit(c) : c;
  const tempLabel = units.temp === "F" ? "°F" : "°C";
  const displaySpeed = (k: number) =>
    units.speed === "kts"
      ? kmhToKnots(k)
      : units.speed === "mph"
        ? kmhToMph(k)
        : k;
  const speedLabel = units.speed;

  // Compute overall rating
  const overallRating: "good" | "average" | "poor" = data
    ? waveStatus(data.waveHeight) === "good" &&
      windStatus(data.windSpeed) === "good"
      ? "good"
      : waveStatus(data.waveHeight) === "poor" ||
          windStatus(data.windSpeed) === "poor"
        ? "poor"
        : "average"
    : "average";

  return (
    <div
      className="relative min-h-screen"
      style={{
        background: "var(--color-bg)",
        fontFamily: "'General Sans', sans-serif",
      }}
    >
      {/* DYNAMIC WAVE BACKGROUND — full screen, fixed, behind everything */}
      <HeroWaveCanvas
        waveHeight={data?.waveHeight ?? 1.2}
        windSpeed={data?.windSpeed ?? 10}
        rating={overallRating}
      />

      {/* PAGE CONTENT — above wave layer */}
      <div className="relative" style={{ zIndex: 1 }}>
        {/* HEADER */}
        <header className="px-6 md:px-12 pt-8 pb-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-display font-black tracking-[0.15em] text-2xl cursor-pointer bg-transparent border-0 p-0 hover:opacity-80 transition-opacity"
              style={{ color: "var(--color-electric)" }}
              aria-label="Refresh app"
            >
              SWELL
            </button>
            <div className="flex items-center gap-4">
              <div
                className="font-body text-xs tracking-widest uppercase"
                style={{ color: "var(--color-seafoam)", opacity: 0.5 }}
              >
                SETTINGS
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 hover:opacity-100"
                style={{
                  background: "rgba(13,79,110,0.3)",
                  border: "1px solid rgba(13,79,110,0.5)",
                  color: "var(--color-seafoam)",
                  opacity: 0.7,
                }}
                aria-label="Open settings"
                data-ocid="header.settings_button"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* SETTINGS SHEET */}
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetContent
            side="right"
            className="w-80 border-0 p-0"
            style={{
              background:
                "linear-gradient(170deg, rgba(13,30,52,0.98) 0%, rgba(2,13,24,0.99) 100%)",
              borderLeft: "1px solid rgba(13,79,110,0.6)",
            }}
            data-ocid="settings.sheet"
          >
            <SheetHeader
              className="px-6 pt-6 pb-4"
              style={{ borderBottom: "1px solid rgba(13,79,110,0.3)" }}
            >
              <SheetTitle className="font-display font-bold text-white flex items-center gap-2">
                <Settings
                  size={16}
                  style={{ color: "var(--color-electric)" }}
                />
                Units & Display
              </SheetTitle>
            </SheetHeader>

            <div className="px-6 py-6 space-y-8 overflow-y-auto">
              {/* Saved Spots */}
              <div className="space-y-3">
                <p
                  className="font-body text-xs tracking-widest uppercase font-semibold"
                  style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                >
                  Your Saved Spots
                </p>
                <PresetBar
                  presets={presets}
                  setPresets={setPresets}
                  selectedSpot={selectedSpot}
                  loadSpot={(spot) => {
                    loadSpot(spot);
                    setSettingsOpen(false);
                  }}
                />
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={locating}
                    data-ocid="location.button"
                    className="flex items-center gap-2 rounded-full px-5 py-2.5 font-body text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                    style={{
                      background: locating
                        ? "rgba(0,180,216,0.1)"
                        : "rgba(0,180,216,0.08)",
                      border: "1px solid rgba(0,180,216,0.35)",
                      color: "var(--color-electric)",
                    }}
                    aria-label="Use my current location to detect nearest surf conditions"
                  >
                    {locating ? (
                      <div
                        className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                        style={{
                          borderColor: "var(--color-electric)",
                          borderTopColor: "transparent",
                        }}
                        aria-hidden="true"
                      />
                    ) : (
                      <LocateFixed
                        size={15}
                        className="flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {locating ? "Detecting location…" : "Use my location"}
                    </span>
                  </button>
                  {locationError && (
                    <p
                      className="font-body text-xs px-1"
                      style={{ color: "var(--color-coral)" }}
                      role="alert"
                    >
                      {locationError}
                    </p>
                  )}
                </div>
              </div>

              <hr style={{ borderColor: "rgba(13,79,110,0.3)" }} />

              {/* Wave Height */}
              <div className="space-y-3">
                <p
                  className="font-body text-xs tracking-widest uppercase font-semibold"
                  style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                >
                  Wave Height
                </p>
                <div className="flex gap-2">
                  {(["ft", "m"] as HeightUnit[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setUnits({ ...units, height: opt })}
                      className="flex-1 rounded-xl py-3 font-body text-sm font-semibold transition-all duration-200"
                      style={
                        units.height === opt
                          ? {
                              background: "var(--color-electric)",
                              color: "var(--color-bg)",
                              border: "1px solid var(--color-electric)",
                            }
                          : {
                              background: "rgba(13,79,110,0.2)",
                              color: "var(--color-seafoam)",
                              border: "1px solid rgba(13,79,110,0.4)",
                              opacity: 0.7,
                            }
                      }
                      data-ocid={`settings.height_${opt}_toggle`}
                      aria-pressed={units.height === opt}
                    >
                      {opt === "ft" ? "Feet" : "Meters"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Temperature */}
              <div className="space-y-3">
                <p
                  className="font-body text-xs tracking-widest uppercase font-semibold"
                  style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                >
                  Temperature
                </p>
                <div className="flex gap-2">
                  {(["F", "C"] as TempUnit[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setUnits({ ...units, temp: opt })}
                      className="flex-1 rounded-xl py-3 font-body text-sm font-semibold transition-all duration-200"
                      style={
                        units.temp === opt
                          ? {
                              background: "var(--color-electric)",
                              color: "var(--color-bg)",
                              border: "1px solid var(--color-electric)",
                            }
                          : {
                              background: "rgba(13,79,110,0.2)",
                              color: "var(--color-seafoam)",
                              border: "1px solid rgba(13,79,110,0.4)",
                              opacity: 0.7,
                            }
                      }
                      data-ocid={`settings.temp_${opt}_toggle`}
                      aria-pressed={units.temp === opt}
                    >
                      {opt === "F" ? "°F" : "°C"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wind Speed */}
              <div className="space-y-3">
                <p
                  className="font-body text-xs tracking-widest uppercase font-semibold"
                  style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                >
                  Wind Speed
                </p>
                <div className="flex gap-2">
                  {(["kts", "mph", "km/h"] as SpeedUnit[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setUnits({ ...units, speed: opt })}
                      className="flex-1 rounded-xl py-3 font-body text-sm font-semibold transition-all duration-200"
                      style={
                        units.speed === opt
                          ? {
                              background: "var(--color-electric)",
                              color: "var(--color-bg)",
                              border: "1px solid var(--color-electric)",
                            }
                          : {
                              background: "rgba(13,79,110,0.2)",
                              color: "var(--color-seafoam)",
                              border: "1px solid rgba(13,79,110,0.4)",
                              opacity: 0.7,
                            }
                      }
                      data-ocid={`settings.speed_${opt.replace("/", "_")}_toggle`}
                      aria-pressed={units.speed === opt}
                    >
                      {opt === "kts" ? "Knots" : opt === "mph" ? "MPH" : "KM/H"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* HERO */}
        {!selectedSpot && (
          <section
            className="px-6 md:px-12 pt-10 pb-8"
            data-ocid="hero.section"
          >
            <div className="max-w-7xl mx-auto">
              <h1
                className="font-display font-black text-white leading-none mb-8 whitespace-nowrap"
                style={{
                  fontSize: "clamp(0.9rem, 4.5vw, 7rem)",
                  letterSpacing: "-0.02em",
                }}
              >
                Favorite Mother-In-Law's Ocean
              </h1>
            </div>
          </section>
        )}

        {/* DASHBOARD */}
        {selectedSpot && (
          <main className="px-6 md:px-12 pb-16" data-ocid="dashboard.section">
            <div className="max-w-7xl mx-auto space-y-6">
              <SpotHeader spot={selectedSpot} />

              {loading && <LoadingSkeleton />}

              {error && (
                <div
                  className="rounded-xl p-6 text-center"
                  style={{
                    background: "rgba(255,107,71,0.1)",
                    border: "1px solid rgba(255,107,71,0.3)",
                  }}
                  data-ocid="dashboard.error_state"
                >
                  <p
                    className="font-body"
                    style={{ color: "var(--color-coral)" }}
                  >
                    {error}
                  </p>
                </div>
              )}

              {data && !loading && (
                <>
                  {/* TODAY'S CONDITIONS */}
                  <section data-ocid="conditions.section">
                    <h3
                      className="font-body text-xs tracking-widest uppercase font-semibold mb-4"
                      style={{ color: "var(--color-seafoam)", opacity: 0.7 }}
                    >
                      Today's Conditions
                    </h3>
                    <div
                      ref={conditionGridRef}
                      className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4"
                    >
                      {tileOrder.map((tileId, idx) => {
                        const isWide =
                          tileId === "tide" || tileId === "forecast";
                        const tileContent = (() => {
                          switch (tileId) {
                            case "wave":
                              return (
                                <StatCard
                                  label="Wave Height"
                                  value={displayHeight(data.waveHeight)}
                                  unit={heightLabel}
                                  status={waveStatus(data.waveHeight)}
                                  icon={<Waves size={14} />}
                                  decimals={1}
                                />
                              );
                            case "wind":
                              return (
                                <StatCard
                                  label="Wind Speed"
                                  value={displaySpeed(data.windSpeed)}
                                  unit={speedLabel}
                                  status={windStatus(data.windSpeed)}
                                  icon={<Wind size={14} />}
                                  decimals={1}
                                />
                              );
                            case "direction":
                              return (
                                <CompassCard degrees={data.windDirection} />
                              );
                            case "waterTemp":
                              return (
                                <StatCard
                                  label="Water Temp"
                                  value={displayTemp(data.waterTemp)}
                                  unit={tempLabel}
                                  status={tempStatus(data.waterTemp)}
                                  icon={<Thermometer size={14} />}
                                  decimals={0}
                                />
                              );
                            case "airTemp":
                              return (
                                <StatCard
                                  label="Air Temp"
                                  value={displayTemp(data.airTemp)}
                                  unit={tempLabel}
                                  status={tempStatus(data.airTemp)}
                                  icon={<Thermometer size={14} />}
                                  decimals={0}
                                />
                              );
                            case "period":
                              return (
                                <StatCard
                                  label="PERIOD"
                                  value={data.swellPeriod}
                                  unit="s"
                                  status="good"
                                  icon={<Waves size={14} />}
                                  decimals={0}
                                />
                              );
                            case "tide":
                              return (
                                <TideChart
                                  tideHeights={data?.tideHeights ?? []}
                                  utcOffsetSeconds={data?.utcOffsetSeconds ?? 0}
                                  displayHeight={displayHeight}
                                  heightLabel={heightLabel}
                                />
                              );
                            case "forecast":
                              return (
                                <div
                                  className="w-full overflow-hidden rounded-xl"
                                  style={{
                                    border: "1px solid rgba(13,79,110,0.5)",
                                    background: "rgba(2,13,24,0.8)",
                                  }}
                                >
                                  <div className="px-6 pt-5 pb-2">
                                    <h3
                                      className="font-body text-xs tracking-widest uppercase font-semibold"
                                      style={{
                                        color: "var(--color-seafoam)",
                                        opacity: 0.8,
                                      }}
                                    >
                                      7-Day Forecast
                                    </h3>
                                  </div>
                                  <div className="px-4 pb-4 overflow-x-auto no-scrollbar">
                                    <div
                                      className="grid gap-2"
                                      style={{
                                        gridTemplateColumns:
                                          "repeat(7, minmax(90px, 1fr))",
                                        minWidth: "min-content",
                                      }}
                                    >
                                      {(() => {
                                        const nowLocalMs =
                                          Date.now() +
                                          (data.utcOffsetSeconds ?? 0) * 1000;
                                        const nowLocal = new Date(nowLocalMs);
                                        const todayStr = `${nowLocal.getUTCFullYear()}-${String(nowLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(nowLocal.getUTCDate()).padStart(2, "0")}`;
                                        const todayIdx = Math.max(
                                          0,
                                          data.dailyDates.findIndex(
                                            (d) => d === todayStr,
                                          ),
                                        );
                                        return data.dailyDates
                                          .slice(todayIdx, todayIdx + 7)
                                          .map((date, j) => {
                                            const i = todayIdx + j;
                                            return (
                                              <ForecastCard
                                                key={date}
                                                date={date}
                                                waveMax={
                                                  data.dailyWaveMax[i] ?? 1
                                                }
                                                waveDir={
                                                  data.dailyWaveDir[i] ?? 270
                                                }
                                                windSpeed={
                                                  data.dailyWindSpeed[i] ?? 15
                                                }
                                                swellPeriod={
                                                  data.dailySwellPeriod[i] ?? 0
                                                }
                                                index={j}
                                                displayHeight={displayHeight}
                                                heightLabel={heightLabel}
                                                displaySpeed={displaySpeed}
                                                speedLabel={speedLabel}
                                              />
                                            );
                                          });
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              );
                          }
                        })();
                        return (
                          <div
                            key={tileId}
                            {...getTileHandlers(idx)}
                            className={isWide ? "col-span-2 md:col-span-5" : ""}
                            style={{
                              cursor:
                                activeTileIndex === idx ? "grabbing" : "grab",
                              opacity: activeTileIndex === idx ? 0.5 : 1,
                              outline:
                                overTileIndex === idx && activeTileIndex !== idx
                                  ? "2px solid var(--color-electric)"
                                  : "none",
                              outlineOffset: "2px",
                              borderRadius: "12px",
                              transition:
                                "opacity 0.15s ease, outline 0.15s ease",
                              touchAction: "none",
                            }}
                            data-ocid={`conditions.item.${idx + 1}`}
                          >
                            {tileContent}
                          </div>
                        );
                      })}
                    </div>
                    <p
                      className="text-xs mt-2 text-center"
                      style={{ color: "rgba(168,216,200,0.35)" }}
                    >
                      Drag tiles to reorder
                    </p>
                  </section>
                </>
              )}
            </div>
          </main>
        )}

        {/* FOOTER */}
        <footer
          className="px-6 md:px-12 py-8 mt-auto"
          style={{ borderTop: "1px solid rgba(13,79,110,0.3)" }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
            <p
              className="font-body text-xs"
              style={{ color: "var(--color-seafoam)", opacity: 0.4 }}
            >
              Data from Open-Meteo Marine API
            </p>
            <p
              className="font-body text-xs"
              style={{ color: "var(--color-seafoam)", opacity: 0.4 }}
            >
              © {new Date().getFullYear()}. Built with ❤ using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--color-electric)", opacity: 0.7 }}
              >
                caffeine.ai
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
