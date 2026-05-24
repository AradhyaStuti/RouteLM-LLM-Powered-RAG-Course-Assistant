import { useState, useRef, useEffect, memo } from 'react';
import { ArrowUp, Square } from 'lucide-react';

const MAX_LENGTH = 2000;
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

export default memo(function InputArea({ onSend, disabled, onCancel, inputRef, focusKey }) {
  const [text, setText] = useState('');
  const internalRef = useRef(null);
  const ref = inputRef || internalRef;

  useEffect(() => {
    ref.current?.focus();
  }, [focusKey, ref]);

  const remaining = MAX_LENGTH - text.length;
  const nearLimit = remaining <= 200;
  const atLimit = remaining <= 0;

  const handleSubmit = () => {
    if (!text.trim() || disabled || atLimit) return;
    onSend(text.trim());
    setText('');
    if (ref.current) {
      ref.current.style.height = 'auto';
      requestAnimationFrame(() => ref.current?.focus());
    }
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

  return (
    <div className="input-area">
      <div className="input-wrapper">
        <textarea
          ref={ref}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask about ML, the LLM/RAG stack, or Python data science..."
          aria-label="Type your question"
          rows={1}
          disabled={disabled}
          autoFocus
        />
        {onCancel ? (
          <button className="send-btn cancel-btn" onClick={onCancel} aria-label="Stop generating (Esc)" title="Stop generating (Esc)">
            <Square size={14} aria-hidden="true" />
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={handleSubmit}
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
          <kbd>Enter</kbd> send · <kbd>Shift+Enter</kbd> newline · <kbd>{MOD}+N</kbd> new chat · <kbd>{MOD}+/</kbd> focus
        </p>
        {text.length > 0 && (
          <span className={`char-count ${nearLimit ? 'warn' : ''} ${atLimit ? 'limit' : ''}`}>
            {remaining}
          </span>
        )}
      </div>
    </div>
  );
});
