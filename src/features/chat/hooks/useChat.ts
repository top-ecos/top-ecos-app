
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StationTypeManager } from "@/features/station/lib/stationTypeManager";
import { Message, ConversationHistory } from "@/features/chat/types/message.types";
import { CaseData } from "@/features/station/types/sdd.types";
import { StorageManager } from "@/shared/lib/storage";

export const useChat = (caseData: CaseData) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10 * 60); // 10 minutes en secondes
  const [isPaused, setIsPaused] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const lastSendRef = useRef<number>(0);

  // Charger les messages sauvegardés
  useEffect(() => {
    const savedMessages = StorageManager.getChatMessages(caseData.sdd_id);
    const savedTimer = StorageManager.getTimerState(caseData.sdd_id);
    
    if (savedMessages) {
      setMessages(savedMessages);
    } else {
      setMessages([]);
    }

    if (savedTimer) {
      setTimeRemaining(savedTimer.timeRemaining);
      setIsPaused(savedTimer.isPaused);
      setIsTimeUp(savedTimer.isTimeUp);
    }
  }, [caseData.sdd_id]);

  // Sauvegarder les messages à chaque changement
  useEffect(() => {
    if (messages.length > 0) {
      StorageManager.saveChatMessages(caseData.sdd_id, messages);
    }
  }, [messages, caseData.sdd_id]);

  // Sauvegarder l'état du timer
  useEffect(() => {
    StorageManager.saveTimerState(caseData.sdd_id, {
      timeRemaining,
      isPaused,
      isTimeUp
    });
  }, [timeRemaining, isPaused, isTimeUp, caseData.sdd_id]);

  // Gestion du timer
  useEffect(() => {
    if (!isPaused && !isTimeUp && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsTimeUp(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, isTimeUp, timeRemaining]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || isPaused || isTimeUp) return;

    // Basic client-side hygiene: limit message size and frequency
    const now = Date.now();
    if (now - lastSendRef.current < 750) {
      return; // throttle rapid sends
    }
    if (inputMessage.length > 2000) {
      console.warn('Input too long; refusing to send');
      return;
    }

    // Validate sdd_id format (UUID v4 basic check) when available
    if (typeof caseData?.sdd_id === 'string') {
      const uuidRegex = /^[0-9a-fA-F-]{6,}$/; // lenient, avoids blocking if backend accepts non-uuid
      if (!uuidRegex.test(caseData.sdd_id)) {
        console.warn('Invalid sdd_id format; refusing to send');
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    if (import.meta.env.DEV) console.debug('[chat] add user message');
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      if (import.meta.env.DEV) console.debug('[chat] invoking edge function');
      
      const conversationHistory: ConversationHistory[] = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content
      }));

      // Choose the correct Edge Function based on station type using centralized manager
      const functionName = StationTypeManager.getChatFunctionName(caseData) || 'chat-with-patient';
      const stationType = StationTypeManager.getType(caseData);
      
      if (import.meta.env.DEV) console.debug(`[chat] function=${functionName} type=${stationType}`);

      // Both functions now use the same request format
      const requestBody = {
        sdd_id: caseData.sdd_id,
        userMessage: inputMessage,
        conversationHistory: conversationHistory
      };

      // Both functions use streaming SSE
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // Create placeholder assistant message for streaming
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                if (import.meta.env.DEV) console.debug('[chat] stream complete');
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  accumulatedContent += parsed.content;
                  // Update message content progressively
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  ));
                }
                if (parsed.error) {
                  console.error('Stream error:', parsed.error);
                }
              } catch {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }
      }

      // Fallback if no content was streamed
      if (!accumulatedContent) {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: "Je n'ai pas bien compris. Peux-tu reformuler ?" }
            : msg
        ));
      }

      if (import.meta.env.DEV) console.debug('[chat] streaming message complete');
    } catch (error) {
      console.error('Chat invocation failed');
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Désolé, je rencontre un problème technique. Pouvez-vous répéter votre question ?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      lastSendRef.current = Date.now();
    }
  }, [inputMessage, isLoading, isPaused, isTimeUp, messages, caseData]);

  // Fonction pour nettoyer les données sauvegardées et réinitialiser
  const resetStation = useCallback(() => {
    StorageManager.removeChatMessages(caseData.sdd_id);
    StorageManager.removeTimerState(caseData.sdd_id);
    
    // Réinitialiser l'état
    setTimeRemaining(10 * 60);
    setIsPaused(false);
    setIsTimeUp(false);
    setInputMessage("");
    
    // Remettre un tableau de messages vide
    setMessages([]);
  }, [caseData.sdd_id]);

  // Fonction pour nettoyer les données sauvegardées
  const clearSavedData = useCallback(() => {
    StorageManager.removeChatMessages(caseData.sdd_id);
    StorageManager.removeTimerState(caseData.sdd_id);
  }, [caseData.sdd_id]);

  return {
    messages,
    inputMessage,
    setInputMessage,
    isLoading,
    timeRemaining,
    isPaused,
    isTimeUp,
    togglePause,
    sendMessage,
    resetStation,
    clearSavedData
  };
};
