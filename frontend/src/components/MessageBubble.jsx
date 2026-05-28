import { memo, useState } from 'react';
import { User, Copy, Check, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SourceCard from './SourceCard';
import PipelineStatus from './PipelineStatus';
import RobotAvatar from './RobotAvatar';

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default memo(function MessageBubble({ message, isStreaming, activeNode, isLast, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // While the assistant is streaming, `aria-busy` tells assistive tech to
  // hold off announcing the message until it's done — otherwise the parent
  // `aria-live="polite"` region would read every token append.
  return (
    <div
      className={`message ${isUser ? 'user' : 'assistant'}`}
      role="article"
      aria-label={isUser ? 'Your message' : 'RouteLM response'}
      aria-busy={isStreaming && !isUser ? true : undefined}
    >
      <div className={`message-avatar ${isUser ? '' : 'robot'}`} aria-hidden="true">
        {isUser ? <User size={16} /> : <RobotAvatar size={30} />}
      </div>
      <div className="message-body">
        <div className="message-header">
          <span className="message-role">{isUser ? 'You' : 'RouteLM'}</span>
          <span className="message-time">{formatTimestamp(message.timestamp)}</span>
        </div>

        {isStreaming && !isUser && activeNode && (
          <PipelineStatus activeNode={activeNode} />
        )}

        <div className="message-text">
          {isUser ? (
            <p>{message.content}</p>
          ) : message.content ? (
            <ReactMarkdown disallowedElements={['script', 'iframe', 'object', 'embed', 'img', 'form', 'input']}>
              {message.content}
            </ReactMarkdown>
          ) : (
            <div className="typing-indicator" aria-label="Generating response">
              <span /><span /><span />
            </div>
          )}
          {isStreaming && !isUser && message.content && <span className="cursor" aria-hidden="true" />}
        </div>

        {!isUser && message.sources?.length > 0 && (
          <SourceCard sources={message.sources} />
        )}

        {!isUser && message.content && !isStreaming && (
          <div className="message-actions">
            <button className="msg-action-btn" onClick={handleCopy} aria-label="Copy response">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {isLast && onRegenerate && (
              <button className="msg-action-btn" onClick={onRegenerate} aria-label="Regenerate response">
                <RefreshCw size={13} />
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
