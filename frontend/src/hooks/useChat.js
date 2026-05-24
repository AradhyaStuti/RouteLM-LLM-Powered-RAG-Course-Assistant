import { useState, useCallback, useRef, useReducer } from 'react';
import { streamChat, fetchMessages, fetchConversations } from '../api/client';

function messagesReducer(state, action) {
  switch (action.type) {
    case 'set':
      return action.messages;
    case 'append':
      return [...state, action.message];
    case 'update_last': {
      if (state.length === 0) return state;
      const updated = [...state];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        ...action.fields,
      };
      return updated;
    }
    case 'append_token': {
      if (state.length === 0) return state;
      const updated = [...state];
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = {
        ...last,
        content: last.content + action.token,
      };
      return updated;
    }
    case 'remove_last_pair': {
      if (state.length < 2) return [];
      return state.slice(0, -2);
    }
    case 'remove_last': {
      if (state.length === 0) return state;
      return state.slice(0, -1);
    }
    case 'clear':
      return [];
    default:
      return state;
  }
}

export function useChat() {
  const [messages, dispatch] = useReducer(messagesReducer, []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeNode, setActiveNode] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const convIdRef = useRef(null);
  const lastUserMsgRef = useRef(null);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const data = await fetchConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadConversation = useCallback(async (convId) => {
    setConversationId(convId);
    convIdRef.current = convId;
    setError(null);
    try {
      const msgs = await fetchMessages(convId);
      dispatch({ type: 'set', messages: msgs });
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Failed to load messages');
    }
  }, []);

  const startNewChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setConversationId(null);
    convIdRef.current = null;
    dispatch({ type: 'clear' });
    setActiveNode(null);
    setIsStreaming(false);
    setError(null);
    lastUserMsgRef.current = null;
  }, []);

  const cancelStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsStreaming(false);
      setActiveNode(null);
    }
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  // Streams one turn. `appendUser` controls whether to also append the user
  // bubble (sendMessage/retryLast do; regenerateLast doesn't because it's
  // re-running the existing last query).
  const _runTurn = useCallback(async (text, { appendUser }) => {
    setError(null);
    lastUserMsgRef.current = text;

    if (appendUser) {
      dispatch({
        type: 'append',
        message: {
          id: crypto.randomUUID(),
          role: 'user',
          content: text,
          sources: [],
          timestamp: new Date().toISOString(),
        },
      });
    }

    dispatch({
      type: 'append',
      message: {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        sources: [],
        timestamp: new Date().toISOString(),
      },
    });

    setIsStreaming(true);
    setActiveNode('classify');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const data of streamChat(text, convIdRef.current, controller.signal)) {
        if (controller.signal.aborted) break;

        if (data.conversation_id) {
          setConversationId(data.conversation_id);
          convIdRef.current = data.conversation_id;
        }
        if (data.node) setActiveNode(data.node);
        if (data.sources) dispatch({ type: 'update_last', fields: { sources: data.sources } });
        if (data.token) dispatch({ type: 'append_token', token: data.token });

        if (data.error) {
          dispatch({ type: 'update_last', fields: { content: data.error, failed: true } });
          setError(data.error);
        }

        if (data.done) {
          fetchConversations().then(setConversations).catch(() => {});
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        dispatch({ type: 'update_last', fields: { content: '*[Cancelled]*' } });
      } else {
        const errorMsg = 'Connection failed. Check that the backend is reachable and the LLM provider is configured.';
        dispatch({ type: 'update_last', fields: { content: errorMsg, failed: true } });
        setError(errorMsg);
        console.error('Chat stream error:', err);
      }
    }

    abortRef.current = null;
    setIsStreaming(false);
    setActiveNode(null);
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return;
    await _runTurn(text.trim(), { appendUser: true });
  }, [isStreaming, _runTurn]);

  const retryLast = useCallback(async () => {
    if (isStreaming || !lastUserMsgRef.current) return;
    dispatch({ type: 'remove_last_pair' });
    await _runTurn(lastUserMsgRef.current, { appendUser: true });
  }, [isStreaming, _runTurn]);

  const regenerateLast = useCallback(async () => {
    if (isStreaming) return;
    const lastUserIdx = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIdx === -1) return;
    const lastQuery = messages[lastUserIdx].content;
    dispatch({ type: 'remove_last' });
    await _runTurn(lastQuery, { appendUser: false });
  }, [isStreaming, messages, _runTurn]);

  return {
    messages,
    isStreaming,
    activeNode,
    conversationId,
    conversations,
    loadingConversations,
    error,
    sendMessage,
    loadConversations,
    loadConversation,
    startNewChat,
    cancelStream,
    dismissError,
    retryLast,
    regenerateLast,
  };
}
