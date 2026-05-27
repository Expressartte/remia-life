import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  AmbientSound,
  pickCommunityColor,
  pickCommunityIcon,
} from '../config/ambientSounds';

interface CommunitySoundDoc {
  soundId: string;
  title: string;
  prompt: string;
  creatorUid: string;
  creatorNickname: string;
  durationSec: number;
  storagePath: string;
  status: 'active' | 'flagged' | 'removed';
  playsCount?: number;
  reportCount?: number;
  createdAt?: Timestamp;
}

function docToAmbientSound(d: CommunitySoundDoc): AmbientSound {
  return {
    id: d.soundId,
    title: d.title,
    subtitle: d.prompt.slice(0, 80),
    category: 'community',
    categoryLabel: 'Comunidad',
    icon: pickCommunityIcon(d.soundId),
    color: pickCommunityColor(d.soundId),
    storagePath: d.storagePath,
    creatorNickname: d.creatorNickname,
    creatorUid: d.creatorUid,
    isCommunity: true,
  };
}

/**
 * Suscribe a los sonidos comunitarios activos, ordenados por creación desc.
 * Devuelve hasta 100 sonidos (para evitar bandwidth excesivo en cuentas grandes).
 */
export function useCommunityAmbientSounds(): {
  sounds: AmbientSound[];
  loading: boolean;
  error: string | null;
} {
  const [sounds, setSounds] = useState<AmbientSound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'ambient_sounds'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(100),
    );

    const unsub = onSnapshot(
      q,
      snap => {
        const items = snap.docs
          .map(d => d.data() as CommunitySoundDoc)
          .filter(d => d.soundId && d.title && d.storagePath)
          .map(docToAmbientSound);
        setSounds(items);
        setLoading(false);
      },
      err => {
        console.error('[useCommunityAmbientSounds] error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, []);

  return { sounds, loading, error };
}
