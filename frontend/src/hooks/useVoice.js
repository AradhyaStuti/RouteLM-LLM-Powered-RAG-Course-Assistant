import { useCallback, useEffect, useRef, useState } from 'react';

// Browser Web Speech API — works in Chrome / Edge / Safari (with prefix).
// Recognition: SpeechRecognition / webkitSpeechRecognition
// Synthesis:   window.speechSynthesis

const RecognitionCtor =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

const HAS_SYNTHESIS =
  typeof window !== 'undefined' && 'speechSynthesis' in window;

export const VOICE_SUPPORTED = !!RecognitionCtor;
export const TTS_SUPPORTED = HAS_SYNTHESIS;

const LANG_KEY = 'routelm_voice_lang';

export function getStoredLang() {
  if (typeof localStorage === 'undefined') return 'en-IN';
  return localStorage.getItem(LANG_KEY) || 'en-IN';
}

export function setStoredLang(lang) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LANG_KEY, lang);
}

/**
 * Speech-to-text. Returns:
 *   { listening, transcript, start, stop, supported, error }
 *
 * The transcript updates live as the engine emits interim results.
 * On stop (or natural end), the final transcript stays available until the
 * next start() call.
 */
export function useSpeechToText({ lang = 'en-IN', onFinal, onInterim } = {}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recogRef = useRef(null);
  // Pin the latest callbacks so `start` doesn't churn between renders.
  const cbRef = useRef({ onFinal, onInterim });
  useEffect(() => {
    cbRef.current = { onFinal, onInterim };
  });

  const stop = useCallback(() => {
    if (recogRef.current) {
      try { recogRef.current.stop(); } catch { /* already stopped */ }
    }
  }, []);

  const start = useCallback(() => {
    if (!RecognitionCtor) {
      setError('Voice input not supported in this browser.');
      return;
    }
    setError(null);

    const recog = new RecognitionCtor();
    recog.lang = lang;
    recog.continuous = false;
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    let finalText = '';

    recog.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += t;
        else interim += t;
      }
      const live = (finalText + interim).trim();
      cbRef.current.onInterim?.(live);
    };

    recog.onerror = (ev) => {
      setError(ev.error || 'Voice recognition error');
      setListening(false);
    };

    recog.onend = () => {
      setListening(false);
      const clean = finalText.trim();
      if (clean) cbRef.current.onFinal?.(clean);
    };

    recogRef.current = recog;
    try {
      recog.start();
      setListening(true);
    } catch (e) {
      setError(e.message || 'Could not start microphone');
    }
  }, [lang]);

  useEffect(() => () => stop(), [stop]);

  return {
    listening,
    start,
    stop,
    supported: VOICE_SUPPORTED,
    error,
  };
}

/**
 * Text-to-speech. Single instance shared via window.speechSynthesis.
 *
 *   const { speak, cancel, speaking, supported } = useTextToSpeech();
 *   speak("Hello", { lang: 'en-IN' });
 */
export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false);

  const cancel = useCallback(() => {
    if (!HAS_SYNTHESIS) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text, { lang = 'en-IN', rate = 1.0 } = {}) => {
    if (!HAS_SYNTHESIS || !text) return;
    // Cancel any in-flight utterance so we don't queue up.
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  // Stop on unmount so audio doesn't leak across pages.
  useEffect(() => () => { if (HAS_SYNTHESIS) window.speechSynthesis.cancel(); }, []);

  return { speak, cancel, speaking, supported: TTS_SUPPORTED };
}
