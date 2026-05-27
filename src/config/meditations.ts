// Catálogo de meditaciones guiadas para Remia.
// Cada meditación se sintetiza con ElevenLabs bajo demanda y se cachea
// permanentemente en Storage (path users/{uid}/tts/meditation-{id}/...).
//
// Para agregar una meditación nueva: añade un objeto al array.
// El audio se generará la primera vez que cualquier usuario la reproduzca.

export type MeditationCategory =
  | 'sleep'
  | 'recall'
  | 'lucid'
  | 'anxiety'
  | 'gratitude'
  | 'focus';

export interface Meditation {
  id: string;
  title: string;
  subtitle: string;
  category: MeditationCategory;
  categoryLabel: string;
  durationMinutes: number; // estimación, real depende del TTS
  icon: string;            // Ionicons name
  color: string;           // hex
  /** Texto a narrar. Usa puntos finales para pausas naturales del TTS. */
  script: string;
}

export const MEDITATIONS: Meditation[] = [
  {
    id: 'med_sleep_descent',
    title: 'Descenso al sueño',
    subtitle: 'Body scan + cuenta regresiva para dormir profundo',
    category: 'sleep',
    categoryLabel: 'Sueño profundo',
    durationMinutes: 5,
    icon: 'moon-outline',
    color: '#6C63FF',
    script: `Acomódate en la cama. Cierra los ojos suavemente. Vamos a dejar ir el día.

Lleva tu atención a tus pies. Siente cómo se relajan, cómo se vuelven pesados. La tensión se disuelve.

Sube por tus piernas. Pantorrillas sueltas. Muslos sueltos. Cadera asentada en el colchón.

Tu vientre se expande lentamente con cada respiración. Pecho que sube y baja sin esfuerzo.

Hombros que se rinden a la gravedad. Brazos completamente sueltos. Manos abiertas.

Tu cuello descansa. Mandíbula floja. Frente lisa. Cada músculo de tu cara se entrega.

Ahora vamos a contar hacia abajo. Con cada número, te hundes más profundo en el descanso.

Diez. Dejas ir cualquier pensamiento del día.

Nueve. Tu cuerpo se vuelve más pesado.

Ocho. Tu mente se aquieta.

Siete. Respiras lentamente, como ya estuvieras dormido.

Seis. Te sientes seguro, cuidado, en paz.

Cinco. Tu conciencia se afloja.

Cuatro. Estás flotando.

Tres. Casi no recuerdas dónde estás.

Dos. El sueño te recibe.

Uno. Descansa.`,
  },
  {
    id: 'med_recall',
    title: 'Intención de recordar',
    subtitle: 'Programa tu mente para recordar tus sueños esta noche',
    category: 'recall',
    categoryLabel: 'Recall onírico',
    durationMinutes: 3,
    icon: 'eye-outline',
    color: '#4ECDC4',
    script: `Toma una respiración profunda. Y otra. Permítete estar exactamente donde estás.

Esta noche vamos a programar una intención. Una orden suave para tu subconsciente.

Repite mentalmente conmigo, sin prisa: Esta noche, recordaré mis sueños.

Otra vez: Esta noche, recordaré mis sueños con claridad y detalle.

Imagínate ahora despertando mañana por la mañana. Abres los ojos lentamente. Antes de moverte, escaneas tu mente. Y ahí está. La memoria del sueño llega clara, vívida, completa.

Te ves a ti mismo escribiendo el sueño en tu diario. Las imágenes fluyen. Los detalles aparecen sin esfuerzo.

Sabes que tu cerebro produce muchos sueños cada noche. Esta noche, vas a recordar al menos uno.

Vuelve a repetirlo: Esta noche, recordaré mis sueños.

Tu intención está plantada. Tu mente la cumplirá. Suelta la idea ahora y entrégate al descanso.`,
  },
  {
    id: 'med_lucid',
    title: 'Puerta al sueño lúcido',
    subtitle: 'Técnica MILD para inducir consciencia dentro del sueño',
    category: 'lucid',
    categoryLabel: 'Sueño lúcido',
    durationMinutes: 5,
    icon: 'telescope-outline',
    color: '#C77DFF',
    script: `Esta meditación te prepara para reconocer que estás soñando, dentro del sueño.

Primero, recuerda un sueño reciente. Cualquiera. Trae a tu mente una escena de ese sueño. Lo más vívida que puedas.

Ahora, dentro de esa escena recordada, imagina que te das cuenta. Te das cuenta de que estás soñando. Una sensación de claridad, de despertar interno.

Repite mentalmente: La próxima vez que sueñe, recordaré que estoy soñando.

Otra vez, con calma: La próxima vez que sueñe, sabré que es un sueño.

Visualízate haciendo un test de realidad. Mira tus manos en el sueño. Cuenta tus dedos. Ves seis, o siete, o se transforman. Eso confirma que estás soñando.

Sientes alegría. Calma. Eres consciente y el sueño continúa.

Ahora suelta la imagen. Vuelve a la respiración. Pero la intención queda sembrada.

Una última vez: La próxima vez que sueñe, lo sabré.

Confía. Tu mente está entrenada. Descansa ahora, y mañana cuéntame qué pasó.`,
  },
  {
    id: 'med_anxiety',
    title: 'Calma para mente acelerada',
    subtitle: 'Respiración 4-7-8 + visualización para soltar la ansiedad',
    category: 'anxiety',
    categoryLabel: 'Ansiedad',
    durationMinutes: 4,
    icon: 'leaf-outline',
    color: '#84A98C',
    script: `Si tu mente está acelerada, esto es para ti. Vamos a usar la respiración para anclar tu sistema nervioso.

Cierra los ojos. Apoya la lengua suavemente detrás de los dientes superiores. Vamos a hacer cuatro ciclos.

Inhala por la nariz, contando hasta cuatro. Uno, dos, tres, cuatro.

Mantén el aire siete segundos. Uno, dos, tres, cuatro, cinco, seis, siete.

Exhala por la boca contando hasta ocho, con un suave sonido de viento. Uno, dos, tres, cuatro, cinco, seis, siete, ocho.

Inhala otra vez. Cuatro segundos.

Mantén. Siete.

Exhala lentamente. Ocho.

Una vez más. Inhala cuatro. Mantén siete. Exhala ocho.

Y la última. Inhala. Mantén. Exhala completamente.

Ahora respira normal. Imagina que tu ansiedad es una nube oscura que estaba sobre ti. Con cada exhalación de las que acabas de hacer, esa nube se ha ido alejando. Ahora está a la distancia. Ya no te toca.

Tu cuerpo está más calmado. Tu corazón más lento. Tu mente, más quieta.

Quédate aquí. Respira normal. Y cuando estés lista, abre los ojos.`,
  },
  {
    id: 'med_gratitude',
    title: 'Gratitud nocturna',
    subtitle: 'Cierra el día con tres reconocimientos al corazón',
    category: 'gratitude',
    categoryLabel: 'Gratitud',
    durationMinutes: 3,
    icon: 'heart-outline',
    color: '#F4A261',
    script: `Antes de dormir, vamos a regalarle a tu mente un cierre amable del día.

Pon una mano en tu corazón. Siente su latido. Ese latido te ha sostenido todo el día.

Ahora piensa en algo pequeño que pasó hoy y por lo que estás agradecida. Puede ser cualquier cosa. Un café. Una sonrisa. Un mensaje. La luz del sol entrando por una ventana.

Quédate con esa imagen. Siente cómo el cuerpo se ablanda al recordarlo.

Ahora una segunda cosa. Algo distinto. Tal vez una persona, o un sabor, o un momento de silencio que te dio paz. No tiene que ser grande. Lo cotidiano cuenta.

Permítete sonreír levemente al recordarlo.

Y una tercera. Esta vez, algo de ti misma. Algo que hiciste hoy de lo que te sientes bien. Una pequeña victoria. Una palabra amable que te dijiste. Un límite que pusiste. Reconócelo.

Tu mano sigue en el corazón. Respira hondo.

Llevas estos tres regalos al sueño contigo. Son las semillas de tus sueños esta noche.

Buenas noches.`,
  },
  {
    id: 'med_reconnect',
    title: 'Reconexión con el cuerpo',
    subtitle: 'Para mentes inquietas que no encuentran el sueño',
    category: 'focus',
    categoryLabel: 'Reconexión',
    durationMinutes: 4,
    icon: 'body-outline',
    color: '#8D99AE',
    script: `Si llevas un rato dando vueltas en la cama, esta meditación es tu ancla. La mente acelerada se calma cuando regresa al cuerpo.

Quédate boca arriba si puedes. Brazos a los lados, palmas hacia arriba.

Vamos a recorrer tu cuerpo con atención plena. No tienes que relajar nada a la fuerza. Solo notar.

Empieza por las plantas de los pies. ¿Qué sensación hay ahí? Frío, calor, contacto con la sábana, hormigueo, nada. Lo que sea, simplemente nota.

Sube a los tobillos. ¿Qué sientes? Sigue.

Pantorrillas. Rodillas. Muslos. ¿Hay tensión, peso, calidez? Solo observa.

Cadera. Glúteos asentados. Espalda baja en contacto con la cama.

Vientre que sube y baja. Pecho. Hombros: ¿están subidos hacia las orejas? Déjalos caer.

Brazos. Codos. Antebrazos. Manos. Cada dedo.

Cuello largo. Mandíbula: ¿está apretada? Suéltala.

Cara. Frente lisa. Párpados pesados.

Ahora todo el cuerpo a la vez. Una presencia entera, descansando.

Ya no estás en tu cabeza. Estás aquí, en el cuerpo. Y desde aquí, el sueño viene solo.

Quédate. Respira. Confía.`,
  },
];

export function getMeditationById(id: string): Meditation | undefined {
  return MEDITATIONS.find(m => m.id === id);
}
