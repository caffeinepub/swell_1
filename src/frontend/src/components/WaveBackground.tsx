export default function WaveBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes waveDrift1 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-200px); }
        }
        @keyframes waveDrift2 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-160px); }
        }
        @keyframes waveDrift3 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-120px); }
        }
        @keyframes waveDrift4 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-80px); }
        }
        @keyframes waveDrift5 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50px); }
        }
        .surf-wave-1 {
          animation: waveDrift1 4s linear infinite;
          transform-origin: center;
        }
        .surf-wave-2 {
          animation: waveDrift2 5.5s linear infinite;
        }
        .surf-wave-3 {
          animation: waveDrift3 7s linear infinite;
        }
        .surf-wave-4 {
          animation: waveDrift4 9s linear infinite;
        }
        .surf-wave-5 {
          animation: waveDrift5 12s linear infinite;
        }
      `}</style>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1600 900"
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: "-15%",
          width: "130%",
          height: "100%",
        }}
      >
        <title>Decorative wave background</title>
        <defs>
          <linearGradient id="waveGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00b4d8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0d4f6e" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="waveGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d4f6e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#020d18" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="foamGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e0f7ff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#00b4d8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Layer 5 — deepest background swell, slowest */}
        <g className="surf-wave-5">
          <path
            d="M-200 520
               C0 420, 150 620, 400 480
               C550 390, 650 560, 800 460
               C950 360, 1100 560, 1300 440
               C1450 360, 1600 500, 1800 430
               L1800 900 L-200 900 Z"
            fill="#0d4f6e"
            opacity="0.13"
          />
        </g>

        {/* Layer 4 — deep swell */}
        <g className="surf-wave-4">
          <path
            d="M-200 560
               C-50 450, 100 640, 350 510
               C500 410, 620 590, 800 490
               C980 390, 1150 580, 1350 470
               C1500 380, 1700 540, 1800 460
               L1800 900 L-200 900 Z"
            fill="#0a3d55"
            opacity="0.18"
          />
        </g>

        {/* Layer 3 — mid swell */}
        <g className="surf-wave-3">
          <path
            d="M-200 590
               C-80 470, 80 670, 280 540
               C420 450, 560 620, 720 520
               C880 420, 1040 630, 1240 500
               C1380 410, 1600 570, 1800 480
               L1800 900 L-200 900 Z"
            fill="#0d4f6e"
            opacity="0.22"
          />
        </g>

        {/* Layer 2 — near wave with steeper crests */}
        <g className="surf-wave-2">
          <path
            d="M-200 650
               C-100 510, 20 500, 80 580
               C130 640, 170 460, 260 540
               C330 600, 380 470, 480 555
               C570 630, 620 460, 720 530
               C810 595, 870 460, 960 545
               C1050 620, 1100 470, 1200 540
               C1290 605, 1360 460, 1440 530
               C1520 595, 1620 470, 1800 540
               L1800 900 L-200 900 Z"
            fill="url(#waveGrad2)"
            opacity="0.35"
          />
        </g>

        {/* Layer 1 — front breaking wave, fastest */}
        <g className="surf-wave-1">
          {/* Main wave body */}
          <path
            d="M-200 700
               C-120 560, -40 540, 20 630
               C70 700, 100 520, 180 600
               C250 665, 280 505, 360 585
               C440 655, 470 490, 560 570
               C640 640, 680 490, 760 565
               C840 635, 880 480, 960 555
               C1040 625, 1080 480, 1160 555
               C1240 625, 1280 475, 1360 555
               C1440 625, 1520 485, 1600 560
               C1680 630, 1750 490, 1800 570
               L1800 900 L-200 900 Z"
            fill="url(#waveGrad1)"
            opacity="0.5"
          />
          {/* Foam crest overlay */}
          <path
            d="M-200 700
               C-120 560, -40 540, 20 630
               C70 700, 100 520, 180 600
               C250 665, 280 505, 360 585
               C440 655, 470 490, 560 570
               C640 640, 680 490, 760 565
               C840 635, 880 480, 960 555
               C1040 625, 1080 480, 1160 555
               C1240 625, 1280 475, 1360 555
               C1440 625, 1520 485, 1600 560
               C1680 630, 1750 490, 1800 570
               L1800 620 L-200 750 Z"
            fill="url(#foamGrad)"
            opacity="0.45"
          />
        </g>
      </svg>

      {/* Deep ocean glow */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "70vw",
          height: "70vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,180,216,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
