import {
  ArrowLeft,
  Cloud,
  Compass,
  Droplets,
  Eye,
  Gauge,
  GripVertical,
  Info,
  LocateFixed,
  Pencil,
  Plus,
  Search,
  Settings,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import HeroWaveCanvas from "./components/HeroWaveCanvas";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./components/ui/sheet";
import { Switch } from "./components/ui/switch";

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
  tideHeights: number[];
  utcOffsetSeconds: number;
  windGust?: number;
  windSpeed80m?: number;
  pressure?: number;
  visibility?: number;
  humidity?: number;
  dewPoint?: number;
  uvIndex?: number;
  cloudCover?: number;
  precipitation?: number;
  swellHeight?: number;
  swellPeriod2?: number;
  windWaveHeight?: number;
  windWavePeriod?: number;
  seaTemp?: number;
  sunrise?: string;
  sunset?: string;
}

interface GeoResult {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  admin1?: string;
}

// ─── Tile catalog ─────────────────────────────────────────────────────────────
type TileId =
  | "wave"
  | "wind"
  | "direction"
  | "waterTemp"
  | "airTemp"
  | "period"
  | "tide"
  | "forecast"
  | "windGust"
  | "windSpeed80m"
  | "pressure"
  | "visibility"
  | "humidity"
  | "dewPoint"
  | "uvIndex"
  | "cloudCover"
  | "precipitation"
  | "swellHeight"
  | "swellPeriod2"
  | "windWaveHeight"
  | "windWavePeriod"
  | "seaTemp"
  | "sunrise"
  | "sunset";

const ALL_TILE_IDS: TileId[] = [
  "wave",
  "wind",
  "direction",
  "waterTemp",
  "airTemp",
  "period",
  "tide",
  "forecast",
  "windGust",
  "windSpeed80m",
  "pressure",
  "visibility",
  "humidity",
  "dewPoint",
  "uvIndex",
  "cloudCover",
  "precipitation",
  "swellHeight",
  "swellPeriod2",
  "windWaveHeight",
  "windWavePeriod",
  "seaTemp",
  "sunrise",
  "sunset",
];

// Grouped tile order for the settings picker
type TileGroup = { label: string; ids: TileId[] };
const TILE_GROUPS: TileGroup[] = [
  {
    label: "WATER & WAVES",
    ids: [
      "wave",
      "period",
      "swellHeight",
      "swellPeriod2",
      "windWaveHeight",
      "windWavePeriod",
      "waterTemp",
      "seaTemp",
      "tide",
    ],
  },
  {
    label: "WIND",
    ids: ["wind", "windGust", "windSpeed80m", "direction"],
  },
  {
    label: "WEATHER & ATMOSPHERE",
    ids: [
      "airTemp",
      "pressure",
      "visibility",
      "humidity",
      "dewPoint",
      "uvIndex",
      "cloudCover",
      "precipitation",
      "sunrise",
      "sunset",
    ],
  },
  {
    label: "FORECAST",
    ids: ["forecast"],
  },
];

const TILE_CATALOG: Record<TileId, { label: string; description: string }> = {
  wave: {
    label: "Wave Height",
    description:
      "Significant wave height combining swell and wind chop. Represents the average of the highest third of waves at this location.",
  },
  wind: {
    label: "Wind Speed",
    description:
      "Wind speed at 10 metres above sea level — the standard meteorological measurement height used worldwide.",
  },
  direction: {
    label: "Wind Direction",
    description:
      "The compass direction the wind is blowing FROM. NNW means wind coming from the north-northwest — important for shelter and sail trim.",
  },
  waterTemp: {
    label: "Water Temp",
    description:
      "Apparent temperature accounting for wind chill effect. Useful for assessing on-deck comfort and crew clothing decisions.",
  },
  airTemp: {
    label: "Air Temp",
    description:
      "Air temperature at 2 metres above ground level at the selected location.",
  },
  period: {
    label: "Wave Period",
    description:
      "Dominant wave period in seconds — the time between successive wave crests. Longer periods (10s+) indicate powerful, organised swell from distant storms.",
  },
  tide: {
    label: "Tide Chart",
    description:
      "Hourly tide height for today, plotted against local time at the selected location. Heights referenced to approximate Chart Datum (lowest tide level).",
  },
  forecast: {
    label: "7-Day Forecast",
    description:
      "Daily wave height, wind speed and direction for the coming week. Tap any day to see that day's conditions in detail.",
  },
  windGust: {
    label: "Wind Gusts",
    description:
      "Peak wind speed in short bursts, which can be 30–50% stronger than the average wind. Critical for sail selection, reefing decisions, and safety at sea.",
  },
  windSpeed80m: {
    label: "Wind at 80m",
    description:
      "Wind speed at 80 metres above sea level — much closer to mast height than the standard 10m reading. More relevant for actual sailing performance.",
  },
  pressure: {
    label: "Pressure",
    description:
      "Atmospheric pressure in hectopascals (hPa). A falling barometer warns of approaching bad weather; a rising barometer signals improving conditions.",
  },
  visibility: {
    label: "Visibility",
    description:
      "How far you can see horizontally. Low visibility increases collision risk and complicates navigation — fog or haze can develop quickly at sea.",
  },
  humidity: {
    label: "Humidity",
    description:
      "Relative humidity as a percentage. High humidity combined with cool air can cause coastal fog, heavy dew on deck, and increased corrosion risk.",
  },
  dewPoint: {
    label: "Dew Point",
    description:
      "Temperature at which moisture condenses from the air. When the dew point is close to air temperature, fog or heavy condensation on deck is likely.",
  },
  uvIndex: {
    label: "UV Index",
    description:
      "Solar UV radiation intensity on a 0–11+ scale. Plan sun protection for any exposed passages — UV is especially intense on the water due to reflection.",
  },
  cloudCover: {
    label: "Cloud Cover",
    description:
      "Percentage of sky covered by cloud. Affects solar heating, visibility for celestial navigation, and can indicate changing weather systems.",
  },
  precipitation: {
    label: "Rain Chance",
    description:
      "Probability of precipitation in the current period. Useful for timing passages and planning crew comfort — squalls at sea can reduce visibility rapidly.",
  },
  swellHeight: {
    label: "Swell Height",
    description:
      "Height of pure ocean swell generated by distant storms — more organised and longer-period than locally wind-generated waves. Key for offshore passage planning.",
  },
  swellPeriod2: {
    label: "Swell Period",
    description:
      "Period of pure ocean swell from distant storms. Values above 12 seconds indicate powerful, long-distance swell travelling from far-off weather systems.",
  },
  windWaveHeight: {
    label: "Wind Wave Height",
    description:
      "Height of locally wind-generated waves — short, choppy, and disorganised compared to ocean swell. Often determines comfort rather than danger.",
  },
  windWavePeriod: {
    label: "Wind Wave Period",
    description:
      "Period of locally wind-generated waves. Short periods under 6 seconds produce uncomfortable, steep, breaking sea states that are hard on crew and gear.",
  },
  seaTemp: {
    label: "Sea Temp",
    description:
      "Sea surface temperature. Important for wetsuit selection, estimating hypothermia risk, and man-overboard survival time planning.",
  },
  sunrise: {
    label: "Sunrise",
    description:
      "Time of sunrise at the selected location in local time. Essential for watch scheduling, passage timing, and arrival/departure planning.",
  },
  sunset: {
    label: "Sunset",
    description:
      "Time of sunset at the selected location in local time. Plan to reach your harbour or anchorage before darkness — night approaches can be hazardous in unfamiliar waters.",
  },
};

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
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

function fullDayName(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
const PRESETS_KEY = "swell_presets";
const UNITS_KEY = "swell_units";
const DRAG_KEY = "swell_drag_enabled";
const LAST_SPOT_KEY = "swell_last_spot";

type HeightUnit = "ft" | "m";
type TempUnit = "F" | "C";
type SpeedUnit = "kts" | "mph" | "km/h";
type PressureUnit = "hPa" | "inHg" | "mmHg";
type DistanceUnit = "Nm" | "Miles" | "Km";

interface UnitSettings {
  height: HeightUnit;
  temp: TempUnit;
  speed: SpeedUnit;
  pressure: PressureUnit;
  distance: DistanceUnit;
}

const DEFAULT_UNITS: UnitSettings = {
  height: "ft",
  temp: "F",
  speed: "kts",
  pressure: "hPa",
  distance: "Nm",
};

function loadUnits(): UnitSettings {
  try {
    const raw = localStorage.getItem(UNITS_KEY);
    if (!raw) return DEFAULT_UNITS;
    const parsed = JSON.parse(raw);
    return {
      height: parsed.height ?? DEFAULT_UNITS.height,
      temp: parsed.temp ?? DEFAULT_UNITS.temp,
      speed: parsed.speed ?? DEFAULT_UNITS.speed,
      pressure: parsed.pressure ?? DEFAULT_UNITS.pressure,
      distance: parsed.distance ?? DEFAULT_UNITS.distance,
    } as UnitSettings;
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

function loadDragEnabled(): boolean {
  try {
    const raw = localStorage.getItem(DRAG_KEY);
    if (raw === null) return true;
    return JSON.parse(raw) !== false;
  } catch {
    return true;
  }
}

function saveDragEnabled(v: boolean): void {
  try {
    localStorage.setItem(DRAG_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

function loadLastSpot(): Spot | null {
  try {
    const raw = localStorage.getItem(LAST_SPOT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (
      s &&
      typeof s.name === "string" &&
      typeof s.lat === "number" &&
      typeof s.lng === "number"
    ) {
      return s as Spot;
    }
    return null;
  } catch {
    return null;
  }
}

function saveLastSpot(spot: Spot | null): void {
  try {
    if (spot) {
      localStorage.setItem(LAST_SPOT_KEY, JSON.stringify(spot));
    } else {
      localStorage.removeItem(LAST_SPOT_KEY);
    }
  } catch {
    /* ignore */
  }
}

const TILE_ORDER_KEY = "swell_tile_order";

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
      parsed.every((id: string) => ALL_TILE_IDS.includes(id as TileId))
    ) {
      const migrated = [...parsed] as TileId[];
      if (!migrated.includes("tide")) migrated.push("tide");
      if (!migrated.includes("forecast")) migrated.push("forecast");
      if (!migrated.includes("period")) {
        const afterAirTemp = migrated.indexOf("airTemp");
        const afterWind = migrated.indexOf("wind");
        const insertAt =
          afterAirTemp !== -1
            ? afterAirTemp + 1
            : afterWind !== -1
              ? afterWind + 1
              : migrated.indexOf("tide");
        migrated.splice(insertAt, 0, "period");
      }
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
function hPaToInHg(hpa: number): number {
  return hpa * 0.02953;
}
function hPaToMmHg(hpa: number): number {
  return hpa * 0.750064;
}
// Visibility: API returns meters
function metersToNm(m: number): number {
  return m / 1852;
}
function metersToMiles(m: number): number {
  return m / 1609.344;
}
function metersToKm(m: number): number {
  return m / 1000;
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

// ─── useSortable hook ─────────────────────────────────────────────────────────
function useSortable<T>(
  items: T[],
  onReorder: (newItems: T[]) => void,
  containerRef: React.RefObject<HTMLElement | null>,
  enabled = true,
) {
  const dragIndexRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const getHandlers = useCallback(
    (index: number) => {
      if (!enabled) return {};
      return {
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
      };
    },
    [items, onReorder, overIndex, containerRef, enabled],
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
async function fetchConditions(
  spot: Spot,
  signal?: AbortSignal,
): Promise<ConditionsData> {
  const { lat, lng } = spot;
  const tz =
    spot.timezone === "auto" ? "auto" : encodeURIComponent(spot.timezone);
  const [marineRes, weatherRes] = await Promise.all([
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_direction,wave_period,swell_wave_period,swell_wave_height,wind_wave_height,wind_wave_period,sea_surface_temperature,sea_level_height_msl&daily=wave_height_max,wave_direction_dominant,swell_wave_period_max&timezone=${tz}&past_days=16&forecast_days=16`,
      { signal },
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=windspeed_10m,winddirection_10m,apparent_temperature,temperature_2m,windgusts_10m,windspeed_80m,surface_pressure,visibility,relative_humidity_2m,dew_point_2m,uv_index,cloud_cover,precipitation_probability&daily=windspeed_10m_max,sunrise,sunset&current_weather=true&timezone=${tz}`,
      { signal },
    ),
  ]);
  const [marine, weather] = await Promise.all([
    marineRes.json(),
    weatherRes.json(),
  ]);

  const utcOffsetSeconds: number = marine.utc_offset_seconds ?? 0;
  const nowLocalMs = Date.now() + utcOffsetSeconds * 1000;
  const nowLocal = new Date(nowLocalMs);
  const currentHourStr = `${nowLocal.getUTCFullYear()}-${String(nowLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(nowLocal.getUTCDate()).padStart(2, "0")}T${String(nowLocal.getUTCHours()).padStart(2, "0")}:00`;

  const hourlyTimes: string[] = marine.hourly?.time ?? [];
  let hi = hourlyTimes.findIndex((t: string) => t === currentHourStr);
  if (hi < 0) {
    hi = hourlyTimes.reduce((best: number, t: string, idx: number) => {
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
    wi = wHourlyTimes.reduce((best: number, t: string, idx: number) => {
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

  const windGust: number | undefined = weather.hourly?.windgusts_10m?.[wi];
  const windSpeed80m: number | undefined = weather.hourly?.windspeed_80m?.[wi];
  const pressure: number | undefined = weather.hourly?.surface_pressure?.[wi];
  const visibility: number | undefined = weather.hourly?.visibility?.[wi];
  const humidity: number | undefined =
    weather.hourly?.relative_humidity_2m?.[wi];
  const dewPoint: number | undefined = weather.hourly?.dew_point_2m?.[wi];
  const uvIndex: number | undefined = weather.hourly?.uv_index?.[wi];
  const cloudCover: number | undefined = weather.hourly?.cloud_cover?.[wi];
  const precipitation: number | undefined =
    weather.hourly?.precipitation_probability?.[wi];
  const swellHeight: number | undefined =
    marine.hourly?.swell_wave_height?.[hi];
  const swellPeriod2: number | undefined =
    marine.hourly?.swell_wave_period?.[hi];
  const windWaveHeight: number | undefined =
    marine.hourly?.wind_wave_height?.[hi];
  const windWavePeriod: number | undefined =
    marine.hourly?.wind_wave_period?.[hi];
  const seaTemp: number | undefined =
    marine.hourly?.sea_surface_temperature?.[hi];

  function formatTimeStr(isoStr: string | undefined): string | undefined {
    if (!isoStr) return undefined;
    try {
      const d = new Date(isoStr);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return undefined;
    }
  }
  const sunrise = formatTimeStr(weather.daily?.sunrise?.[0]);
  const sunset = formatTimeStr(weather.daily?.sunset?.[0]);

  const allTideHeights: (number | null)[] =
    marine.hourly?.sea_level_height_msl ?? [];
  const marineHourlyTimes: string[] = marine.hourly?.time ?? [];
  const todayDateStr = `${nowLocal.getUTCFullYear()}-${String(nowLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(nowLocal.getUTCDate()).padStart(2, "0")}`;
  const todayStartIdx = marineHourlyTimes.findIndex((t: string) =>
    t.startsWith(todayDateStr),
  );
  const rawTide =
    todayStartIdx >= 0
      ? (allTideHeights.slice(todayStartIdx, todayStartIdx + 24) as number[])
      : Array(24).fill(null);
  const rawTideFilled: number[] = rawTide.map((v, i, arr) => {
    if (v !== null && v !== undefined) return v as number;
    let lo = i - 1;
    let hi2 = i + 1;
    while (lo >= 0 && (arr[lo] === null || arr[lo] === undefined)) lo--;
    while (hi2 < arr.length && (arr[hi2] === null || arr[hi2] === undefined))
      hi2++;
    const loVal = lo >= 0 ? arr[lo] : null;
    const hiVal = hi2 < arr.length ? arr[hi2] : null;
    if (loVal !== null && hiVal !== null)
      return ((loVal as number) + (hiVal as number)) / 2;
    if (loVal !== null) return loVal as number;
    if (hiVal !== null) return hiVal as number;
    return 0;
  });
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
    windGust,
    windSpeed80m,
    pressure,
    visibility,
    humidity,
    dewPoint,
    uvIndex,
    cloudCover,
    precipitation,
    swellHeight,
    swellPeriod2,
    windWaveHeight,
    windWavePeriod,
    seaTemp,
    sunrise,
    sunset,
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
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to close
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
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
        data-ocid="search.modal"
        aria-label={`Assign spot to Preset ${slotIndex + 1}`}
      >
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
              Search any location worldwide
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
            aria-label="Close search"
          >
            <X size={14} />
          </button>
        </div>
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
              placeholder="Search any location…"
              className="flex-1 bg-transparent outline-none font-body text-sm text-white placeholder:opacity-40"
              aria-label="Search for a location"
            />
            {searching && (
              <div
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{
                  borderColor: "var(--color-electric)",
                  borderTopColor: "transparent",
                }}
              />
            )}
          </div>
        </div>
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
            >
              ✕ &nbsp;Clear "{currentSlot.name}" from this preset
            </button>
          </div>
        )}
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
            >
              No locations found for "{query}"
            </div>
          )}
          {results.length === 0 && !query.trim() && (
            <div
              className="px-6 py-6 text-center font-body text-xs"
              style={{ color: "var(--color-seafoam)", opacity: 0.4 }}
            >
              Start typing to search locations worldwide
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
  dragEnabled,
}: {
  presets: PresetSlots;
  setPresets: (presets: PresetSlots) => void;
  selectedSpot: Spot | null;
  loadSpot: (spot: Spot) => void;
  dragEnabled: boolean;
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
  } = useSortable(presets, setPresets, presetBarRef, dragEnabled);

  return (
    <>
      <fieldset className="border-0 p-0 m-0 w-full">
        <legend className="sr-only">Preset locations</legend>
        <div ref={presetBarRef} className="flex flex-col gap-2 w-full">
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
                  className="w-full"
                  style={{
                    borderRadius: 9999,
                    transition: "outline 0.15s ease",
                    outline:
                      overPresetIndex === i && activePresetIndex !== i
                        ? "2px solid var(--color-electric)"
                        : "none",
                    outlineOffset: "2px",
                    touchAction: dragEnabled ? "none" : "auto",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setModalSlot(i)}
                    data-ocid={`preset.item.${i + 1}`}
                    className="group w-full flex items-center gap-3 rounded-full px-4 font-body text-sm font-medium transition-all duration-200 active:scale-[0.98]"
                    style={{
                      minHeight: 52,
                      background: isDragTarget
                        ? "rgba(0,180,216,0.12)"
                        : "rgba(13,79,110,0.12)",
                      border: isDragTarget
                        ? "1px dashed var(--color-electric)"
                        : "1px dashed rgba(0,180,216,0.25)",
                      color: isDragTarget
                        ? "var(--color-electric)"
                        : "rgba(168,216,200,0.5)",
                    }}
                    aria-label={`Set Preset ${i + 1}`}
                  >
                    <span
                      className="flex-shrink-0"
                      style={{ color: "rgba(168,216,200,0.2)", width: 16 }}
                      aria-hidden="true"
                    >
                      <GripVertical size={16} />
                    </span>
                    <Plus
                      size={13}
                      className="flex-shrink-0 transition-transform group-hover:rotate-90"
                      style={{
                        color: "var(--color-electric)",
                        opacity: isDragTarget ? 1 : 0.45,
                      }}
                    />
                    <span className="flex-1 text-left">+ Add spot</span>
                  </button>
                </div>
              );
            }
            return (
              <div
                key={`slot-filled-${i + 1}`}
                className="relative w-full flex items-center"
                {...getPresetHandlers(i)}
                style={{
                  opacity: isDraggingThis ? 0.45 : 1,
                  transition: "opacity 0.15s ease, outline 0.15s ease",
                  borderRadius: 9999,
                  cursor: dragEnabled
                    ? isDraggingThis
                      ? "grabbing"
                      : "grab"
                    : "default",
                  outline:
                    isDragTarget && !isDraggingThis
                      ? "2px solid var(--color-electric)"
                      : "none",
                  outlineOffset: "2px",
                  touchAction: dragEnabled ? "none" : "auto",
                }}
              >
                <button
                  type="button"
                  onClick={() => loadSpot(spot)}
                  data-ocid={`preset.item.${i + 1}`}
                  className="w-full flex items-center gap-3 rounded-full px-4 font-body text-sm font-medium transition-all duration-200 active:scale-[0.98]"
                  style={{
                    minHeight: 52,
                    background: isSelected
                      ? "rgba(0,180,216,0.18)"
                      : "rgba(13,79,110,0.25)",
                    border: `1px solid ${isSelected ? "rgba(0,180,216,0.7)" : "rgba(0,180,216,0.22)"}`,
                    color: isSelected
                      ? "var(--color-electric)"
                      : "rgba(255,255,255,0.85)",
                    fontWeight: isSelected ? 700 : 500,
                    userSelect: "none",
                  }}
                  aria-label={`Load ${spot.name}`}
                  aria-pressed={isSelected}
                >
                  <span
                    className="flex-shrink-0"
                    style={{
                      color: isSelected
                        ? "rgba(0,180,216,0.5)"
                        : "rgba(168,216,200,0.35)",
                      width: 16,
                    }}
                    aria-hidden="true"
                  >
                    <GripVertical size={16} />
                  </span>
                  <span className="flex-1 text-left truncate">{spot.name}</span>
                  {isSelected && (
                    <span
                      className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--color-electric)" }}
                      aria-hidden="true"
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalSlot(i);
                  }}
                  data-ocid={`preset.edit_button.${i + 1}`}
                  className="absolute right-3 w-7 h-7 rounded-full flex items-center justify-center transition-opacity"
                  style={{
                    background: isSelected
                      ? "rgba(0,180,216,0.15)"
                      : "rgba(13,79,110,0.5)",
                    color: isSelected
                      ? "var(--color-electric)"
                      : "var(--color-seafoam)",
                    opacity: 0.85,
                  }}
                  aria-label={`Edit Preset ${i + 1}`}
                >
                  <Pencil size={11} />
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
const StatCard = memo(function StatCard({
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
});

const TimeCard = memo(function TimeCard({
  label,
  value,
  icon,
}: { label: string; value: string; icon: React.ReactNode }) {
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
          {value}
        </span>
      </div>
    </div>
  );
});

const CompassCard = memo(function CompassCard({
  degrees,
}: { degrees: number }) {
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
          <Wind size={14} />
        </span>
        <span
          className="text-xs font-body tracking-widest uppercase"
          style={{ color: "var(--color-seafoam)", opacity: 0.8 }}
        >
          WIND DIRECTION
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
});

const ForecastCard = memo(function ForecastCard({
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
  isSelected,
  onClick,
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
  isSelected: boolean;
  onClick: () => void;
}) {
  const maxBar = 3.5;
  const barH = Math.min((waveMax / maxBar) * 60, 60);
  const compassDir = degreesToCompass(waveDir);
  return (
    <button
      type="button"
      onClick={onClick}
      className="forecast-card flex flex-col items-center gap-2 rounded-xl px-2 py-5 w-full transition-all duration-200"
      style={{
        animationDelay: `${index * 50}ms`,
        background: isSelected
          ? "rgba(0,180,216,0.18)"
          : "rgba(13,79,110,0.25)",
        border: isSelected
          ? "2px solid var(--color-electric)"
          : "1px solid rgba(13,79,110,0.5)",
        boxShadow: isSelected ? "0 0 16px rgba(0,180,216,0.35)" : "none",
        cursor: "pointer",
      }}
      data-ocid={`forecast.item.${index + 1}`}
    >
      <span
        className="font-body text-sm tracking-widest font-semibold"
        style={{
          color: isSelected ? "var(--color-electric)" : "var(--color-seafoam)",
        }}
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
    </button>
  );
});

// ─── TideChart with cosine interpolation ──────────────────────────────────────
function buildCosineTidePath(
  tideHeights: number[],
  W: number,
  H: number,
): {
  pathD: string;
  tideMax: number;
  tideMin: number;
  toSVGY: (v: number) => number;
} {
  const validHeights = tideHeights.filter(
    (v) => typeof v === "number" && Number.isFinite(v),
  );
  const hasRealData = validHeights.length >= 4;

  const points: { x: number; y: number }[] = [];
  if (hasRealData) {
    for (let i = 0; i < Math.min(tideHeights.length, 24); i++) {
      const v = tideHeights[i];
      points.push({
        x: i / 23,
        y: typeof v === "number" && Number.isFinite(v) ? v : 0,
      });
    }
  } else {
    for (let i = 0; i <= 23; i++) {
      points.push({
        x: i / 23,
        y: 1.5 + 1.2 * Math.sin((2 * Math.PI * i) / 12.42),
      });
    }
  }

  const tideYValues = points.map((p) => p.y);
  const tideMax = Math.max(...tideYValues);
  const tideMin = Math.min(...tideYValues);
  const yRange = tideMax - tideMin || 1;
  const yPad = yRange * 0.15;
  const yLo = tideMin - yPad;
  const yHi = tideMax + yPad;
  const toSVGY = (v: number) =>
    H - ((v - yLo) / (yHi - yLo)) * (H * 0.8) - H * 0.1;

  // Find local extrema indices
  const extrema: number[] = [0];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].y;
    const cur = points[i].y;
    const next = points[i + 1].y;
    if ((cur >= prev && cur >= next) || (cur <= prev && cur <= next)) {
      // Only add if meaningfully different from last extremum
      const lastExt = extrema[extrema.length - 1];
      if (Math.abs(cur - points[lastExt].y) > yRange * 0.05) {
        extrema.push(i);
      }
    }
  }
  extrema.push(points.length - 1);

  // Build path using cosine interpolation between extrema
  const svgExtrema = extrema.map((idx) => ({
    x: points[idx].x * W,
    y: toSVGY(points[idx].y),
    idx,
  }));

  let pathD = `M ${svgExtrema[0].x} ${svgExtrema[0].y}`;
  for (let i = 1; i < svgExtrema.length; i++) {
    const x0 = svgExtrema[i - 1].x;
    const y0 = svgExtrema[i - 1].y;
    const x1 = svgExtrema[i].x;
    const y1 = svgExtrema[i].y;
    // Half-cosine control points: vertical tangents at each extremum
    const cpx0 = x0 + (x1 - x0) * 0.5;
    const cpx1 = x1 - (x1 - x0) * 0.5;
    pathD += ` C ${cpx0} ${y0}, ${cpx1} ${y1}, ${x1} ${y1}`;
  }

  return { pathD, tideMax, tideMin, toSVGY };
}

const TideChart = memo(function TideChart({
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

  const { pathD, tideMax, tideMin, toSVGY } = useMemo(
    () => buildCosineTidePath(tideHeights, W, H),
    [tideHeights],
  );

  const nowUtcMs = Date.now();
  const localMs = nowUtcMs + utcOffsetSeconds * 1000;
  const localDate = new Date(localMs);
  const localHour = localDate.getUTCHours();
  const localMin = localDate.getUTCMinutes();
  const currentHourFrac = (localHour + localMin / 60) / 24;
  const currentX = currentHourFrac * W;

  const timeLabels = [0, 6, 12, 18, 24].map(
    (h) => `${String(h % 24).padStart(2, "0")}:00`,
  );

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

  const currentTideRaw = useMemo(() => {
    const validHeights = tideHeights.filter(
      (v) => typeof v === "number" && Number.isFinite(v),
    );
    if (validHeights.length < 4 || tideHeights.length < 2) return null;
    const h = Math.floor(localHour + localMin / 60);
    const frac = localMin / 60;
    const v0 = tideHeights[Math.min(h, tideHeights.length - 1)];
    const v1 = tideHeights[Math.min(h + 1, tideHeights.length - 1)];
    if (typeof v0 !== "number" || typeof v1 !== "number") return null;
    return v0 + (v1 - v0) * frac;
  }, [tideHeights, localHour, localMin]);

  return (
    <div
      className="w-full overflow-hidden rounded-xl"
      style={{
        border: "1px solid rgba(13,79,110,0.5)",
        background: "rgba(2,13,24,0.8)",
      }}
    >
      <div className="px-6 pt-5 pb-2 flex items-center justify-between">
        <h3
          className="font-body text-xs tracking-widest uppercase font-semibold"
          style={{ color: "var(--color-seafoam)", opacity: 0.8 }}
        >
          Tide Chart — Today
        </h3>
        {currentTideRaw !== null && (
          <div className="flex items-baseline gap-1">
            <span
              className="font-body text-xs tracking-widest uppercase font-semibold"
              style={{ color: "var(--color-seafoam)", opacity: 0.8 }}
            >
              Current Height:
            </span>
            <span
              className="font-body text-sm font-extrabold tracking-wide"
              style={{ color: "#FFE033" }}
            >
              {displayHeight(currentTideRaw).toFixed(1)}
              {heightLabel}
            </span>
          </div>
        )}
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
          <line
            x1={currentX}
            y1={0}
            x2={currentX}
            y2={H}
            stroke="#FFE033"
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.9}
          />
          <circle cx={currentX} cy={4} r={4} fill="#FFE033" opacity={0.9} />
          {timeLabels.map((label, i) => (
            <text
              key={label}
              x={(i / 4) * W}
              y={H + 25}
              fill="rgba(168,216,200,1)"
              fontSize={15}
              fontFamily="General Sans, sans-serif"
              textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
            >
              {label}
            </text>
          ))}
          {[
            { value: tideMax, y: toSVGY(tideMax), prefix: "Hi" },
            { value: tideMin, y: toSVGY(tideMin), prefix: "Lo" },
          ].map(({ value, y, prefix }) => {
            const label = `${prefix}: ${displayHeight(value).toFixed(1)}${heightLabel}`;
            const labelW = label.length * 11;
            return (
              <g key={`${prefix}-${value}`}>
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
                  fill="#FFE033"
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
});

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

// ─── Spot Header ──────────────────────────────────────────────────────────────
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
  const [units, setUnitsState] = useState<UnitSettings>(loadUnits);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragEnabled, setDragEnabledState] = useState<boolean>(() =>
    loadDragEnabled(),
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [minTileWarning, setMinTileWarning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const setDragEnabled = useCallback((v: boolean) => {
    setDragEnabledState(v);
    saveDragEnabled(v);
  }, []);

  const setUnits = useCallback((next: UnitSettings) => {
    setUnitsState(next);
    saveUnits(next);
  }, []);

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
  } = useSortable(tileOrder, setTileOrder, conditionGridRef, dragEnabled);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    savePresets(presets);
  }, [presets]);
  const setPresets = useCallback((next: PresetSlots) => {
    setPresetsState(next);
  }, []);

  const loadSpot = useCallback(async (spot: Spot) => {
    // Abort any in-flight fetch
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSelectedSpot(spot);
    saveLastSpot(spot);
    setLoading(true);
    setError(null);
    setData(null);
    setSelectedDay(null);
    try {
      const result = await fetchConditions(spot, controller.signal);
      setData(result);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("Failed to load conditions. Please try again.");
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore last spot silently on mount
  useEffect(() => {
    const last = loadLastSpot();
    if (last) loadSpot(last);
  }, [loadSpot]);

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
          const spot: Spot = { name, country, lat, lng: lon, timezone: "auto" };
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

  // Unit conversion callbacks
  const displayHeight = useCallback(
    (m: number) => (units.height === "ft" ? metresToFeet(m) : m),
    [units.height],
  );
  const heightLabel = units.height === "ft" ? "ft" : "m";
  const displayTemp = useCallback(
    (c: number) => (units.temp === "F" ? celsiusToFahrenheit(c) : c),
    [units.temp],
  );
  const tempLabel = units.temp === "F" ? "°F" : "°C";
  const displaySpeed = useCallback(
    (k: number) =>
      units.speed === "kts"
        ? kmhToKnots(k)
        : units.speed === "mph"
          ? kmhToMph(k)
          : k,
    [units.speed],
  );
  const speedLabel = units.speed;

  const displayPressure = useCallback(
    (hpa: number) =>
      units.pressure === "inHg"
        ? hPaToInHg(hpa)
        : units.pressure === "mmHg"
          ? hPaToMmHg(hpa)
          : hpa,
    [units.pressure],
  );
  const pressureLabel = units.pressure;
  const pressureDecimals = units.pressure === "hPa" ? 0 : 2;

  const displayDistance = useCallback(
    (meters: number) =>
      units.distance === "Nm"
        ? metersToNm(meters)
        : units.distance === "Miles"
          ? metersToMiles(meters)
          : metersToKm(meters),
    [units.distance],
  );
  const distanceLabel =
    units.distance === "Nm" ? "Nm" : units.distance === "Miles" ? "mi" : "km";

  const overallRating: "good" | "average" | "poor" = useMemo(() => {
    if (!data) return "average";
    return waveStatus(data.waveHeight) === "good" &&
      windStatus(data.windSpeed) === "good"
      ? "good"
      : waveStatus(data.waveHeight) === "poor" ||
          windStatus(data.windSpeed) === "poor"
        ? "poor"
        : "average";
  }, [data]);

  // Tile picker toggle
  const toggleTile = useCallback((id: TileId) => {
    setTileOrderState((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) {
          setMinTileWarning(true);
          setTimeout(() => setMinTileWarning(false), 2500);
          return prev;
        }
        const next = prev.filter((t) => t !== id);
        saveTileOrder(next);
        return next;
      }
      const next = [...prev, id];
      saveTileOrder(next);
      return next;
    });
  }, []);

  // Selected day helpers
  const getDayIndex = useCallback(
    (dateStr: string | null): number => {
      if (!dateStr || !data) return 0;
      const idx = data.dailyDates.indexOf(dateStr);
      return idx >= 0 ? idx : 0;
    },
    [data],
  );

  const effective = useMemo(() => {
    if (!data) return null;
    if (!selectedDay)
      return {
        waveHeight: data.waveHeight,
        windSpeed: data.windSpeed,
        windDirection: data.windDirection,
        swellPeriod: data.swellPeriod,
        isLive: true,
      };
    const di = getDayIndex(selectedDay);
    return {
      waveHeight: data.dailyWaveMax[di] ?? data.waveHeight,
      windSpeed: data.dailyWindSpeed[di] ?? data.windSpeed,
      windDirection: data.dailyWaveDir[di] ?? data.windDirection,
      swellPeriod: data.dailySwellPeriod[di] ?? data.swellPeriod,
      isLive: false,
    };
  }, [data, selectedDay, getDayIndex]);

  const sectionTitle = selectedDay
    ? `${fullDayName(selectedDay)}'S CONDITIONS`
    : "TODAY'S CONDITIONS";

  // Render a single condition tile
  const renderTile = useCallback(
    (tileId: TileId) => {
      if (!data || !effective) return null;
      const isSelectedDayMode = !!selectedDay;
      switch (tileId) {
        case "wave":
          return (
            <StatCard
              label="Wave Height"
              value={displayHeight(effective.waveHeight)}
              unit={heightLabel}
              status={waveStatus(effective.waveHeight)}
              icon={<Waves size={14} />}
              decimals={1}
            />
          );
        case "wind":
          return (
            <StatCard
              label="Wind Speed"
              value={displaySpeed(effective.windSpeed)}
              unit={speedLabel}
              status={windStatus(effective.windSpeed)}
              icon={<Wind size={14} />}
              decimals={1}
            />
          );
        case "direction":
          return <CompassCard degrees={effective.windDirection} />;
        case "waterTemp":
          return (
            <StatCard
              label={isSelectedDayMode ? "Water Temp (now)" : "Water Temp"}
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
              label={isSelectedDayMode ? "Air Temp (now)" : "Air Temp"}
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
              label="WAVE PERIOD"
              value={effective.swellPeriod}
              unit="s"
              status="good"
              icon={<Waves size={14} />}
              decimals={0}
            />
          );
        case "tide":
          if (isSelectedDayMode) {
            return (
              <div
                className="w-full overflow-hidden rounded-xl flex items-center justify-center"
                style={{
                  border: "1px solid rgba(13,79,110,0.5)",
                  background: "rgba(2,13,24,0.8)",
                  minHeight: 120,
                }}
              >
                <p
                  className="font-body text-sm text-center px-6 py-8"
                  style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                >
                  Tide chart is only available for today
                </p>
              </div>
            );
          }
          return (
            <TideChart
              tideHeights={data.tideHeights}
              utcOffsetSeconds={data.utcOffsetSeconds}
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
                  style={{ color: "var(--color-seafoam)", opacity: 0.8 }}
                >
                  7-Day Forecast
                </h3>
              </div>
              <div className="px-4 pb-4 overflow-x-auto no-scrollbar">
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: "repeat(7, minmax(90px, 1fr))",
                    minWidth: "min-content",
                  }}
                >
                  {(() => {
                    const nowLocalMs =
                      Date.now() + (data.utcOffsetSeconds ?? 0) * 1000;
                    const nowLocal = new Date(nowLocalMs);
                    const todayStr = `${nowLocal.getUTCFullYear()}-${String(nowLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(nowLocal.getUTCDate()).padStart(2, "0")}`;
                    const todayIdx = Math.max(
                      0,
                      data.dailyDates.findIndex((d) => d === todayStr),
                    );
                    return data.dailyDates
                      .slice(todayIdx, todayIdx + 7)
                      .map((date, j) => {
                        const i = todayIdx + j;
                        const isToday = date === todayStr;
                        return (
                          <ForecastCard
                            key={date}
                            date={date}
                            waveMax={data.dailyWaveMax[i] ?? 1}
                            waveDir={data.dailyWaveDir[i] ?? 270}
                            windSpeed={data.dailyWindSpeed[i] ?? 15}
                            swellPeriod={data.dailySwellPeriod[i] ?? 0}
                            index={j}
                            displayHeight={displayHeight}
                            heightLabel={heightLabel}
                            displaySpeed={displaySpeed}
                            speedLabel={speedLabel}
                            isSelected={
                              isToday ? !selectedDay : selectedDay === date
                            }
                            onClick={() => {
                              if (isToday) setSelectedDay(null);
                              else setSelectedDay(date);
                            }}
                          />
                        );
                      });
                  })()}
                </div>
              </div>
            </div>
          );
        case "windGust":
          return data.windGust !== undefined ? (
            <StatCard
              label="Wind Gusts"
              value={displaySpeed(data.windGust)}
              unit={speedLabel}
              status={windStatus(data.windGust)}
              icon={<Zap size={14} />}
              decimals={1}
            />
          ) : null;
        case "windSpeed80m":
          return data.windSpeed80m !== undefined ? (
            <StatCard
              label="Wind at 80m"
              value={displaySpeed(data.windSpeed80m)}
              unit={speedLabel}
              status={windStatus(data.windSpeed80m)}
              icon={<Wind size={14} />}
              decimals={1}
            />
          ) : null;
        case "pressure":
          return data.pressure !== undefined ? (
            <StatCard
              label="Pressure"
              value={displayPressure(data.pressure)}
              unit={pressureLabel}
              status="average"
              icon={<Gauge size={14} />}
              decimals={pressureDecimals}
            />
          ) : null;
        case "visibility":
          return data.visibility !== undefined ? (
            <StatCard
              label="Visibility"
              value={displayDistance(data.visibility)}
              unit={distanceLabel}
              status="good"
              icon={<Eye size={14} />}
              decimals={1}
            />
          ) : null;
        case "humidity":
          return data.humidity !== undefined ? (
            <StatCard
              label="Humidity"
              value={data.humidity}
              unit="%"
              status="average"
              icon={<Droplets size={14} />}
              decimals={0}
            />
          ) : null;
        case "dewPoint":
          return data.dewPoint !== undefined ? (
            <StatCard
              label="Dew Point"
              value={displayTemp(data.dewPoint)}
              unit={tempLabel}
              status={tempStatus(data.dewPoint)}
              icon={<Droplets size={14} />}
              decimals={0}
            />
          ) : null;
        case "uvIndex":
          return data.uvIndex !== undefined ? (
            <StatCard
              label="UV Index"
              value={data.uvIndex}
              unit=""
              status={
                data.uvIndex > 7
                  ? "poor"
                  : data.uvIndex > 3
                    ? "average"
                    : "good"
              }
              icon={<Sun size={14} />}
              decimals={0}
            />
          ) : null;
        case "cloudCover":
          return data.cloudCover !== undefined ? (
            <StatCard
              label="Cloud Cover"
              value={data.cloudCover}
              unit="%"
              status="average"
              icon={<Cloud size={14} />}
              decimals={0}
            />
          ) : null;
        case "precipitation":
          return data.precipitation !== undefined ? (
            <StatCard
              label="Rain Chance"
              value={data.precipitation}
              unit="%"
              status={
                data.precipitation > 70
                  ? "poor"
                  : data.precipitation > 30
                    ? "average"
                    : "good"
              }
              icon={<Droplets size={14} />}
              decimals={0}
            />
          ) : null;
        case "swellHeight":
          return data.swellHeight !== undefined ? (
            <StatCard
              label="Swell Height"
              value={displayHeight(data.swellHeight)}
              unit={heightLabel}
              status={waveStatus(data.swellHeight)}
              icon={<Waves size={14} />}
              decimals={1}
            />
          ) : null;
        case "swellPeriod2":
          return data.swellPeriod2 !== undefined ? (
            <StatCard
              label="Swell Period"
              value={data.swellPeriod2}
              unit="s"
              status="good"
              icon={<Waves size={14} />}
              decimals={0}
            />
          ) : null;
        case "windWaveHeight":
          return data.windWaveHeight !== undefined ? (
            <StatCard
              label="Wind Wave Ht"
              value={displayHeight(data.windWaveHeight)}
              unit={heightLabel}
              status={waveStatus(data.windWaveHeight)}
              icon={<Waves size={14} />}
              decimals={1}
            />
          ) : null;
        case "windWavePeriod":
          return data.windWavePeriod !== undefined ? (
            <StatCard
              label="Wind Wave Per"
              value={data.windWavePeriod}
              unit="s"
              status="average"
              icon={<Waves size={14} />}
              decimals={0}
            />
          ) : null;
        case "seaTemp":
          return data.seaTemp !== undefined ? (
            <StatCard
              label="Sea Temp"
              value={displayTemp(data.seaTemp)}
              unit={tempLabel}
              status={tempStatus(data.seaTemp)}
              icon={<Thermometer size={14} />}
              decimals={0}
            />
          ) : null;
        case "sunrise":
          return data.sunrise ? (
            <TimeCard
              label="Sunrise"
              value={data.sunrise}
              icon={<Sunrise size={14} />}
            />
          ) : null;
        case "sunset":
          return data.sunset ? (
            <TimeCard
              label="Sunset"
              value={data.sunset}
              icon={<Sunset size={14} />}
            />
          ) : null;
        default:
          return null;
      }
    },
    [
      data,
      effective,
      selectedDay,
      displayHeight,
      heightLabel,
      displayTemp,
      tempLabel,
      displaySpeed,
      speedLabel,
      displayPressure,
      pressureLabel,
      pressureDecimals,
      displayDistance,
      distanceLabel,
    ],
  );

  // Unit selector button style helper
  const unitBtnStyle = (active: boolean) =>
    active
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
        };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{
        background: "var(--color-bg)",
        fontFamily: "'General Sans', sans-serif",
      }}
    >
      <HeroWaveCanvas
        waveHeight={data?.waveHeight ?? 1.2}
        windSpeed={data?.windSpeed ?? 10}
        rating={overallRating}
      />
      <div className="relative flex flex-col flex-1" style={{ zIndex: 1 }}>
        {/* HEADER */}
        <header className="px-6 md:px-12 pt-8 pb-2 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 font-display font-black tracking-[0.15em] text-2xl cursor-pointer bg-transparent border-0 p-0 hover:opacity-80 transition-opacity"
              style={{ color: "var(--color-electric)" }}
              aria-label="Refresh app"
            >
              <img
                src="/assets/generated/swell-icon-wave-transparent.dim_512x512.png"
                alt=""
                className="w-10 h-10 object-contain"
                aria-hidden="true"
              />
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
            className="w-80 border-0 p-0 flex flex-col"
            style={{
              background:
                "linear-gradient(170deg, rgba(13,30,52,0.98) 0%, rgba(2,13,24,0.99) 100%)",
              borderLeft: "1px solid rgba(13,79,110,0.6)",
            }}
            data-ocid="settings.sheet"
          >
            <SheetHeader
              className="px-6 pt-6 pb-4 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(13,79,110,0.3)" }}
            >
              <SheetTitle className="font-display font-bold text-white flex items-center gap-2">
                <Settings
                  size={16}
                  style={{ color: "var(--color-electric)" }}
                />
                Settings
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
              {/* Drag to Reorder toggle */}
              <div className="space-y-3">
                <p
                  className="font-body text-xs tracking-widest uppercase font-semibold"
                  style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                >
                  Drag to Reorder
                </p>
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(13,79,110,0.2)",
                    border: "1px solid rgba(13,79,110,0.4)",
                  }}
                >
                  <div>
                    <p className="font-body text-sm text-white font-medium">
                      Enable drag reordering
                    </p>
                    <p
                      className="font-body text-xs mt-0.5"
                      style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                    >
                      Applies to tiles and saved spots
                    </p>
                  </div>
                  <Switch
                    checked={dragEnabled}
                    onCheckedChange={setDragEnabled}
                    aria-label="Toggle drag to reorder"
                  />
                </div>
              </div>

              <hr style={{ borderColor: "rgba(13,79,110,0.3)" }} />

              {/* Saved Locations */}
              <div className="space-y-3">
                <p
                  className="font-body text-xs tracking-widest uppercase font-semibold"
                  style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                >
                  Your Saved Locations
                </p>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  data-ocid="location.button"
                  className="w-full flex items-center gap-3 rounded-full px-4 font-body text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                  style={{
                    minHeight: 52,
                    background: locating
                      ? "rgba(0,180,216,0.08)"
                      : "rgba(0,180,216,0.1)",
                    border: "1px solid rgba(0,180,216,0.45)",
                    color: "var(--color-electric)",
                  }}
                  aria-label="Use my current location"
                >
                  <span
                    className="flex-shrink-0"
                    style={{
                      width: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-hidden="true"
                  >
                    {locating ? (
                      <div
                        className="w-4 h-4 rounded-full border-2 animate-spin"
                        style={{
                          borderColor: "var(--color-electric)",
                          borderTopColor: "transparent",
                        }}
                      />
                    ) : (
                      <LocateFixed size={16} />
                    )}
                  </span>
                  <span className="flex-1 text-left">
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
                <PresetBar
                  presets={presets}
                  setPresets={setPresets}
                  selectedSpot={selectedSpot}
                  dragEnabled={dragEnabled}
                  loadSpot={(spot) => {
                    loadSpot(spot);
                    setSettingsOpen(false);
                  }}
                />
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
                      style={unitBtnStyle(units.height === opt)}
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
                      style={unitBtnStyle(units.temp === opt)}
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
                      style={unitBtnStyle(units.speed === opt)}
                    >
                      {opt === "kts" ? "Knots" : opt === "mph" ? "MPH" : "KM/H"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pressure */}
              <div className="space-y-3">
                <p
                  className="font-body text-xs tracking-widest uppercase font-semibold"
                  style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                >
                  Pressure
                </p>
                <div className="flex gap-2">
                  {(["hPa", "inHg", "mmHg"] as PressureUnit[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setUnits({ ...units, pressure: opt })}
                      className="flex-1 rounded-xl py-3 font-body text-sm font-semibold transition-all duration-200"
                      style={unitBtnStyle(units.pressure === opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Distance */}
              <div className="space-y-3">
                <p
                  className="font-body text-xs tracking-widest uppercase font-semibold"
                  style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                >
                  Distance
                </p>
                <div className="flex gap-2">
                  {(["Nm", "Miles", "Km"] as DistanceUnit[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setUnits({ ...units, distance: opt })}
                      className="flex-1 rounded-xl py-3 font-body text-sm font-semibold transition-all duration-200"
                      style={unitBtnStyle(units.distance === opt)}
                    >
                      {opt === "Nm" ? "Nm" : opt === "Miles" ? "Miles" : "Km"}
                    </button>
                  ))}
                </div>
              </div>

              <hr style={{ borderColor: "rgba(13,79,110,0.3)" }} />

              {/* Available Tiles — grouped */}
              <div className="space-y-4">
                <p
                  className="font-body text-xs tracking-widest uppercase font-semibold"
                  style={{ color: "var(--color-seafoam)", opacity: 0.6 }}
                >
                  Available Tiles
                </p>
                {minTileWarning && (
                  <div
                    className="rounded-xl px-4 py-2 text-xs font-body font-semibold"
                    style={{
                      background: "rgba(255,107,71,0.12)",
                      border: "1px solid rgba(255,107,71,0.4)",
                      color: "var(--color-coral)",
                    }}
                  >
                    Minimum 2 tiles must remain active.
                  </div>
                )}
                {TILE_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p
                      className="font-body text-xs tracking-widest uppercase font-semibold px-1 pb-1"
                      style={{
                        color: "var(--color-electric)",
                        opacity: 0.7,
                        fontSize: "0.65rem",
                      }}
                    >
                      {group.label}
                    </p>
                    {group.ids.map((id) => {
                      const isActive = tileOrder.includes(id);
                      const catalog = TILE_CATALOG[id];
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                          style={{
                            background: "rgba(13,79,110,0.15)",
                            border: "1px solid rgba(13,79,110,0.3)",
                          }}
                        >
                          <span className="flex-1 font-body text-sm text-white truncate">
                            {catalog.label}
                          </span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
                                style={{
                                  background: "rgba(0,180,216,0.12)",
                                  border: "1px solid rgba(0,180,216,0.3)",
                                  color: "var(--color-electric)",
                                }}
                                aria-label={`Info about ${catalog.label}`}
                              >
                                <Info size={11} />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="left"
                              className="w-64 border-0 p-0 rounded-xl"
                              style={{
                                background:
                                  "linear-gradient(145deg, rgba(13,30,52,0.98), rgba(2,13,24,0.99))",
                                border: "1px solid rgba(13,79,110,0.6)",
                                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                              }}
                            >
                              <div className="px-4 py-3">
                                <p
                                  className="font-body font-bold text-sm mb-1"
                                  style={{ color: "var(--color-electric)" }}
                                >
                                  {catalog.label}
                                </p>
                                <p
                                  className="font-body text-xs leading-relaxed"
                                  style={{ color: "rgba(168,216,200,0.85)" }}
                                >
                                  {catalog.description}
                                </p>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => toggleTile(id)}
                            aria-label={`Toggle ${catalog.label} tile`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* HERO — flex layout so search/footer don't overlap on mobile portrait */}
        {!selectedSpot && (
          <section
            className="flex flex-col flex-1 px-6 md:px-12 pt-10"
            data-ocid="hero.section"
          >
            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
              <h1
                className="font-display font-black text-white leading-none mb-8 whitespace-nowrap"
                style={{
                  fontSize: "clamp(0.9rem, 4.5vw, 7rem)",
                  letterSpacing: "-0.02em",
                }}
              >
                Favorite Mother-In-Law's Ocean
              </h1>
              <div className="flex-1" />
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
                <section data-ocid="conditions.section">
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className="font-body text-xs tracking-widest uppercase font-semibold"
                      style={{ color: "var(--color-seafoam)", opacity: 0.7 }}
                    >
                      {sectionTitle}
                    </h3>
                    {selectedDay && (
                      <button
                        type="button"
                        onClick={() => setSelectedDay(null)}
                        className="flex items-center gap-1 rounded-full px-3 py-1.5 font-body text-xs font-semibold transition-all hover:scale-105"
                        style={{
                          background: "rgba(0,180,216,0.12)",
                          border: "1px solid rgba(0,180,216,0.4)",
                          color: "var(--color-electric)",
                        }}
                      >
                        <ArrowLeft size={11} />
                        Today
                      </button>
                    )}
                  </div>
                  <div
                    ref={conditionGridRef}
                    className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4"
                  >
                    {tileOrder.map((tileId, idx) => {
                      const isWide = tileId === "tide" || tileId === "forecast";
                      const tileContent = renderTile(tileId);
                      if (!tileContent) return null;
                      return (
                        <div
                          key={tileId}
                          {...getTileHandlers(idx)}
                          className={isWide ? "col-span-2 md:col-span-5" : ""}
                          style={{
                            cursor: dragEnabled
                              ? activeTileIndex === idx
                                ? "grabbing"
                                : "grab"
                              : "default",
                            opacity: activeTileIndex === idx ? 0.5 : 1,
                            outline:
                              overTileIndex === idx && activeTileIndex !== idx
                                ? "2px solid var(--color-electric)"
                                : "none",
                            outlineOffset: "2px",
                            borderRadius: "12px",
                            transition:
                              "opacity 0.15s ease, outline 0.15s ease",
                            touchAction: dragEnabled ? "none" : "auto",
                          }}
                          data-ocid={`conditions.item.${idx + 1}`}
                        >
                          {tileContent}
                        </div>
                      );
                    })}
                  </div>
                  {dragEnabled && (
                    <p
                      className="text-xs mt-2 text-center"
                      style={{ color: "rgba(168,216,200,0.35)" }}
                    >
                      Drag tiles to reorder
                    </p>
                  )}
                </section>
              )}
            </div>
          </main>
        )}

        {/* SEARCH BAR — always in flow, no absolute positioning */}
        <div className="px-6 md:px-12 pb-6 flex-shrink-0 mt-auto">
          <div className="max-w-7xl mx-auto">
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{
                background: "rgba(13,30,52,0.85)",
                border: "1px solid rgba(13,79,110,0.6)",
                backdropFilter: "blur(12px)",
              }}
            >
              <Search
                size={16}
                style={{
                  color: "var(--color-electric)",
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              />
              <SearchInput
                onSelect={loadSpot}
                onSaveToPreset={(spot) => {
                  const emptyIdx = presets.findIndex((p) => p === null);
                  if (emptyIdx !== -1) {
                    const next = [...presets];
                    next[emptyIdx] = spot;
                    setPresetsState(next);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer
          className="px-6 md:px-12 py-8 flex-shrink-0"
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
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
                className="underline hover:opacity-80"
                style={{ color: "var(--color-electric)" }}
              >
                Caffeine
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── SearchInput ──────────────────────────────────────────────────────────────
function SearchInput({
  onSelect,
  onSaveToPreset,
}: {
  onSelect: (spot: Spot) => void;
  onSaveToPreset: (spot: Spot) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      setOpen(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchSpots(query);
        setResults(found);
        setOpen(found.length > 0);
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
    <div className="relative flex-1">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSavedIdx(null);
        }}
        placeholder="Search any location"
        className="w-full bg-transparent outline-none font-body text-sm text-white placeholder:opacity-40"
        aria-label="Search for a location"
        data-ocid="search.input"
      />
      {searching && (
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
          style={{
            borderColor: "var(--color-electric)",
            borderTopColor: "transparent",
          }}
        />
      )}
      {open && results.length > 0 && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden"
          style={{
            background:
              "linear-gradient(145deg, rgba(13,30,52,0.98), rgba(2,13,24,0.99))",
            border: "1px solid rgba(13,79,110,0.6)",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
            zIndex: 50,
          }}
        >
          {results.slice(0, 6).map((result, i) => (
            <div
              key={`${result.name}-${result.latitude}-${result.longitude}`}
              className="flex items-center gap-2 px-4 py-3 transition-all duration-150"
              style={{
                borderTop: i > 0 ? "1px solid rgba(13,79,110,0.3)" : "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  "rgba(13,79,110,0.25)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "";
              }}
            >
              <Waves
                size={12}
                style={{ color: "var(--color-electric)", flexShrink: 0 }}
              />
              <button
                type="button"
                className="flex-1 min-w-0 text-left"
                onClick={() => {
                  onSelect(geoToSpot(result));
                  setQuery("");
                  setOpen(false);
                  setSavedIdx(null);
                }}
              >
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
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveToPreset(geoToSpot(result));
                  setSavedIdx(i);
                }}
                className="flex-shrink-0 rounded-full px-2 py-1 font-body text-xs font-semibold transition-all hover:scale-105"
                style={
                  savedIdx === i
                    ? {
                        background: "rgba(34,197,94,0.15)",
                        border: "1px solid rgba(34,197,94,0.5)",
                        color: "#22c55e",
                      }
                    : {
                        background: "rgba(0,180,216,0.1)",
                        border: "1px solid rgba(0,180,216,0.35)",
                        color: "var(--color-electric)",
                      }
                }
                aria-label={`Save ${result.name} to locations`}
                data-ocid={`search.save_button.${i + 1}`}
              >
                {savedIdx === i ? "✓ Saved" : "+ Save"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
