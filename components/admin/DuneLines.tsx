'use client';

// Dune horizon from the closing shot of duna-15s.mp4 — same formula, constants and colors.
// Source of truth: duna.html, the `shr>=1` branch of the S4 line loop.
import { useEffect, useRef } from 'react';

const LINES = 15;
const POINTS = 241;
// In the 1920x1080 video the band starts at y≈845 and runs past the bottom edge (1080).
const TOP = 845;
const HEIGHT = 235;

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function DuneLines({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const paths = Array.from(svg.querySelectorAll('path'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000;
      const W = svg.clientWidth;
      // Left-to-right draw-on over 1.2s, like the video.
      const reveal = reduce ? 1 : easeInOutCubic(Math.min(1, t / 1.2));

      paths.forEach((path, i) => {
        let d = '';
        for (let j = 0; j < POINTS; j++) {
          const u = j / (POINTS - 1);
          if (u > reveal) break;
          const x = u * W;
          const y =
            905 + i * 11 +
            Math.sin(u * 5.2 + t * 1.2 + i * 0.3) * (18 + i * 1.5) +
            Math.sin(u * 11 - t * 0.8 + i * 0.5) * 6 -
            TOP;
          d += (d ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
        }
        path.setAttribute('d', d || 'M0 0');
      });

      if (!reduce) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: HEIGHT, pointerEvents: 'none' }}
    >
      {Array.from({ length: LINES }, (_, i) => (
        <path
          key={i}
          fill="none"
          stroke={i < 4 ? '#F59E0B' : '#A69D8E'}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={(i < 4 ? 0.5 : 0.22) * (1 - (i / LINES) * 0.6)}
        />
      ))}
    </svg>
  );
}
