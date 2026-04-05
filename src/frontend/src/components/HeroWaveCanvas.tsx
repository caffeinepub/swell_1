import { useEffect, useRef } from "react";

type Rating = "good" | "average" | "poor";

interface Props {
  waveHeight: number;
  windSpeed: number;
  rating: Rating;
}

interface WaveLayer {
  amplitude: number;
  targetAmplitude: number;
  speed: number;
  targetSpeed: number;
  frequency: number;
  targetFrequency: number;
  offset: number;
  sharp: boolean;
  opacity: number;
}

interface WhitecapParticle {
  x: number;
  y: number;
  alpha: number;
}

const RATING_COLORS: Record<Rating, [number, number, number]> = {
  good: [0, 180, 216], // electric teal
  average: [0, 128, 160], // mid ocean blue-teal
  poor: [32, 80, 120], // deep stormy blue
};

function scaleToScreen(realWaveHeight: number): number {
  const minReal = 0.3;
  const maxReal = 6;
  const minScreen = 6;
  const maxScreen = 90;
  const clamped = Math.min(Math.max(realWaveHeight, minReal), maxReal);
  return (
    minScreen +
    ((clamped - minReal) / (maxReal - minReal)) * (maxScreen - minScreen)
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function updateWaves(waveHeight: number, waves: WaveLayer[]): void {
  const amplitude = scaleToScreen(waveHeight);
  waves[0].targetAmplitude = amplitude;
  waves[1].targetAmplitude = amplitude * 0.75;
  waves[2].targetAmplitude = amplitude * 0.5;

  const speed1 = 0.3 + (waveHeight / 6) * 1.4;
  waves[0].targetSpeed = speed1;
  waves[1].targetSpeed = speed1 * 0.8;
  waves[2].targetSpeed = speed1 * 0.6;

  waves[0].targetFrequency = 0.006 + (waveHeight / 6) * 0.006;
  waves[1].targetFrequency = waves[0].targetFrequency * 0.85;
  waves[2].targetFrequency = waves[0].targetFrequency * 0.7;

  waves[0].sharp = waveHeight > 3;
  waves[1].sharp = waveHeight > 3;
  waves[2].sharp = false;
}

function getY(x: number, wave: WaveLayer): number {
  const raw = Math.sin(x * wave.frequency + wave.offset);
  return wave.sharp
    ? Math.sign(raw) * Math.abs(raw) ** 0.65 * wave.amplitude
    : raw * wave.amplitude;
}

export default function HeroWaveCanvas({
  waveHeight,
  windSpeed,
  rating,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    waves: [] as WaveLayer[],
    currentColor: RATING_COLORS[rating] as [number, number, number],
    targetColor: RATING_COLORS[rating] as [number, number, number],
    tweenStart: 0,
    tweenDuration: 1200,
    whitecaps: [] as WhitecapParticle[],
    windSpeed: windSpeed,
    waveHeight: waveHeight,
    rafId: 0,
  });

  // Initialize waves once on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once
  useEffect(() => {
    const state = stateRef.current;
    if (state.waves.length === 0) {
      const amplitude = scaleToScreen(waveHeight);
      const speed1 = 0.3 + (waveHeight / 6) * 1.4;
      const freq = 0.006 + (waveHeight / 6) * 0.006;
      state.waves = [
        {
          amplitude,
          targetAmplitude: amplitude,
          speed: speed1,
          targetSpeed: speed1,
          frequency: freq,
          targetFrequency: freq,
          offset: 0,
          sharp: waveHeight > 3,
          opacity: 0.9,
        },
        {
          amplitude: amplitude * 0.75,
          targetAmplitude: amplitude * 0.75,
          speed: speed1 * 0.8,
          targetSpeed: speed1 * 0.8,
          frequency: freq * 0.85,
          targetFrequency: freq * 0.85,
          offset: 2.1,
          sharp: waveHeight > 3,
          opacity: 0.6,
        },
        {
          amplitude: amplitude * 0.5,
          targetAmplitude: amplitude * 0.5,
          speed: speed1 * 0.6,
          targetSpeed: speed1 * 0.6,
          frequency: freq * 0.7,
          targetFrequency: freq * 0.7,
          offset: 4.3,
          sharp: false,
          opacity: 0.35,
        },
      ];
    }
  }, []);

  // Update targets when props change
  useEffect(() => {
    const state = stateRef.current;
    if (state.waves.length === 0) return;
    updateWaves(waveHeight, state.waves);
    state.targetColor = RATING_COLORS[rating];
    state.windSpeed = windSpeed;
    state.waveHeight = waveHeight;
    state.tweenStart = performance.now();
  }, [waveHeight, windSpeed, rating]);

  // Resize handler — fills the viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;

    const animate = (now: number) => {
      state.rafId = requestAnimationFrame(animate);

      const w = canvas.width;
      const h = canvas.height;
      const dpr = window.devicePixelRatio || 1;

      if (w === 0 || h === 0 || state.waves.length === 0) return;

      // Tween color
      const tweenT = Math.min(
        (now - state.tweenStart) / state.tweenDuration,
        1,
      );
      const cc = state.currentColor;
      const tc = state.targetColor;
      const r = Math.round(lerp(cc[0], tc[0], tweenT));
      const g = Math.round(lerp(cc[1], tc[1], tweenT));
      const b = Math.round(lerp(cc[2], tc[2], tweenT));
      if (tweenT >= 1) state.currentColor = [tc[0], tc[1], tc[2]];

      ctx.clearRect(0, 0, w, h);

      // Waves sit in the bottom 40% of the screen
      const baselineY = h * 0.62;

      // Draw waves back to front
      const drawOrder = [2, 1, 0];
      for (const idx of drawOrder) {
        const wave = state.waves[idx];

        // Lerp toward targets
        wave.amplitude = lerp(wave.amplitude, wave.targetAmplitude, 0.025);
        wave.speed = lerp(wave.speed, wave.targetSpeed, 0.025);
        wave.frequency = lerp(wave.frequency, wave.targetFrequency, 0.025);

        // Advance phase
        wave.offset += wave.speed * 0.016;

        // Build path
        ctx.beginPath();
        const points: [number, number][] = [];
        for (let x = 0; x <= w; x += 2 * dpr) {
          const logicalX = x / dpr;
          const y = baselineY + getY(logicalX, wave) * dpr;
          points.push([x, y]);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        // Close path down to bottom for fill
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();

        // Gradient fill from wave crest down
        const grad = ctx.createLinearGradient(
          0,
          baselineY - wave.amplitude * dpr,
          0,
          h,
        );
        grad.addColorStop(0, `rgba(${r},${g},${b},${wave.opacity})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fill();

        // Spawn whitecaps on front wave peaks
        if (idx === 0 && state.windSpeed > 25) {
          for (let i = 1; i < points.length - 1; i++) {
            const [px, py] = points[i];
            const [, prevY] = points[i - 1];
            const [, nextY] = points[i + 1];
            if (py < prevY && py < nextY && Math.random() < 0.003) {
              state.whitecaps.push({ x: px, y: py, alpha: 0.6 });
            }
          }
        }
      }

      // Draw and update whitecaps
      for (let i = state.whitecaps.length - 1; i >= 0; i--) {
        const wc = state.whitecaps[i];
        wc.x += 0.3 * dpr;
        wc.alpha -= 0.008;
        if (wc.alpha <= 0) {
          state.whitecaps.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = wc.alpha;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.ellipse(wc.x, wc.y, 2 * dpr, 1 * dpr, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    state.rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(state.rafId);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
