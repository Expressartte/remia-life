import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapNode {
  id: string;
  label: string;
  type: 'symbol' | 'emotion' | 'archetype';
  frequency: number;    // how many dreams contain this element
  dreamIds: string[];
}

export interface MapEdge {
  sourceId: string;
  targetId: string;
  weight: number;       // co-occurrence count
}

export interface DreamMapData {
  nodes: MapNode[];
  edges: MapEdge[];
}

export interface ArchetypeFrequency {
  name: string;
  frequency: number;    // dream count
  color: string;
}

export interface ArchetypeWeekPoint {
  week: string;         // ISO week "2026-W14"
  dominant: string;     // archetype name
}

export interface ArchetypeData {
  frequencies: ArchetypeFrequency[];
  evolution: ArchetypeWeekPoint[];
}

// ─── Archetype colors ─────────────────────────────────────────────────────────

const ARCHETYPE_COLORS: Record<string, string> = {
  sombra: '#FF6B6B',
  anima: '#FF8FB3',
  animus: '#6C63FF',
  mismo: '#FFD166',
  héroe: '#4ECDC4',
  hero: '#4ECDC4',
  mentor: '#95E1D3',
  embaucador: '#F3A712',
  niño: '#A8E6CF',
  sabio: '#DDA0DD',
  mago: '#C3B1E1',
  guerrero: '#E88C7D',
  amante: '#F4A8C0',
  madre: '#B8E994',
  padre: '#78E08F',
  inocente: '#FFC8A2',
};

export function archetypeColor(name: string): string {
  const key = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return ARCHETYPE_COLORS[key] ?? '#8B8B9E';
}

// ─── ISO week string ──────────────────────────────────────────────────────────

function isoWeek(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum =
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      );
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

// ─── Core computation ─────────────────────────────────────────────────────────

interface RawDream {
  id: string;
  date: string;
  dominantEmotion: string;
  archetypes: string[];
  symbols: string[];
}

function computeMapData(dreams: RawDream[]): DreamMapData {
  // Count frequencies
  const symbolMap = new Map<string, { freq: number; dreamIds: Set<string> }>();
  const emotionMap = new Map<string, { freq: number; dreamIds: Set<string> }>();
  const archetypeMap = new Map<string, { freq: number; dreamIds: Set<string> }>();

  for (const dream of dreams) {
    if (dream.dominantEmotion) {
      const e = dream.dominantEmotion.toLowerCase();
      const existing = emotionMap.get(e) ?? { freq: 0, dreamIds: new Set() };
      existing.freq++;
      existing.dreamIds.add(dream.id);
      emotionMap.set(e, existing);
    }
    for (const arch of dream.archetypes) {
      const a = arch.toLowerCase();
      const existing = archetypeMap.get(a) ?? { freq: 0, dreamIds: new Set() };
      existing.freq++;
      existing.dreamIds.add(dream.id);
      archetypeMap.set(a, existing);
    }
    for (const sym of dream.symbols) {
      const s = sym.toLowerCase();
      const existing = symbolMap.get(s) ?? { freq: 0, dreamIds: new Set() };
      existing.freq++;
      existing.dreamIds.add(dream.id);
      symbolMap.set(s, existing);
    }
  }

  // Sort and take top N per category
  const topSymbols = [...symbolMap.entries()]
    .sort((a, b) => b[1].freq - a[1].freq)
    .slice(0, 8)
    .map(([label, { freq, dreamIds }]): MapNode => ({
      id: `s:${label}`,
      label,
      type: 'symbol',
      frequency: freq,
      dreamIds: [...dreamIds],
    }));

  const topEmotions = [...emotionMap.entries()]
    .sort((a, b) => b[1].freq - a[1].freq)
    .slice(0, 6)
    .map(([label, { freq, dreamIds }]): MapNode => ({
      id: `e:${label}`,
      label,
      type: 'emotion',
      frequency: freq,
      dreamIds: [...dreamIds],
    }));

  const topArchetypes = [...archetypeMap.entries()]
    .sort((a, b) => b[1].freq - a[1].freq)
    .slice(0, 4)
    .map(([label, { freq, dreamIds }]): MapNode => ({
      id: `a:${label}`,
      label,
      type: 'archetype',
      frequency: freq,
      dreamIds: [...dreamIds],
    }));

  const nodes = [...topArchetypes, ...topEmotions, ...topSymbols];
  const nodeIds = new Set(nodes.map(n => n.id));

  // Compute co-occurrence edges
  const edgeMap = new Map<string, number>();

  for (const dream of dreams) {
    const presentIds: string[] = [];
    if (dream.dominantEmotion) {
      const id = `e:${dream.dominantEmotion.toLowerCase()}`;
      if (nodeIds.has(id)) presentIds.push(id);
    }
    for (const a of dream.archetypes) {
      const id = `a:${a.toLowerCase()}`;
      if (nodeIds.has(id)) presentIds.push(id);
    }
    for (const s of dream.symbols) {
      const id = `s:${s.toLowerCase()}`;
      if (nodeIds.has(id)) presentIds.push(id);
    }

    // All pairs
    for (let i = 0; i < presentIds.length; i++) {
      for (let j = i + 1; j < presentIds.length; j++) {
        const key = [presentIds[i], presentIds[j]].sort().join('||');
        edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
      }
    }
  }

  // Keep top 20 edges with weight >= 2
  const edges: MapEdge[] = [...edgeMap.entries()]
    .filter(([, w]) => w >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([key, weight]) => {
      const [sourceId, targetId] = key.split('||');
      return { sourceId, targetId, weight };
    });

  return { nodes, edges };
}

function computeArchetypeData(dreams: RawDream[]): ArchetypeData {
  const freqMap = new Map<string, number>();
  const weekDominant = new Map<string, Map<string, number>>();

  for (const dream of dreams) {
    const week = isoWeek(dream.date);

    for (const arch of dream.archetypes) {
      const name = arch.toLowerCase();
      freqMap.set(name, (freqMap.get(name) ?? 0) + 1);

      if (week) {
        const weekMap = weekDominant.get(week) ?? new Map<string, number>();
        weekMap.set(name, (weekMap.get(name) ?? 0) + 1);
        weekDominant.set(week, weekMap);
      }
    }
  }

  const frequencies: ArchetypeFrequency[] = [...freqMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, frequency]) => ({ name, frequency, color: archetypeColor(name) }));

  // Evolution: dominant archetype per week, sorted chronologically
  const evolution: ArchetypeWeekPoint[] = [...weekDominant.entries()]
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([week, archMap]) => {
      const dominant = [...archMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      return { week, dominant };
    })
    .slice(-12); // last 12 weeks

  return { frequencies, evolution };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface DreamPatternsState {
  mapData: DreamMapData;
  archetypeData: ArchetypeData;
  loading: boolean;
}

export function useDreamPatterns(): DreamPatternsState {
  const { user } = useAuth();
  const [rawDreams, setRawDreams] = useState<RawDream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchDreams = async () => {
      try {
        const dreamsRef = collection(db, 'users', user.uid, 'dreams');
        const q = query(
          dreamsRef,
          where('status', '==', 'complete'),
          orderBy('createdAt', 'desc'),
          limit(50),
        );
        const snap = await getDocs(q);

        const dreams: RawDream[] = snap.docs.map(d => {
          const data = d.data();
          const analysis = data.analysis ?? {};
          return {
            id: d.id,
            date: data.date ?? '',
            dominantEmotion: analysis.dominant_emotion ?? '',
            archetypes: (analysis.active_archetypes ?? []).map(
              (a: { name: string }) => a.name,
            ),
            symbols: (analysis.symbols ?? []).map(
              (s: { symbol: string }) => s.symbol,
            ),
          };
        });

        setRawDreams(dreams);
      } catch {
        // Silently fail; visualizations stay empty
      } finally {
        setLoading(false);
      }
    };

    fetchDreams();
  }, [user?.uid]);

  const mapData = useMemo(() => computeMapData(rawDreams), [rawDreams]);
  const archetypeData = useMemo(() => computeArchetypeData(rawDreams), [rawDreams]);

  return { mapData, archetypeData, loading };
}
