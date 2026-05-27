import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  query,
  collection,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../services/firebase';
import { NightMood, NightCapsule, UserStreaks } from '../types';

// ─── Cápsulas educativas estáticas ───────────────────────────────────────────

export const NIGHT_CAPSULES: NightCapsule[] = [
  {
    id: 'nc_01',
    category: 'neuroscience',
    categoryLabel: 'Neurociencia',
    icon: 'pulse-outline',
    title: 'Acetilcolina en fase REM',
    content:
      'Durante la fase REM, tu cerebro produce tanta acetilcolina como cuando estás completamente despierto. Esta molécula es la responsable de que tus sueños sean tan vívidos y narrativos. Es literalmente tu cerebro en "modo teatro" — con las luces apagadas pero el director trabajando a máxima velocidad.',
  },
  {
    id: 'nc_02',
    category: 'neuroscience',
    categoryLabel: 'Neurociencia',
    icon: 'git-network-outline',
    title: 'Consolidación de memoria nocturna',
    content:
      'Mientras duermes, tu hipocampo "reproduce" los recuerdos del día y los transfiere a la corteza prefrontal para almacenamiento a largo plazo. Los sueños son el "ruido" de este proceso de grabación. Dormir bien literalmente hace que aprendas más rápido.',
  },
  {
    id: 'nc_03',
    category: 'neuroscience',
    categoryLabel: 'Neurociencia',
    icon: 'eye-outline',
    title: 'La parálisis del sueño es protección',
    content:
      'Durante REM, tu tronco cerebral paraliza voluntariamente tus músculos para que no "actúes" tus sueños. Cuando la parálisis del sueño ocurre de forma consciente, estás en la zona perfecta para inducir un sueño lúcido.',
  },
  {
    id: 'np_01',
    category: 'neuroplasticity',
    categoryLabel: 'Neuroplasticidad',
    icon: 'git-branch-outline',
    title: 'El cerebro creativo nocturno',
    content:
      'La fase REM activa el pensamiento asociativo — el mismo estado que produce las ideas más creativas. Decenas de descubrimientos científicos y obras de arte surgieron directamente de los sueños, incluyendo la estructura del benceno y la melodía de "Yesterday" de los Beatles.',
  },
  {
    id: 'np_02',
    category: 'neuroplasticity',
    categoryLabel: 'Neuroplasticidad',
    icon: 'sparkles-outline',
    title: 'Entrenamiento motor durante el sueño',
    content:
      'Tu cerebro no solo descansa — practica. Estudios han demostrado que músicos, atletas y programadores mejoran habilidades motoras durmiendo, sin ninguna práctica adicional. Las redes neuronales que usas de día se optimizan de noche.',
  },
  {
    id: 'nu_01',
    category: 'nutrition',
    categoryLabel: 'Nutrición cerebral',
    icon: 'nutrition-outline',
    title: 'Vitamina B6 y el recall onírico',
    content:
      '240mg de vitamina B6 tomada antes de dormir ha demostrado en estudios clínicos incrementar significativamente la viveza y el recall onírico al despertar. La B6 participa en la síntesis de serotonina y dopamina, que modulan la calidad de la fase REM.',
  },
  {
    id: 'nu_02',
    category: 'nutrition',
    categoryLabel: 'Nutrición cerebral',
    icon: 'moon-outline',
    title: 'Triptófano: el precursor del sueño',
    content:
      'El triptófano se convierte en serotonina y luego en melatonina — la hormona que regula tu ciclo de sueño. Plátano, leche tibia, avena y pavo son ricos en triptófano. Consumirlos 2 horas antes de dormir puede mejorar la calidad de tu sueño notablemente.',
  },
  {
    id: 'rc_01',
    category: 'recall',
    categoryLabel: 'Técnica de recall',
    icon: 'book-outline',
    title: 'El protocolo de 90 segundos',
    content:
      'Al despertar, tienes solo 90 segundos antes de que los sueños comiencen a desvanecerse. Protocolo: no muevas el cuerpo al abrir los ojos, permanece en la misma posición y escanea mentalmente lo último que recuerdas. Solo entonces escríbelo. El movimiento físico borra el buffer de memoria onírica.',
  },
  {
    id: 'rc_02',
    category: 'recall',
    categoryLabel: 'Técnica de recall',
    icon: 'mic-outline',
    title: 'La intención deliberada al dormir',
    content:
      'Decirte a ti mismo "Esta noche recordaré mis sueños" justo antes de dormir activa la formación reticular — el sistema que decide qué almacenas conscientemente. Esta simple intención aumenta el recall onírico en un 70% según estudios de laboratorio del sueño.',
  },
  {
    id: 'lu_01',
    category: 'lucid',
    categoryLabel: 'Sueño lúcido',
    icon: 'telescope-outline',
    title: 'Ondas Alfa y el estado hipnagógico',
    content:
      'Al cerrar los ojos y mirar levemente hacia arriba, tu cerebro genera ondas Alfa naturalmente — el estado entre vigilia y sueño. Este estado hipnagógico es la puerta de entrada al sueño lúcido. Practícalo deliberadamente en los primeros minutos antes de dormirte.',
  },
  {
    id: 'lu_02',
    category: 'lucid',
    categoryLabel: 'Sueño lúcido',
    icon: 'hand-left-outline',
    title: 'Reality checks: entrenamiento diurno',
    content:
      'Los soñadores lúcidos entrenados hacen reality checks cada hora durante el día: cuentan sus dedos, intentan leer texto dos veces, preguntan "¿estoy soñando?". Al hacerlo un hábito diurno, el cerebro lo replica en el sueño — y ahí reconoces que estás soñando.',
  },
  {
    id: 'lu_03',
    category: 'lucid',
    categoryLabel: 'Sueño lúcido',
    icon: 'infinite-outline',
    title: 'El protocolo WILD explicado',
    content:
      'WILD (Wake-Initiated Lucid Dream) consiste en entrar en un sueño directamente desde la vigilia. El truco es contar mentalmente "1... soy consciente... 2... soy consciente..." sin dormirte. La parálisis del sueño que sientes es la señal de que estás a segundos del sueño lúcido.',
  },
  {
    id: 'nc_04',
    category: 'neuroscience',
    categoryLabel: 'Neurociencia',
    icon: 'timer-outline',
    title: 'Ciclos de 90 minutos',
    content:
      'Tu cerebro alterna entre sueño profundo y REM en ciclos de ~90 minutos. Los primeros ciclos son más sueño profundo; los últimos (de 5–8 AM) son casi todo REM. Por eso despertarte 30 minutos antes de lo habitual es la forma más rápida de aumentar tu recall onírico.',
  },
  {
    id: 'nc_05',
    category: 'neuroscience',
    categoryLabel: 'Neurociencia',
    icon: 'flash-outline',
    title: 'La amígdala en fase REM',
    content:
      'Durante REM, la amígdala (centro emocional) se activa hasta un 30% más que en vigilia, mientras la corteza prefrontal (lógica) se apaga. Esto explica por qué los sueños son tan emocionales y absurdos a la vez: sientes intensamente pero no cuestionas nada.',
  },
  {
    id: 'nc_06',
    category: 'neuroscience',
    categoryLabel: 'Neurociencia',
    icon: 'water-outline',
    title: 'El sistema glinfático',
    content:
      'Solo durante el sueño profundo, tu cerebro activa su "sistema de limpieza": el espacio entre neuronas se expande 60% y el líquido cefalorraquídeo barre proteínas tóxicas como la beta-amiloide. Dormir mal literalmente deja basura en tu cerebro al día siguiente.',
  },
  {
    id: 'np_03',
    category: 'neuroplasticity',
    categoryLabel: 'Neuroplasticidad',
    icon: 'bulb-outline',
    title: 'Dormir sobre el problema funciona',
    content:
      'Estudios muestran que las personas que duermen sobre un problema complejo tienen el doble de probabilidad de resolverlo al día siguiente. Técnica: escribe el problema en una hoja antes de dormir, léelo en voz alta y dile a tu mente "búscame una solución". Tu cerebro en REM la armará.',
  },
  {
    id: 'np_04',
    category: 'neuroplasticity',
    categoryLabel: 'Neuroplasticidad',
    icon: 'layers-outline',
    title: 'Ondas lentas: el archivo mental',
    content:
      'El sueño profundo (ondas delta) consolida la memoria declarativa: hechos, datos, fechas. Si estudiaste algo hoy, dormir en las próximas 3 horas triplica tu retención comparado con estudiar y quedarte despierto la noche entera.',
  },
  {
    id: 'nu_03',
    category: 'nutrition',
    categoryLabel: 'Nutrición cerebral',
    icon: 'pizza-outline',
    title: 'El queso y los sueños vívidos',
    content:
      'La tiramina en quesos maduros (parmesano, cheddar, azul) libera norepinefrina, que intensifica la actividad cerebral durante REM. Comer una pequeña porción 2 horas antes de dormir produce sueños más largos y vívidos — una técnica usada por onironautas desde hace décadas.',
  },
  {
    id: 'nu_04',
    category: 'nutrition',
    categoryLabel: 'Nutrición cerebral',
    icon: 'wine-outline',
    title: 'El alcohol destruye tu REM',
    content:
      'El alcohol te hace dormir rápido pero suprime la fase REM durante las primeras 4 horas. Como consecuencia, tu cerebro "rebota" con REM intensa en la madrugada — y si te despiertas, puede sentirse como pesadillas. Evita beber 3 horas antes de acostarte.',
  },
  {
    id: 'nu_05',
    category: 'nutrition',
    categoryLabel: 'Nutrición cerebral',
    icon: 'cafe-outline',
    title: 'La vida media de la cafeína',
    content:
      'La cafeína tiene una vida media de 5–6 horas. Un café a las 3 PM significa que a las 9 PM todavía tienes la mitad circulando. Aunque logres dormir, reduce la profundidad del sueño en un 20%. Corte sugerido: 10 horas antes de tu hora habitual de dormir.',
  },
  {
    id: 'rc_03',
    category: 'recall',
    categoryLabel: 'Técnica de recall',
    icon: 'bed-outline',
    title: 'El ancla corporal',
    content:
      'Al despertar, antes de abrir los ojos, intenta volver a la posición exacta en la que soñabas. Tu cuerpo guarda "anclas posturales" que activan la memoria del sueño. Si no recuerdas nada, gira lentamente a las posiciones típicas en las que duermes — a menudo una de ellas trae el recuerdo de vuelta.',
  },
  {
    id: 'rc_04',
    category: 'recall',
    categoryLabel: 'Técnica de recall',
    icon: 'chatbox-ellipses-outline',
    title: 'Preguntas abiertas, no cerradas',
    content:
      'Al despertar, no preguntes "¿recuerdo mi sueño?" (binario, fácil de decir "no"). Pregúntate "¿qué estaba pasando hace un momento?" o "¿qué sentía en el cuerpo?". Las preguntas abiertas activan asociaciones y suelen desbloquear fragmentos olvidados.',
  },
  {
    id: 'rc_05',
    category: 'recall',
    categoryLabel: 'Técnica de recall',
    icon: 'alarm-outline',
    title: 'La ventana dorada de la madrugada',
    content:
      'El 80% de tus sueños narrativos ocurren en las últimas 2 horas antes de despertar, cuando los períodos REM son más largos (hasta 45 min). Si quieres recordar más, pon la alarma para despertar al final de un ciclo — hacia los 90, 270, 450 min después de dormirte.',
  },
  {
    id: 'lu_04',
    category: 'lucid',
    categoryLabel: 'Sueño lúcido',
    icon: 'repeat-outline',
    title: 'MILD: recordar recordar',
    content:
      'MILD (Mnemonic Induction of Lucid Dreams) se hace al despertar de madrugada: repite mentalmente "la próxima vez que sueñe, recordaré que estoy soñando", visualizando un sueño reciente. Luego vuelve a dormir. Estudios de la Universidad de Adelaida lo sitúan como la técnica más efectiva para principiantes.',
  },
  {
    id: 'lu_05',
    category: 'lucid',
    categoryLabel: 'Sueño lúcido',
    icon: 'hand-right-outline',
    title: 'Estabilizar un sueño lúcido',
    content:
      'Al reconocer que sueñas, el sueño tiende a desvanecerse por la excitación. Para estabilizarlo: frota tus manos con fuerza, gira tu cuerpo sobre sí mismo, o toca una superficie con detalle. Estas acciones anclan tu atención al cuerpo onírico y prolongan la lucidez.',
  },
  {
    id: 'lu_06',
    category: 'lucid',
    categoryLabel: 'Sueño lúcido',
    icon: 'search-outline',
    title: 'Tus signos oníricos personales',
    content:
      'Cada persona tiene "signos oníricos" recurrentes — elementos que aparecen sólo en sus sueños. Personas que no conoces, casas que no existen, volar, perder los dientes. Identifica los tuyos en tu diario. Cuando los veas despierto, harás un reality check automáticamente.',
  },
  {
    id: 'ri_01',
    category: 'ritual',
    categoryLabel: 'Ritual nocturno',
    icon: 'phone-portrait-outline',
    title: 'Pantalla apagada 60 minutos antes',
    content:
      'La luz azul de las pantallas suprime la melatonina hasta 2 horas. No necesitas eliminar el celular — pon filtro nocturno, baja el brillo al mínimo, y deja de scrollear contenido estimulante 60 min antes. Esto solo puede adelantar tu sueño profundo en 30–45 minutos.',
  },
  {
    id: 'ri_02',
    category: 'ritual',
    categoryLabel: 'Ritual nocturno',
    icon: 'thermometer-outline',
    title: 'Temperatura ideal: 18°C',
    content:
      'Tu temperatura corporal debe bajar ~1°C para iniciar el sueño. La NASA y múltiples laboratorios coinciden en que 18°C (65°F) es el punto óptimo. Si tu habitación está más cálida, tu cuerpo se esfuerza más y el sueño profundo se reduce drásticamente.',
  },
  {
    id: 'ri_03',
    category: 'ritual',
    categoryLabel: 'Ritual nocturno',
    icon: 'water-outline',
    title: 'Ducha tibia 90 minutos antes',
    content:
      'Una ducha tibia (no caliente) 90 min antes de dormir acelera el descenso de temperatura corporal posterior. Al salir del agua, tu cuerpo pierde calor rápido — y ese descenso es exactamente la señal que tu cerebro necesita para producir melatonina.',
  },
  {
    id: 'ri_04',
    category: 'ritual',
    categoryLabel: 'Ritual nocturno',
    icon: 'journal-outline',
    title: 'La caja de preocupaciones',
    content:
      'Si tu mente da vueltas al acostarte, toma una hoja y escribe durante 3 minutos todo lo que te preocupa. Estudios de la Universidad de Baylor muestran que esto reduce el tiempo para dormirse en un 40%. Al externalizar los pensamientos, tu cerebro deja de repasarlos.',
  },
  {
    id: 'in_01',
    category: 'interpretation',
    categoryLabel: 'Interpretación',
    icon: 'globe-outline',
    title: 'Contexto personal > símbolo universal',
    content:
      'Ningún diccionario de sueños funciona universalmente. El mismo símbolo (un perro, una casa, el mar) significa cosas diferentes según tu historia. Antes de buscar "qué significa soñar con X", pregúntate: "¿qué es X para mí?". Tu asociación personal es el 90% del significado.',
  },
  {
    id: 'in_02',
    category: 'interpretation',
    categoryLabel: 'Interpretación',
    icon: 'people-outline',
    title: 'Personajes como aspectos propios',
    content:
      'Jung proponía que cada personaje en tus sueños representa un aspecto de ti mismo. El desconocido que te persigue, el sabio que te aconseja, el niño que llora — son fragmentos de tu psique hablándote. Pregúntate: "¿qué parte de mí encarna este personaje?".',
  },
  {
    id: 'in_03',
    category: 'interpretation',
    categoryLabel: 'Interpretación',
    icon: 'water-outline',
    title: 'Agua: el estado emocional',
    content:
      'En la mayoría de tradiciones interpretativas, el agua refleja tu estado emocional. Aguas calmadas: equilibrio. Turbias: confusión. Tormentosas: ansiedad no resuelta. Inundaciones: emociones que amenazan con desbordarte. Observa el agua en tus sueños como un termómetro interno.',
  },
  {
    id: 'in_04',
    category: 'interpretation',
    categoryLabel: 'Interpretación',
    icon: 'refresh-outline',
    title: 'Sueños recurrentes son mensajes',
    content:
      'Un sueño que se repite (el mismo escenario, personaje o tema) suele ser una señal del inconsciente sobre algo no procesado. No es casualidad: tu mente insiste porque la atención consciente no captó el mensaje. Pregúntate qué situación actual de tu vida refleja el patrón.',
  },
  {
    id: 'ci_01',
    category: 'circadian',
    categoryLabel: 'Ritmo circadiano',
    icon: 'sunny-outline',
    title: 'Luz matutina en los primeros 10 minutos',
    content:
      '10 minutos de luz solar directa al despertar (sin vidrio de por medio) sincroniza tu reloj circadiano y adelanta la liberación de melatonina 14 horas más tarde. Es la intervención gratuita más potente para mejorar tu sueño nocturno — más que cualquier suplemento.',
  },
  {
    id: 'ci_02',
    category: 'circadian',
    categoryLabel: 'Ritmo circadiano',
    icon: 'restaurant-outline',
    title: 'Cena 3 horas antes',
    content:
      'Dormir con el estómago activo eleva tu temperatura corporal y reduce el sueño profundo. La digestión compite con los procesos de reparación nocturna. Cena ligera al menos 3 horas antes de acostarte — tu cerebro y tu cuerpo trabajarán en lo que deben.',
  },
  {
    id: 'we_01',
    category: 'wellness',
    categoryLabel: 'Bienestar',
    icon: 'leaf-outline',
    title: 'Respiración 4-7-8',
    content:
      'Técnica del Dr. Andrew Weil: inhala 4 seg, mantén 7 seg, exhala 8 seg. Repite 4 ciclos. La exhalación prolongada activa el sistema parasimpático y reduce la frecuencia cardíaca. Funciona tan bien que muchos se duermen antes del cuarto ciclo.',
  },
  {
    id: 'we_02',
    category: 'wellness',
    categoryLabel: 'Bienestar',
    icon: 'body-outline',
    title: 'Body scan consciente',
    content:
      'Acuéstate y recorre mentalmente tu cuerpo desde los pies hasta la coronilla, relajando cada parte. 5 minutos bastan. Este escaneo consciente desvía tu atención de los pensamientos rumiantes hacia sensaciones físicas — la entrada natural al sueño.',
  },
  {
    id: 'we_03',
    category: 'wellness',
    categoryLabel: 'Bienestar',
    icon: 'heart-outline',
    title: 'Gratitud de 3 cosas',
    content:
      'Antes de cerrar los ojos, piensa en 3 cosas específicas por las que estás agradecido hoy. Pequeñas: un café, una conversación, una luz. La gratitud desplaza la actividad del sistema de amenazas (amígdala) al sistema de recompensa — y tu cerebro entra en sueño con paz en lugar de vigilancia.',
  },
];

// ─── Opciones de estado emocional ─────────────────────────────────────────────

export const MOOD_OPTIONS = [
  { key: 'great' as NightMood, emoji: '😊', label: 'Genial', color: '#4ECDC4' },
  { key: 'good' as NightMood, emoji: '🙂', label: 'Bien', color: '#6C63FF' },
  { key: 'normal' as NightMood, emoji: '😐', label: 'Normal', color: '#E8D5B7' },
  { key: 'low' as NightMood, emoji: '😔', label: 'Bajo', color: '#FFD166' },
  { key: 'difficult' as NightMood, emoji: '😰', label: 'Difícil', color: '#FF6B6B' },
];

// ─── Fases de la meditación ───────────────────────────────────────────────────

export interface MeditationPhase {
  id: string;
  title: string;
  guidance: string;
  startPct: number; // 0-1 fraction of total duration
  endPct: number;
}

export function buildMeditationPhases(hasSilva: boolean): MeditationPhase[] {
  if (hasSilva) {
    return [
      { id: 'relax', title: 'Relajación progresiva', startPct: 0, endPct: 0.13,
        guidance: 'Afloja los músculos de tu cara, cuello, hombros. Deja ir las tensiones del día...' },
      { id: 'countdown', title: 'Descenso a Alfa', startPct: 0.13, endPct: 0.27,
        guidance: 'Cuenta conmigo hacia abajo: 10... 9... 8... cada número te lleva más profundo...' },
      { id: 'intention', title: 'Intención onírica', startPct: 0.27, endPct: 0.35,
        guidance: 'Repite mentalmente: "Esta noche recordaré mis sueños con claridad y detalle..."' },
      { id: 'silva', title: 'Pantalla Mental', startPct: 0.35, endPct: 0.87,
        guidance: 'Visualiza la escena que tu análisis te recomendó. Obsérvala con todos tus sentidos...' },
      { id: 'close', title: 'Cierre suave', startPct: 0.87, endPct: 1,
        guidance: 'Muy bien. Tu mente está programada. Ahora descansa y confía en tu subconsciente...' },
    ];
  }
  return [
    { id: 'relax', title: 'Relajación progresiva', startPct: 0, endPct: 0.22,
      guidance: 'Afloja los músculos de tu cara, cuello, hombros. Deja ir las tensiones del día...' },
    { id: 'countdown', title: 'Descenso a Alfa', startPct: 0.22, endPct: 0.44,
      guidance: 'Cuenta conmigo hacia abajo: 10... 9... 8... cada número te lleva más profundo...' },
    { id: 'intention', title: 'Intención onírica', startPct: 0.44, endPct: 0.67,
      guidance: 'Repite mentalmente: "Esta noche recordaré mis sueños con claridad y detalle..."' },
    { id: 'reinforcement', title: 'Refuerzo mental', startPct: 0.67, endPct: 0.88,
      guidance: 'Imagínate despertando mañana y recordando vívidamente cada escena de tu sueño...' },
    { id: 'close', title: 'Cierre suave', startPct: 0.88, endPct: 1,
      guidance: 'Muy bien. Tu mente está programada. Descansa y confía en tu subconsciente...' },
  ];
}

// ─── Utilidades de fecha ──────────────────────────────────────────────────────

function getLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isConsecutiveDay(lastDate: string, today: string): boolean {
  return lastDate === today || lastDate === getYesterdayDate();
}

// ─── Estado del hook ─────────────────────────────────────────────────────────

export type RitualStep = 'lobby' | 1 | 2 | 3 | 'complete';

export interface NightRitualState {
  step: RitualStep;
  mood: NightMood | null;
  note: string;
  capsule: NightCapsule | null;
  meditationSeconds: number;
  wbtbEnabled: boolean;
  lucidEnabled: boolean;
  streakDay: number;
  isAdvanced: boolean;   // streak >= 21
  pendingSilvaText: string | null;
  alreadyDoneToday: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useNightRitual(userId: string) {
  const [state, setState] = useState<NightRitualState>({
    step: 'lobby',
    mood: null,
    note: '',
    capsule: null,
    meditationSeconds: 0,
    wbtbEnabled: false,
    lucidEnabled: false,
    streakDay: 0,
    isAdvanced: false,
    pendingSilvaText: null,
    alreadyDoneToday: false,
    loading: true,
    saving: false,
    error: null,
  });

  // ── Carga inicial ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;
    loadInitialData();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadInitialData() {
    try {
      const today = getLocalDate();

      // 1. Check si ya completó el ritual hoy
      const checkinRef = doc(db, 'users', userId, 'nightCheckins', today);
      const checkinSnap = await getDoc(checkinRef);
      if (checkinSnap.exists()) {
        setState(prev => ({
          ...prev,
          alreadyDoneToday: true,
          step: 'complete',
          loading: false,
        }));
        return;
      }

      // 2. Leer streak actual del usuario
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const streaks = userSnap.data()?.streaks as UserStreaks | undefined;
      const currentStreak = streaks?.nightCurrent ?? 0;

      // 3. Leer recomendación Silva pendiente (del último sueño completo)
      const dreamsQuery = query(
        collection(db, 'users', userId, 'dreams'),
        where('status', '==', 'complete'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const dreamsSnap = await getDocs(dreamsQuery);
      let silvaPending: string | null = null;
      if (!dreamsSnap.empty) {
        const lastDream = dreamsSnap.docs[0].data();
        silvaPending = lastDream?.analysis?.mental_screen_recommendation ?? null;
      }

      // 4. Recopilar IDs de cápsulas vistas recientemente (últimos 7 días)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      // We read recent checkins to avoid repeating capsules
      const recentCheckinsQuery = query(
        collection(db, 'users', userId, 'nightCheckins'),
        orderBy('completedAt', 'desc'),
        limit(7)
      );
      const recentSnap = await getDocs(recentCheckinsQuery);
      const recentCapsuleIds = new Set(
        recentSnap.docs.map(d => d.data().capsuleId as string).filter(Boolean)
      );

      const capsule = pickCapsule(recentCapsuleIds);

      setState(prev => ({
        ...prev,
        streakDay: currentStreak,
        isAdvanced: currentStreak >= 21,
        pendingSilvaText: silvaPending,
        capsule,
        loading: false,
      }));
    } catch (e) {
      console.warn('useNightRitual loadInitialData error:', e);
      setState(prev => ({ ...prev, loading: false, capsule: NIGHT_CAPSULES[0] }));
    }
  }

  function pickCapsule(seenIds: Set<string>): NightCapsule {
    const unseen = NIGHT_CAPSULES.filter(c => !seenIds.has(c.id));
    const pool = unseen.length > 0 ? unseen : NIGHT_CAPSULES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Setters ──────────────────────────────────────────────────────────────────

  const setMood = useCallback((mood: NightMood) => {
    setState(prev => ({ ...prev, mood }));
  }, []);

  const setNote = useCallback((note: string) => {
    setState(prev => ({ ...prev, note }));
  }, []);

  const setWbtbEnabled = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, wbtbEnabled: v }));
  }, []);

  const setLucidEnabled = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, lucidEnabled: v }));
  }, []);

  const setStep = useCallback((step: RitualStep) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  // ── Acciones ─────────────────────────────────────────────────────────────────

  const beginRitual = useCallback(() => {
    setState(prev => ({ ...prev, step: 1 }));
  }, []);

  const completeRitual = useCallback(async (meditationSecs: number) => {
    setState(prev => ({ ...prev, saving: true, meditationSeconds: meditationSecs }));
    const today = getLocalDate();

    try {
      const moodOption = MOOD_OPTIONS.find(m => m.key === state.mood);

      // 1. Guardar nightCheckin
      const checkinRef = doc(db, 'users', userId, 'nightCheckins', today);
      await setDoc(checkinRef, {
        userId,
        date: today,
        mood: state.mood ?? 'normal',
        moodEmoji: moodOption?.emoji ?? '😐',
        moodLabel: moodOption?.label ?? 'Normal',
        note: state.note.trim(),
        capsuleId: state.capsule?.id ?? '',
        meditationCompleted: meditationSecs >= 30,
        meditationSeconds: meditationSecs,
        wbtbEnabled: state.wbtbEnabled,
        lucidTrainingEnabled: state.lucidEnabled,
        completedAt: serverTimestamp(),
      });

      // 2. Actualizar streak
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const streaks = userSnap.data()?.streaks as UserStreaks | undefined;
      const lastDate = streaks?.lastNightDate ?? '';
      const isConsec = isConsecutiveDay(lastDate, today);
      const newCurrent = isConsec ? (streaks?.nightCurrent ?? 0) + 1 : 1;
      const newLongest = Math.max(streaks?.nightLongest ?? 0, newCurrent);

      await updateDoc(userRef, {
        'streaks.nightCurrent': newCurrent,
        'streaks.nightLongest': newLongest,
        'streaks.lastNightDate': today,
        'profile.totalNightCheckins': increment(1),
        updatedAt: serverTimestamp(),
      });

      // 3. Si WBTB activo, guardar hora objetivo (5h desde ahora) en el checkin
      if (state.wbtbEnabled) {
        const wbtbAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
        await updateDoc(
          doc(db, 'users', userId, 'nightCheckins', today),
          { wbtbTargetTime: wbtbAt.toISOString() }
        );
      }

      setState(prev => ({
        ...prev,
        streakDay: newCurrent,
        meditationSeconds: meditationSecs,
        saving: false,
        step: 'complete',
      }));
    } catch (e) {
      console.error('completeRitual error:', e);
      setState(prev => ({
        ...prev,
        saving: false,
        error: 'No se pudo guardar el ritual. Intenta de nuevo.',
        step: 'complete',
      }));
    }
  }, [userId, state.mood, state.note, state.capsule, state.wbtbEnabled, state.lucidEnabled]);

  return {
    ...state,
    setMood,
    setNote,
    setWbtbEnabled,
    setLucidEnabled,
    setStep,
    beginRitual,
    completeRitual,
  };
}

// ─── Utilidad: registrar token FCM ────────────────────────────────────────────

/**
 * Llama la Cloud Function para guardar el token FCM del dispositivo.
 * Invocarlo desde el punto de entrada de la app después del login.
 */
export async function registerDeviceFcmToken(token: string): Promise<void> {
  try {
    const fn = httpsCallable(functions, 'registerFcmToken');
    await fn({ token });
  } catch (e) {
    console.warn('registerDeviceFcmToken failed:', e);
  }
}
