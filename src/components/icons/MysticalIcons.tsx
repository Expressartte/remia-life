import React from 'react';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
  Polygon,
} from 'react-native-svg';

export interface NeonSvgProps {
  size?: number;
  glowOpacity?: number;
  glowWidth?: number;
  strokeWidth?: number;
  gradientColors?: [string, string]; // [start, end]
}

const DEFAULT_GRADIENT: [string, string] = ['#00F0FF', '#BD00FF']; // Cyan to Magenta

// ─── Helper for Neon Paths ────────────────────────────────────────────────────
// Renderiza el path dos veces: una vez grueso y translúcido para el glow,
// y otra fino y brillante para el núcleo.
const NeonPath = ({
  d,
  glowOpacity = 0.4,
  glowWidth = 4,
  strokeWidth = 1.5,
  gradientId,
}: {
  d: string;
  glowOpacity?: number;
  glowWidth?: number;
  strokeWidth?: number;
  gradientId: string;
}) => (
  <>
    {/* Glow */}
    <Path
      d={d}
      stroke={`url(#${gradientId})`}
      strokeWidth={glowWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={glowOpacity}
    />
    {/* Core */}
    <Path
      d={d}
      stroke={`url(#${gradientId})`}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>
);

const NeonCircle = ({
  cx,
  cy,
  r,
  glowOpacity = 0.4,
  glowWidth = 4,
  strokeWidth = 1.5,
  gradientId,
  fill = 'none',
}: {
  cx: number | string;
  cy: number | string;
  r: number | string;
  glowOpacity?: number;
  glowWidth?: number;
  strokeWidth?: number;
  gradientId: string;
  fill?: string;
}) => (
  <>
    <Circle
      cx={cx}
      cy={cy}
      r={r}
      stroke={`url(#${gradientId})`}
      strokeWidth={glowWidth}
      fill={fill === 'none' ? 'none' : `url(#${gradientId})`}
      opacity={glowOpacity}
    />
    <Circle
      cx={cx}
      cy={cy}
      r={r}
      stroke={`url(#${gradientId})`}
      strokeWidth={strokeWidth}
      fill={fill === 'none' ? 'none' : '#fff'}
    />
  </>
);

// ─── Gradient Defs ────────────────────────────────────────────────────────────

const SharedDefs = ({
  id,
  colors,
}: {
  id: string;
  colors: [string, string];
}) => (
  <Defs>
    <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
      <Stop offset="0%" stopColor={colors[0]} />
      <Stop offset="100%" stopColor={colors[1]} />
    </LinearGradient>
  </Defs>
);

// ─── Icons ────────────────────────────────────────────────────────────────────

/**
 * Luna Creciente con Estrella (como en la referencia)
 */
export const CrescentMoonIcon = ({
  size = 64,
  gradientColors = ['#A855F7', '#3B82F6'], // Purple to Blue
  ...props
}: NeonSvgProps) => {
  const id = 'gradCrescent';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <SharedDefs id={id} colors={gradientColors} />
      {/* Crescent Moon */}
      <NeonPath
        d="M 55 15 C 32 15 15 35 15 55 C 15 77 33 95 55 95 C 70 95 83 87 90 75 C 65 80 40 65 40 40 C 40 28 45 18 55 15 Z"
        gradientId={id}
        {...props}
      />
      {/* Star */}
      <NeonPath
        d="M 75 35 Q 75 45 65 45 Q 75 45 75 55 Q 75 45 85 45 Q 75 45 75 35 Z"
        gradientId={id}
        {...props}
      />
      {/* Little dots */}
      <NeonCircle cx="30" cy="25" r="1" gradientId={id} fill="solid" {...props} />
      <NeonCircle cx="85" cy="20" r="0.5" gradientId={id} fill="solid" {...props} />
      <NeonCircle cx="20" cy="80" r="0.5" gradientId={id} fill="solid" {...props} />
      <NeonCircle cx="90" cy="60" r="1" gradientId={id} fill="solid" {...props} />
    </Svg>
  );
};

/**
 * Flor de Loto (como en la referencia, para el ClarityRing)
 */
export const LotusIcon = ({
  size = 64,
  gradientColors = ['#00F0FF', '#BD00FF'], // Cyan to Magenta
  ...props
}: NeonSvgProps) => {
  const id = 'gradLotus';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <SharedDefs id={id} colors={gradientColors} />
      {/* Outer circle dashes */}
      <NeonPath
        d="M 10 50 A 40 40 0 0 1 90 50 A 40 40 0 0 1 10 50"
        gradientId={id}
        strokeWidth={0.5}
        glowOpacity={0}
        {...props}
        // No pasamos prop directamente a NeonPath para dasharray, así que lo sobreescribimos
      />
      <Circle
        cx="50"
        cy="50"
        r="44"
        stroke={`url(#${id})`}
        strokeWidth={0.5}
        fill="none"
        strokeDasharray="2 4"
        opacity={0.6}
      />
      
      {/* Lotus Center Petal */}
      <NeonPath
        d="M 50 25 C 65 50 60 75 50 85 C 40 75 35 50 50 25 Z"
        gradientId={id}
        {...props}
      />
      {/* Left Petal */}
      <NeonPath
        d="M 50 80 C 25 70 15 50 20 35 C 30 50 45 60 50 80 Z"
        gradientId={id}
        {...props}
      />
      {/* Right Petal */}
      <NeonPath
        d="M 50 80 C 75 70 85 50 80 35 C 70 50 55 60 50 80 Z"
        gradientId={id}
        {...props}
      />
      
      {/* Inner Elements */}
      <NeonCircle cx="50" cy="55" r="4" gradientId={id} fill="none" {...props} />
      <NeonCircle cx="50" cy="55" r="1" gradientId={id} fill="solid" {...props} />
      <NeonCircle cx="50" cy="20" r="1" gradientId={id} fill="solid" {...props} />
      <NeonCircle cx="50" cy="90" r="1" gradientId={id} fill="solid" {...props} />
    </Svg>
  );
};

/**
 * Hexágono con ondas (Wave Hexagon - para MorningScreen o Stats)
 */
export const WaveHexagonIcon = ({
  size = 64,
  gradientColors = ['#00F0FF', '#7C3AED'], // Cyan to Purple
  ...props
}: NeonSvgProps) => {
  const id = 'gradHexWave';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <SharedDefs id={id} colors={gradientColors} />
      {/* Hexagon */}
      <NeonPath
        d="M 50 15 L 85 35 L 85 70 L 50 90 L 15 70 L 15 35 Z"
        gradientId={id}
        {...props}
      />
      {/* Waves */}
      <NeonPath
        d="M 15 60 Q 30 75 50 60 T 85 60"
        gradientId={id}
        {...props}
      />
      <NeonPath
        d="M 15 70 Q 30 85 50 70 T 85 70"
        gradientId={id}
        {...props}
      />
      {/* Inner planet/moon */}
      <NeonCircle cx="60" cy="40" r="6" gradientId={id} fill="none" {...props} />
    </Svg>
  );
};

/**
 * Pulsos abstractos (PulseIcon - excelente para audio/MorningScreen)
 */
export const PulseIcon = ({
  size = 64,
  gradientColors = ['#00F0FF', '#BD00FF'],
  ...props
}: NeonSvgProps) => {
  const id = 'gradPulse';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <SharedDefs id={id} colors={gradientColors} />
      {/* Oval container */}
      <NeonPath
        d="M 50 10 C 80 10 80 90 50 90 C 20 90 20 10 50 10 Z"
        gradientId={id}
        {...props}
      />
      {/* Pulse wave line */}
      <NeonPath
        d="M 15 50 L 35 50 L 45 30 L 55 70 L 65 50 L 85 50"
        gradientId={id}
        {...props}
      />
      {/* Dots */}
      <NeonCircle cx="50" cy="20" r="1.5" gradientId={id} fill="solid" {...props} />
      <NeonCircle cx="50" cy="80" r="1.5" gradientId={id} fill="solid" {...props} />
    </Svg>
  );
};

/**
 * Ojo místico (como en la referencia)
 */
export const MysticalEyeIcon = ({
  size = 64,
  gradientColors = ['#10B981', '#3B82F6'], // Emerald to Blue
  ...props
}: NeonSvgProps) => {
  const id = 'gradEye';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <SharedDefs id={id} colors={gradientColors} />
      {/* Outer Diamond/Leaves */}
      <NeonPath
        d="M 50 15 L 65 45 L 85 30 L 70 60 L 50 85 L 30 60 L 15 30 L 35 45 Z"
        gradientId={id}
        {...props}
      />
      {/* Eye Shape */}
      <NeonPath
        d="M 25 50 Q 50 30 75 50 Q 50 70 25 50 Z"
        gradientId={id}
        {...props}
      />
      {/* Pupil */}
      <NeonCircle cx="50" cy="50" r="8" gradientId={id} fill="none" {...props} />
      <NeonCircle cx="50" cy="50" r="2" gradientId={id} fill="solid" {...props} />
    </Svg>
  );
};

/**
 * Figura Meditando en círculos concéntricos
 */
export const MeditatingIcon = ({
  size = 64,
  gradientColors = ['#00F0FF', '#BD00FF'],
  ...props
}: NeonSvgProps) => {
  const id = 'gradMeditation';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <SharedDefs id={id} colors={gradientColors} />
      {/* Outer rings */}
      <NeonCircle cx="50" cy="50" r="40" gradientId={id} fill="none" {...props} />
      <NeonCircle cx="50" cy="50" r="34" gradientId={id} fill="none" {...props} />
      
      {/* Head */}
      <NeonCircle cx="50" cy="35" r="5" gradientId={id} fill="none" {...props} />
      
      {/* Body */}
      <NeonPath
        d="M 50 42 C 58 42 60 55 60 60 C 60 65 40 65 40 60 C 40 55 42 42 50 42 Z"
        gradientId={id}
        {...props}
      />
      
      {/* Legs (Lotus position) */}
      <NeonPath
        d="M 35 60 C 35 75 65 75 65 60 Z"
        gradientId={id}
        {...props}
      />
      
      {/* Inner dot */}
      <NeonCircle cx="50" cy="55" r="1" gradientId={id} fill="solid" {...props} />
    </Svg>
  );
};
