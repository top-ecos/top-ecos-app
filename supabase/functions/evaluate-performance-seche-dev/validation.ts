export function validateRequest(request) {
  // Validation de base de la structure
  if (!request) {
    return {
      isValid: false,
      error: 'Request body is missing'
    };
  }
  // Validation des données SDD
  if (!request.sddData) {
    return {
      isValid: false,
      error: 'sddData is missing'
    };
  }
  if (!request.sddData.sdd_id || typeof request.sddData.sdd_id !== 'string') {
    return {
      isValid: false,
      error: 'sdd_id is missing or invalid'
    };
  }
  // Validation de l'historique de conversation
  if (!request.conversationHistory) {
    return {
      isValid: false,
      error: 'conversationHistory is missing'
    };
  }
  if (!Array.isArray(request.conversationHistory)) {
    return {
      isValid: false,
      error: 'conversationHistory must be an array'
    };
  }
  // Pour les stations sèches, on accepte même une conversation vide car il s'agit d'analyse de documents
  // Une conversation vide est normale pour les stations sèches
  if (request.conversationHistory.length === 0) {
    // Pour les stations sèches, on peut avoir une conversation vide - c'est normal
    console.log('Station sèche détectée avec conversation vide - validation acceptée');
  }
  // Validation de chaque message
  for (const message of request.conversationHistory){
    if (!message.role || !message.content) {
      return {
        isValid: false,
        error: 'Each message must have role and content'
      };
    }
    if (![
      'user',
      'assistant',
      'system'
    ].includes(message.role)) {
      return {
        isValid: false,
        error: 'Invalid message role'
      };
    }
    if (typeof message.content !== 'string' || message.content.trim().length === 0) {
      return {
        isValid: false,
        error: 'Message content must be a non-empty string'
      };
    }
  }
  return {
    isValid: true
  };
}
export function validateEnvironment() {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY'
  ];
  for (const envVar of requiredEnvVars){
    const value = globalThis.Deno?.env?.get(envVar);
    if (!value || value.trim().length === 0) {
      return {
        isValid: false,
        error: `Environment variable ${envVar} is missing or empty`
      };
    }
  }
  return {
    isValid: true
  };
}

