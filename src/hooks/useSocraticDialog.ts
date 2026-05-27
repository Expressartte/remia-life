import { useState, useCallback, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../services/firebase';
import { SocraticQuestion, DreamStatus } from '../types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DialogState =
  | 'waiting_transcription'  // sueño aún en status transcribing
  | 'generating'             // llamando a generateSocraticQuestions CF
  | 'ready'                  // preguntas cargadas, usuario respondiendo
  | 'typing'                 // animación "escribiendo..." entre preguntas
  | 'all_answered'           // todas respondidas, esperando "Analizar"
  | 'submitting'             // guardando status → analyzing
  | 'done'                   // análisis iniciado
  | 'error';

export interface ChatMessage {
  id: string;
  type: 'ai' | 'user';
  text: string;
  questionId?: number;
}

export interface UseSocraticDialogReturn {
  dialogState: DialogState;
  transcriptionText: string;
  questions: SocraticQuestion[];
  messages: ChatMessage[];
  currentQuestionIndex: number;
  isTyping: boolean;
  errorMessage: string | null;
  dreamStatus: DreamStatus | null;
  updateTranscription: (text: string) => void;
  submitAnswer: (answer: string, answerType: 'text' | 'voice') => Promise<void>;
  startAnalysis: () => Promise<void>;
  retryGenerating: () => Promise<void>;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPING_DELAY_MS = 1400; // delay "escribiendo..." entre preguntas

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSocraticDialog(
  userId: string,
  dreamId: string
): UseSocraticDialogReturn {
  const [dialogState, setDialogState] = useState<DialogState>('waiting_transcription');
  const [transcriptionText, setTranscriptionText] = useState('');
  const [questions, setQuestions] = useState<SocraticQuestion[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dreamStatus, setDreamStatus] = useState<DreamStatus | null>(null);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasGeneratedRef = useRef(false);

  // ── Listener de Firestore para el documento del sueño ─────────────────────

  useEffect(() => {
    if (!userId || !dreamId) return;
    const dreamRef = doc(db, 'users', userId, 'dreams', dreamId);
    const unsub = onSnapshot(dreamRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const status = data.status as DreamStatus;

      setDreamStatus(status);

      // Guardar el texto de transcripción si existe
      if (data.transcription?.text && !transcriptionText) {
        setTranscriptionText(data.transcription.text);
      }

      // Si ya hay preguntas guardadas (generadas en una sesión anterior), cargarlas
      if (
        Array.isArray(data.socraticDialog) &&
        data.socraticDialog.length > 0 &&
        !hasGeneratedRef.current &&
        (status === 'answering_questions' || status === 'all_answered')
      ) {
        hasGeneratedRef.current = true;
        loadExistingQuestions(data.socraticDialog as SocraticQuestion[]);
      }
    });

    return () => {
      unsub();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [userId, dreamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reaccionar al cambio de estado del sueño ──────────────────────────────

  useEffect(() => {
    if (
      (dreamStatus === 'awaiting_questions' || dreamStatus === 'answering_questions') &&
      !hasGeneratedRef.current &&
      dialogState === 'waiting_transcription'
    ) {
      generateQuestions();
    }
  }, [dreamStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cargar preguntas existentes (sesión retomada) ─────────────────────────

  const loadExistingQuestions = useCallback((existingQuestions: SocraticQuestion[]) => {
    setQuestions(existingQuestions);

    const builtMessages: ChatMessage[] = [];
    let firstUnansweredIndex = existingQuestions.length; // por defecto: todo respondido

    existingQuestions.forEach((q, i) => {
      builtMessages.push({ id: `ai-${q.id}`, type: 'ai', text: q.question, questionId: q.id });
      if (q.answer) {
        builtMessages.push({ id: `user-${q.id}`, type: 'user', text: q.answer });
      } else if (firstUnansweredIndex === existingQuestions.length) {
        firstUnansweredIndex = i;
      }
    });

    setMessages(builtMessages);
    setCurrentQuestionIndex(firstUnansweredIndex);

    if (firstUnansweredIndex >= existingQuestions.length) {
      setDialogState('all_answered');
    } else {
      setDialogState('ready');
    }
  }, []);

  // ── Generar preguntas llamando al CF ──────────────────────────────────────

  const generateQuestions = useCallback(async () => {
    if (hasGeneratedRef.current) return;
    hasGeneratedRef.current = true;

    setDialogState('generating');
    setIsTyping(true);
    setErrorMessage(null);

    try {
      const callGenerateQuestions = httpsCallable<
        { dreamId: string },
        { questions: SocraticQuestion[] }
      >(functions, 'generateSocraticQuestions');

      const result = await callGenerateQuestions({ dreamId });
      const fetchedQuestions = result.data.questions;

      setQuestions(fetchedQuestions);
      setIsTyping(false);

      // Mostrar la primera pregunta
      const firstQuestion = fetchedQuestions[0];
      setMessages([
        { id: `ai-${firstQuestion.id}`, type: 'ai', text: firstQuestion.question, questionId: firstQuestion.id },
      ]);
      setCurrentQuestionIndex(0);
      setDialogState('ready');
    } catch (err: any) {
      setIsTyping(false);
      hasGeneratedRef.current = false; // permitir retry
      setDialogState('error');
      setErrorMessage(err?.message ?? 'No se pudieron generar las preguntas.');
    }
  }, [dreamId]);

  // ── Guardar la respuesta del usuario ──────────────────────────────────────

  const submitAnswer = useCallback(
    async (answer: string, answerType: 'text' | 'voice') => {
      if (dialogState !== 'ready' || !answer.trim()) return;

      const question = questions[currentQuestionIndex];
      if (!question) return;

      // 1. Añadir burbuja de respuesta del usuario
      const userMessage: ChatMessage = {
        id: `user-${question.id}`,
        type: 'user',
        text: answer.trim(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // 2. Actualizar la pregunta con la respuesta en Firestore
      const updatedQuestions = questions.map((q, i) =>
        i === currentQuestionIndex
          ? { ...q, answer: answer.trim(), answerType, answeredAt: new Date().toISOString() }
          : q
      );
      setQuestions(updatedQuestions);

      try {
        await updateDoc(doc(db, 'users', userId, 'dreams', dreamId), {
          socraticDialog: updatedQuestions,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // No crítico: se reintentará cuando se envíe "Analizar"
      }

      const nextIndex = currentQuestionIndex + 1;

      if (nextIndex >= questions.length) {
        // Todas respondidas
        setCurrentQuestionIndex(questions.length);
        setDialogState('all_answered');
        return;
      }

      // 3. Mostrar indicador "escribiendo..."
      setDialogState('typing');
      setIsTyping(true);

      typingTimerRef.current = setTimeout(() => {
        setIsTyping(false);
        const nextQuestion = questions[nextIndex];
        const aiMessage: ChatMessage = {
          id: `ai-${nextQuestion.id}`,
          type: 'ai',
          text: nextQuestion.question,
          questionId: nextQuestion.id,
        };
        setMessages((prev) => [...prev, aiMessage]);
        setCurrentQuestionIndex(nextIndex);
        setDialogState('ready');
      }, TYPING_DELAY_MS);
    },
    [dialogState, questions, currentQuestionIndex, userId, dreamId]
  );

  // ── Iniciar análisis ──────────────────────────────────────────────────────

  const startAnalysis = useCallback(async () => {
    setDialogState('submitting');
    setErrorMessage(null);

    try {
      await updateDoc(doc(db, 'users', userId, 'dreams', dreamId), {
        status: 'analyzing',
        socraticDialog: questions,
        updatedAt: serverTimestamp(),
      });
      setDialogState('done');
    } catch (err: any) {
      setDialogState('all_answered');
      setErrorMessage('No se pudo iniciar el análisis. Inténtalo de nuevo.');
    }
  }, [userId, dreamId, questions]);

  // ── Retry al generar preguntas ────────────────────────────────────────────

  const retryGenerating = useCallback(async () => {
    hasGeneratedRef.current = false;
    await generateQuestions();
  }, [generateQuestions]);

  // ── Editar la transcripción localmente ────────────────────────────────────

  const updateTranscription = useCallback((text: string) => {
    setTranscriptionText(text);
  }, []);

  return {
    dialogState,
    transcriptionText,
    questions,
    messages,
    currentQuestionIndex,
    isTyping,
    errorMessage,
    dreamStatus,
    updateTranscription,
    submitAnswer,
    startAnalysis,
    retryGenerating,
  };
}
