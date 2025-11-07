import { supabase } from "@/integrations/supabase/client";
import type { SDD } from "@/hooks/useSDD";

export class SimulationError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SimulationError';
    this.code = code;
  }
}

type Deps = {
  updateTokens: (count: number) => void;
  updateLastAttempt: (stationId: string) => Promise<any>;
  sanitizeMessage?: boolean;
};

const sanitizeMessage = (message: string | null | undefined): string => {
  if (!message) return '';
  return message.replace(/<[^>]*>/g, '').substring(0, 500);
};

export const startSimulation = async (sdd: SDD, deps: Deps) => {
  const { updateTokens, updateLastAttempt, sanitizeMessage: doSanitize } = deps;

  // Clear any existing state for a fresh run
  try {
    localStorage.removeItem(`chat_messages_${sdd.sdd_id}`);
    localStorage.removeItem(`timer_state_${sdd.sdd_id}`);
    localStorage.removeItem(`hasSeenConsignes_${sdd.sdd_id}`);
  } catch {}
  try {
    sessionStorage.removeItem('preloadedEvaluation');
  } catch {}

  // Consume a token server-side
  const { data: tokenResult, error: tokenError } = await supabase.functions.invoke('consume-token', {
    body: { sdd_id: sdd.sdd_id }
  });

  if (tokenError) {
    throw new SimulationError('Erreur lors de la consommation du token. Veuillez réessayer.', 'TOKEN_INVOKE_ERROR');
  }

  const result = tokenResult as any;
  if (!result?.success) {
    const code = result?.code;
    const errorMsg = result?.error || 'Token consumption failed';
    switch (code) {
      case 'CONCURRENT_UPDATE':
        throw new SimulationError("Quelqu'un d'autre utilise votre compte. Veuillez réessayer.", code);
      case 'INSUFFICIENT_TOKENS':
        if (result.requires_upgrade) {
          throw new SimulationError('Vous avez atteint la limite de votre compte gratuit. Veuillez passer à un abonnement premium.', 'INSUFFICIENT_TOKENS_UPGRADE');
        }
        throw new SimulationError('Tokens insuffisants. Veuillez attendre la recharge ou passer à un abonnement premium.', code);
      case 'SDD_NOT_FOUND':
        throw new SimulationError("Ce scénario n'est plus disponible.", code);
      default:
        throw new SimulationError(errorMsg, code || 'UNKNOWN_TOKEN_ERROR');
    }
  }

  // Update local profile token count
  updateTokens(result.tokens_remaining || 0);

  // Update last attempt timestamp
  await updateLastAttempt(sdd.sdd_id);

  // Initialize conversation
  const { data: initData, error: initError } = await supabase.functions.invoke('chat-with-patient', {
    body: {
      sdd_id: sdd.sdd_id,
      userMessage: 'INIT',
      conversationHistory: []
    }
  });

  if (initError) {
    throw new SimulationError("Erreur lors de l'initialisation de la conversation", 'CHAT_INIT_ERROR');
  }

  const initialMessage: string = (initData as any)?.message ?? '';

  // Fetch complete case data with least-privilege columns
  const { data: fullCaseData, error: fetchError } = await supabase
    .from('sdds')
    .select(`
      sdd_id,
      sdd_titre,
      consignes_etudiant,
      sdd_type,
      sdd_specialite,
      official_id,
      item_edn,
      include_documents,
      fiche_patient_prénom,
      fiche_patient_nom,
      lien_document_externe_1,
      lien_document_externe_2,
      lien_document_externe_3,
      lien_document_externe_4,
      lien_document_externe_5,
      created_at
    `)
    .eq('sdd_id', sdd.sdd_id)
    .single();

  let completeCase: any = sdd;
  if (!fetchError && fullCaseData) {
    completeCase = { ...sdd, ...fullCaseData };
  }

  // Persist in session for Simulation page
  try {
    sessionStorage.setItem('selectedCase', JSON.stringify(completeCase));
    const msg = doSanitize ? sanitizeMessage(initialMessage) : initialMessage;
    if (msg) sessionStorage.setItem('initialPatientMessage', msg);
  } catch {}

  return { initialMessage, completeCase, tokensRemaining: result.tokens_remaining };
};
