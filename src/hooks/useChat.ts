
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStationType } from "@/lib/station";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export const useChat = (caseData: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10 * 60); // 10 minutes en secondes
  const [isPaused, setIsPaused] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const lastSendRef = useRef<number>(0);

  // Mémoriser les clés de stockage
  const storageKeys = useMemo(() => ({
    messages: `chat_messages_${caseData.sdd_id}`,
    timer: `timer_state_${caseData.sdd_id}`
  }), [caseData.sdd_id]);

  // Charger les messages sauvegardés
  useEffect(() => {
    const savedMessages = localStorage.getItem(storageKeys.messages);
    const savedTimer = localStorage.getItem(storageKeys.timer);
    
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      } catch (error) {
        console.error('Error loading saved messages:', error);
      }
    }

    if (savedTimer) {
      try {
        const { timeRemaining: savedTime, isPaused: savedPaused, isTimeUp: savedIsTimeUp } = JSON.parse(savedTimer);
        setTimeRemaining(savedTime);
        setIsPaused(savedPaused);
        setIsTimeUp(savedIsTimeUp);
      } catch (error) {
        console.error('Error loading saved timer:', error);
      }
    }

    // Si aucun message sauvegardé, initialiser avec un tableau vide
    if (!savedMessages) {
      setMessages([]);
    }
  }, [caseData, storageKeys]);

  // Sauvegarder les messages à chaque changement
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(storageKeys.messages, JSON.stringify(messages));
    }
  }, [messages, storageKeys.messages]);

  // Sauvegarder l'état du timer
  useEffect(() => {
    localStorage.setItem(storageKeys.timer, JSON.stringify({
      timeRemaining,
      isPaused,
      isTimeUp
    }));
  }, [timeRemaining, isPaused, isTimeUp, storageKeys.timer]);

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
      
      const conversationHistory = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content
      }));

      // Choose the correct Edge Function based on normalized station type
      const normalizedType = getStationType({
        sdd_type: caseData?.sdd_type,
        Type_de_station: caseData?.Type_de_station,
        type_de_station: caseData?.type_de_station,
      });
      
      // Check if we should use dev versions
      const useDevChat = import.meta.env.VITE_USE_DEV_CHAT === 'true';
      
      // Select function based on type and dev mode
      let functionName: string;
      if (normalizedType === 'PSS') {
        functionName = useDevChat ? 'chat-with-pss-dev' : 'chat-with-pss';
      } else {
        functionName = useDevChat ? 'chat-with-patient-dev' : 'chat-with-patient';
      }
      
      if (import.meta.env.DEV) console.debug(`[chat] function=${functionName} type=${normalizedType} dev=${useDevChat}`);

      // Different functions expect different data formats
      const requestBody = functionName.includes('pss') 
        ? {
            sddData: caseData,
            userMessage: inputMessage,
            conversationHistory: conversationHistory
          }
        : {
            sdd_id: caseData.sdd_id,
            userMessage: inputMessage,
            conversationHistory: conversationHistory
          };

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: requestBody
      });

      if (error) {
        console.error('Chat edge error');
        throw error;
      }

      const reply = typeof (data as any)?.message === 'string' && (data as any).message.trim() !== ''
        ? (data as any).message
        : "Je n'ai pas bien compris. Peux-tu reformuler ?";

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date()
      };

      if (import.meta.env.DEV) console.debug('[chat] add assistant message');
      setMessages(prev => [...prev, assistantMessage]);
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
    localStorage.removeItem(storageKeys.messages);
    localStorage.removeItem(storageKeys.timer);
    
    // Réinitialiser l'état
    setTimeRemaining(10 * 60);
    setIsPaused(false);
    setIsTimeUp(false);
    setInputMessage("");
    
    // Remettre un tableau de messages vide
    setMessages([]);
  }, [storageKeys, caseData]);

  // Fonction pour nettoyer les données sauvegardées
  const clearSavedData = useCallback(() => {
    localStorage.removeItem(storageKeys.messages);
    localStorage.removeItem(storageKeys.timer);
  }, [storageKeys]);

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
