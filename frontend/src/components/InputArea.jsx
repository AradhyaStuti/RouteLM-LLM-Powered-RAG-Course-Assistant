import { useState, useRef, useEffect, memo } from 'react';
import { ArrowUp, Square, Mic, MicOff, Globe, AlertCircle } from 'lucide-react';
import { useSpeechToText, getStoredLang, setStoredLang } from '../hooks/useVoice';

const MAX_LENGTH = 2000;
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const VOICE_LANGS = [
  { code: 'en-IN', short: 'EN' },
  { code: 'hi-IN', short: 'हि' },
];

export default memo(function InputArea({ onSend, disabled, onCancel, inputRef, focusKey }) {
  const [text, setText] = useState('');
  const [voiceLang, setVoiceLang] = useState(() => getStoredLang());
  const internalRef = useRef(null);
  const ref = inputRef || internalRef;

  useEffect(() => { ref.current?.focus(); }, [focusKey, ref]);

  const remaining = MAX_LENGTH - text.length;
  const nearLimit = remaining <= 200;
  const atLimit = remaining <= 0;

  const handleSubmit = (override) => {
    const value = (override ?? text).trim();
    if (!value || disabled || value.length > MAX_LENGTH) return;
    onSend(value);
    setText('');
    if (ref.current) {
      ref.current.style.height = 'auto';
      requestAnimationFrame(() => ref.current?.focus());
    }
  };

  // Voice input: interim transcripts stream into the textarea; the final
  // transcript triggers send. Callbacks update `text` directly so we don't
  // need a state-mirroring effect.
  const { listening, start: startListening, stop: stopListening, supported: voiceSupported, error: voiceError } =
    useSpeechToText({
      lang: voiceLang,
      onInterim: (live) => setText(live),
      onFinal: (final) => handleSubmit(final),
    });

  const toggleVoice = () => {
    if (listening) stopListening();
    else startListening();
  };

  // Ctrl/Cmd + M toggles voice input from anywhere in the chat.
  useEffect(() => {
    if (!voiceSupported) return;
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        toggleVoice();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // toggleVoice closes over `listening`; rebind on changes so it sees latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, voiceSupported]);

  const cycleLang = () => {
    const next = VOICE_LANGS[(VOICE_LANGS.findIndex(l => l.code === voiceLang) + 1) % VOICE_LANGS.length];
    setVoiceLang(next.code);
    setStoredLang(next.code);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    if (val.length > MAX_LENGTH) return;
    setText(val);
    const el = e.target;
    el.style.height = 'auto';
    const height = el.scrollHeight || 0;
    el.style.height = Math.min(Math.max(height, 24), 150) + 'px';
  };

  const currentLangShort = VOICE_LANGS.find(l => l.code === voiceLang)?.short || 'EN';

  return (
    <div className="input-area">
      {voiceError && (
        <div className="voice-error" role="alert">
          <AlertCircle size={12} aria-hidden="true" />
          <span>{voiceError === 'not-allowed'
            ? 'Microphone access denied. Enable it in your browser settings to use voice.'
            : voiceError === 'no-speech'
            ? 'No speech detected — tap the mic and try again.'
            : `Voice error: ${voiceError}`}</span>
        </div>
      )}
      <div className={`input-wrapper ${listening ? 'listening' : ''}`}>
        <textarea
          ref={ref}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={listening ? 'Listening…' : 'Ask in English or Hindi — type or tap the mic'}
          aria-label="Type your question"
          rows={1}
          disabled={disabled}
          autoFocus
        />

        {voiceSupported && !onCancel && (
          <button
            type="button"
            className={`mic-btn ${listening ? 'listening' : ''}`}
            onClick={toggleVoice}
            disabled={disabled}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            title={listening ? 'Stop voice input' : `Voice input · ${currentLangShort} · ${MOD}+M`}
          >
            {listening ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
          </button>
        )}

        {onCancel ? (
          <button className="send-btn cancel-btn" onClick={onCancel} aria-label="Stop generating (Esc)" title="Stop generating (Esc)">
            <Square size={14} aria-hidden="true" />
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={() => handleSubmit()}
            disabled={!text.trim() || disabled || atLimit}
            aria-label="Send message (Enter)"
            title="Send (Enter) · Shift+Enter for newline"
          >
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="input-footer">
        <p className="input-hint">
          <kbd>Enter</kbd> send · <kbd>Shift+Enter</kbd> newline · <kbd>{MOD}+N</kbd> new chat
          {voiceSupported && <> · <kbd>{MOD}+M</kbd> voice</>}
        </p>
        <div className="input-footer-right">
          {voiceSupported && (
            <button
              type="button"
              className="voice-lang-btn"
              onClick={cycleLang}
              aria-label={`Voice language: ${currentLangShort}. Click to switch.`}
              title="Switch voice language (English / Hindi)"
            >
              <Globe size={11} aria-hidden="true" />
              <span>{currentLangShort}</span>
            </button>
          )}
          {text.length > 0 && (
            <span className={`char-count ${nearLimit ? 'warn' : ''} ${atLimit ? 'limit' : ''}`}>
              {remaining}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
