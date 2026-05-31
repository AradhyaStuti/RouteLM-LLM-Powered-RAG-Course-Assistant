import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import AuthScreen from './components/AuthScreen';
import LandingScreen from './components/LandingScreen';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import ToastHost from './components/Toast';
import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './styles.css';

function ChatApp({ username, onBack, initialMessage }) {
  const {
    messages, isStreaming, activeNode, conversationId, conversations,
    loadingConversations, error,
    sendMessage, loadConversations, loadConversation, startNewChat,
    cancelStream, dismissError, retryLast, regenerateLast,
  } = useChat();

  const inputRef = useRef(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const initialSentRef = useRef(false);

  // If LandingScreen handed us an initial message (subject-card click),
  // fire it once after mount so the chat opens with the answer already
  // streaming.
  useEffect(() => {
    if (initialMessage && !initialSentRef.current) {
      initialSentRef.current = true;
      sendMessage(initialMessage);
    }
  }, [initialMessage, sendMessage]);

  // Note: chat errors render inline inside ChatWindow with a Retry button,
  // so we don't push them as toasts too — having both was redundant.

  useKeyboardShortcuts({
    onNewChat: () => { startNewChat(); setMobileSidebarOpen(false); },
    onCancel: () => {
      if (isStreaming) cancelStream();
      else if (error) dismissError();
    },
    onFocusInput: () => inputRef.current?.focus(),
  });

  const handleSelect = (id) => {
    loadConversation(id);
    setMobileSidebarOpen(false);
  };

  return (
    <div className="app">
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Open conversations"
      >
        <Menu size={18} />
      </button>
      <Sidebar
        conversations={conversations}
        activeId={conversationId}
        onSelect={handleSelect}
        onNewChat={() => { startNewChat(); setMobileSidebarOpen(false); }}
        onRefresh={loadConversations}
        loading={loadingConversations}
        username={username}
        onBack={onBack}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <ChatWindow
        messages={messages}
        isStreaming={isStreaming}
        activeNode={activeNode}
        onSend={sendMessage}
        onCancel={cancelStream}
        error={error}
        onDismissError={dismissError}
        onRetry={retryLast}
        onRegenerate={regenerateLast}
        inputRef={inputRef}
        conversationId={conversationId}
      />
    </div>
  );
}

export default function App() {
  const { isAuthenticated, username, error, loading, register, login, logout } = useAuth();
  const [chatStarted, setChatStarted] = useState(false);
  const [initialMessage, setInitialMessage] = useState(null);

  const startChat = (message) => {
    setInitialMessage(typeof message === 'string' ? message : null);
    setChatStarted(true);
  };

  const backToLanding = () => {
    setChatStarted(false);
    setInitialMessage(null);
  };

  let view;
  if (!isAuthenticated) {
    view = <AuthScreen onLogin={login} onRegister={register} error={error} loading={loading} />;
  } else if (!chatStarted) {
    view = <LandingScreen username={username} onStart={startChat} onLogout={logout} />;
  } else {
    view = <ChatApp username={username} onBack={backToLanding} initialMessage={initialMessage} />;
  }

  return (
    <ErrorBoundary>
      {view}
      <ToastHost />
    </ErrorBoundary>
  );
}
