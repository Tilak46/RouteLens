import React from "react";
import { cn } from "@/lib/utils";

interface IllustrationProps {
  className?: string;
  size?: number;
}

/**
 * Native vector SVG illustration for the idle / ready state.
 * Features a cute astronaut explorer mascot looking at a wrist radar scanner,
 * with an antenna beacon and a mini rocket launching in the background.
 * 100% transparent vector, perfectly matching RouteLens's dark UI.
 */
export function ResponseIdleMascot({ className, size = 120 }: IllustrationProps) {
  return (
    <div className={cn("relative flex items-center justify-center select-none", className)}>
      {/* Ambient background glow */}
      <div
        className="absolute w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none -z-10"
        aria-hidden="true"
      />
      
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* Background Twinkling Stars */}
        <path
          d="M32 38 L34 43 L39 45 L34 47 L32 52 L30 47 L25 45 L30 43 Z"
          fill="currentColor"
          className="text-zinc-500/40 animate-pulse"
          style={{ animationDuration: "3s" }}
        />
        <path
          d="M138 68 L139.5 71.5 L143 73 L139.5 74.5 L138 78 L136.5 74.5 L133 73 L136.5 71.5 Z"
          fill="currentColor"
          className="text-zinc-500/50 animate-pulse"
          style={{ animationDuration: "2.4s", animationDelay: "0.8s" }}
        />
        <path
          d="M28 98 L29.5 101 L33 102.5 L29.5 104 L28 107 L26.5 104 L23 102.5 L26.5 101 Z"
          fill="currentColor"
          className="text-zinc-500/30"
        />

        {/* Mini Rocket in Background */}
        <g transform="translate(120, 22) rotate(42)">
          {/* Rocket Body */}
          <path
            d="M0 -18 C6 -12 7 8 7 14 L-7 14 C-7 8 -6 -12 0 -18 Z"
            fill="hsl(var(--card))"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            className="text-zinc-400"
          />
          {/* Rocket Window */}
          <circle cx="0" cy="-2" r="3.2" fill="hsl(var(--primary))" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.2" className="text-primary" />
          {/* Left Fin */}
          <path d="M-7 8 L-13 15 L-7 14 Z" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="1.6" className="text-zinc-400" />
          {/* Right Fin */}
          <path d="M7 8 L13 15 L7 14 Z" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="1.6" className="text-zinc-400" />
          {/* Flame */}
          <path
            d="M-3 15 C-4 21 0 25 0 25 C0 25 4 21 3 15 Z"
            fill="#f97316"
            fillOpacity="0.8"
            className="animate-pulse"
          />
        </g>
        {/* Curved Smoke Trail */}
        <path
          d="M125 42 Q112 58 116 75 T110 95"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeDasharray="3 3"
          strokeLinecap="round"
          className="text-zinc-600/60"
        />

        {/* Astronaut Mascot */}
        <g className="transition-transform duration-300">
          {/* Antenna */}
          <line
            x1="76"
            y1="34"
            x2="76"
            y2="18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-zinc-400"
          />
          {/* Glowing Beacon on Antenna Tip */}
          <circle
            cx="76"
            cy="14"
            r="4.5"
            fill="#f97316"
            className="animate-pulse"
          />
          <circle
            cx="76"
            cy="14"
            r="8"
            fill="#f97316"
            fillOpacity="0.25"
            className="animate-ping"
            style={{ animationDuration: "2s" }}
          />

          {/* Helmet Outer Shell */}
          <circle
            cx="76"
            cy="65"
            r="32"
            fill="hsl(var(--card))"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-zinc-300"
          />
          {/* Left Earmuff */}
          <rect
            x="41"
            y="56"
            width="6"
            height="18"
            rx="3"
            fill="hsl(var(--card))"
            stroke="currentColor"
            strokeWidth="2"
            className="text-zinc-400"
          />
          {/* Right Earmuff */}
          <rect
            x="105"
            y="56"
            width="6"
            height="18"
            rx="3"
            fill="hsl(var(--card))"
            stroke="currentColor"
            strokeWidth="2"
            className="text-zinc-400"
          />

          {/* Visor */}
          <rect
            x="53"
            y="48"
            width="46"
            height="34"
            rx="16"
            fill="rgba(15, 23, 42, 0.85)"
            stroke="currentColor"
            strokeWidth="2"
            className="text-zinc-400"
          />

          {/* Cute Face Inside Visor */}
          {/* Left Eye */}
          <ellipse cx="68" cy="63" rx="2.5" ry="3.2" fill="#ffffff" />
          <circle cx="67" cy="62" r="1" fill="#09090b" />
          {/* Right Eye */}
          <ellipse cx="84" cy="63" rx="2.5" ry="3.2" fill="#ffffff" />
          <circle cx="83" cy="62" r="1" fill="#09090b" />
          {/* Smile */}
          <path
            d="M72 71 Q76 75 80 71"
            stroke="#ffffff"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />

          {/* Spacesuit Collar */}
          <path
            d="M58 94 Q76 102 94 94"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-zinc-300"
          />

          {/* Torso */}
          <path
            d="M52 101 C52 128 100 128 100 101"
            fill="hsl(var(--card))"
            stroke="currentColor"
            strokeWidth="2.4"
            className="text-zinc-300"
          />

          {/* Chest Control Box */}
          <rect
            x="68"
            y="102"
            width="16"
            height="11"
            rx="2.5"
            fill="rgba(0,0,0,0.3)"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-zinc-500"
          />
          <circle cx="73" cy="107" r="1.8" fill="#f97316" />
          <circle cx="79" cy="107" r="1.8" fill="hsl(var(--primary))" />

          {/* Left Arm / Hand Pointing to Watch */}
          <path
            d="M52 101 C42 110 46 122 62 125"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
            className="text-zinc-300"
          />

          {/* Right Arm Holding Watch */}
          <path
            d="M100 101 C109 110 98 126 84 126"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
            className="text-zinc-300"
          />

          {/* Smart Wrist Watch / Radar Scanner */}
          <circle
            cx="73"
            cy="125"
            r="7"
            fill="#18181b"
            stroke="#f97316"
            strokeWidth="1.8"
          />
          {/* Radar Sweep Beams */}
          <path
            d="M73 125 L77 121"
            stroke="#f97316"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="73" cy="125" r="1.5" fill="#f97316" />
          {/* Subtle Radar Wave */}
          <circle
            cx="73"
            cy="125"
            r="11"
            stroke="#f97316"
            strokeWidth="1"
            strokeDasharray="2 2"
            fill="none"
            className="animate-spin"
            style={{ animationDuration: "6s" }}
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * Native vector SVG illustration for the Connection Error / Unplugged state.
 * Features the astronaut mascot looking confused while holding an unplugged electric cable
 * with a tiny electric warning spark and trailing wire.
 * 100% transparent vector, perfectly matching RouteLens's dark UI.
 */
export function ResponseDisconnectedMascot({ className, size = 120 }: IllustrationProps) {
  return (
    <div className={cn("relative flex items-center justify-center select-none", className)}>
      {/* Ambient background warning glow */}
      <div
        className="absolute w-36 h-36 rounded-full bg-rose-500/10 blur-2xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* Background Broken Connection Wave */}
        <path
          d="M18 60 Q28 50 38 60 T58 60"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          strokeLinecap="round"
          className="text-zinc-700/50"
        />

        {/* Astronaut Mascot */}
        <g>
          {/* Antenna */}
          <line
            x1="74"
            y1="34"
            x2="74"
            y2="18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-zinc-400"
          />
          {/* Warning Red Beacon on Antenna */}
          <circle
            cx="74"
            cy="14"
            r="4.5"
            fill="#ef4444"
            className="animate-pulse"
          />
          <circle
            cx="74"
            cy="14"
            r="8"
            fill="#ef4444"
            fillOpacity="0.25"
            className="animate-ping"
            style={{ animationDuration: "1.5s" }}
          />

          {/* Helmet Outer Shell */}
          <circle
            cx="74"
            cy="65"
            r="32"
            fill="hsl(var(--card))"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-zinc-300"
          />
          {/* Left Earmuff */}
          <rect
            x="39"
            y="56"
            width="6"
            height="18"
            rx="3"
            fill="hsl(var(--card))"
            stroke="currentColor"
            strokeWidth="2"
            className="text-zinc-400"
          />
          {/* Right Earmuff */}
          <rect
            x="103"
            y="56"
            width="6"
            height="18"
            rx="3"
            fill="hsl(var(--card))"
            stroke="currentColor"
            strokeWidth="2"
            className="text-zinc-400"
          />

          {/* Visor */}
          <rect
            x="51"
            y="48"
            width="46"
            height="34"
            rx="16"
            fill="rgba(15, 23, 42, 0.85)"
            stroke="currentColor"
            strokeWidth="2"
            className="text-zinc-400"
          />

          {/* Puzzled / Confused Face Inside Visor */}
          {/* Eyebrows (tilted in confusion) */}
          <path d="M64 57 L70 60" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M78 60 L84 58" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
          {/* Left Eye */}
          <ellipse cx="67" cy="64" rx="2.5" ry="3" fill="#ffffff" />
          <circle cx="66.5" cy="63.5" r="1" fill="#09090b" />
          {/* Right Eye */}
          <ellipse cx="81" cy="64" rx="2.5" ry="3" fill="#ffffff" />
          <circle cx="80.5" cy="63.5" r="1" fill="#09090b" />
          {/* Confused Wavy Mouth */}
          <path
            d="M70 73 Q74 71 78 74"
            stroke="#ffffff"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />

          {/* Left Arm Raised (Scratching Helmet) */}
          <path
            d="M48 98 C35 92 34 68 45 54 C50 49 54 52 53 58"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
            className="text-zinc-300"
          />
          {/* Glove scratching head */}
          <circle cx="50" cy="54" r="3.5" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="1.8" className="text-zinc-300" />

          {/* Spacesuit Collar */}
          <path
            d="M56 94 Q74 102 92 94"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-zinc-300"
          />

          {/* Torso */}
          <path
            d="M50 101 C50 128 98 128 98 101"
            fill="hsl(var(--card))"
            stroke="currentColor"
            strokeWidth="2.4"
            className="text-zinc-300"
          />

          {/* Chest Pack */}
          <rect
            x="66"
            y="102"
            width="16"
            height="11"
            rx="2.5"
            fill="rgba(0,0,0,0.3)"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-zinc-500"
          />
          <circle cx="71" cy="107" r="1.8" fill="#ef4444" />
          <circle cx="77" cy="107" r="1.8" fill="#71717a" />

          {/* Right Arm Extended Holding Unplugged Cable */}
          <path
            d="M98 101 C108 104 112 110 120 108"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
            className="text-zinc-300"
          />
          {/* Hand Holding Plug */}
          <ellipse cx="122" cy="107" rx="4" ry="4.5" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="2" className="text-zinc-300" />

          {/* Disconnected Electric Power Plug */}
          <g transform="translate(126, 100)">
            {/* Plug Body */}
            <rect
              x="0"
              y="0"
              width="10"
              height="14"
              rx="2.5"
              fill="#27272a"
              stroke="#f97316"
              strokeWidth="1.8"
            />
            {/* 2 Prongs */}
            <line x1="10" y1="3.5" x2="16" y2="3.5" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="10.5" x2="16" y2="10.5" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />

            {/* Spark / Electric Disconnect Sparkle */}
            <path
              d="M19 1 L20.5 5 L24 6.5 L20.5 8 L19 12 L17.5 8 L14 6.5 L17.5 5 Z"
              fill="#f97316"
              className="animate-pulse"
            />
          </g>

          {/* Trailing Disconnected Wire */}
          <path
            d="M126 107 C115 116 118 138 95 142 C72 145 60 136 42 144"
            stroke="#f97316"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="4 2"
            fill="none"
            className="opacity-80"
          />
        </g>
      </svg>
    </div>
  );
}
