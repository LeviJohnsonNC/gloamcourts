import React from 'react';

interface InkPlateProps {
  caption?: string;
}

const InkPlate: React.FC<InkPlateProps> = ({ caption }) => {
  return (
    <div className="my-6 flex flex-col items-center">
      <div className="w-full max-w-md aspect-[4/3] border border-gold-dim rounded bg-muted/30 flex items-center justify-center overflow-hidden relative">
        <svg viewBox="0 0 400 300" className="w-full h-full opacity-60">
          {/* Ink wash background */}
          <defs>
            <filter id="rough">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" />
            </filter>
            <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(38 25% 82% / 0.3)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="400" height="300" fill="hsl(30 12% 14%)" />
          <rect width="400" height="300" fill="url(#hatch)" />
          {/* Ink blots */}
          <ellipse cx="200" cy="140" rx="120" ry="80" fill="hsl(30 15% 8% / 0.6)" filter="url(#rough)" />
          <ellipse cx="160" cy="160" rx="60" ry="40" fill="hsl(30 15% 8% / 0.4)" filter="url(#rough)" />
          <ellipse cx="250" cy="120" rx="50" ry="35" fill="hsl(30 15% 8% / 0.5)" filter="url(#rough)" />
          {/* Cross-hatching details */}
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={i} x1={80 + i * 12} y1={100 + Math.sin(i) * 30} x2={90 + i * 12} y2={180 + Math.cos(i) * 20}
              stroke="hsl(38 25% 82% / 0.15)" strokeWidth="0.5" />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-sm text-muted-foreground italic opacity-50">[Ink Plate]</span>
        </div>
      </div>
      {caption && <p className="mt-2 text-sm text-muted-foreground italic font-narrative text-center">{caption}</p>}
    </div>
  );
};

export default InkPlate;
