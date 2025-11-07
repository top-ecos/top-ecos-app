export function validateRequest(requestBody) {
  if (!requestBody.sddData || !requestBody.sddData.sdd_id) {
    return {
      isValid: false,
      error: 'Données de la station manquantes'
    };
  }
  if (!requestBody.conversationHistory || requestBody.conversationHistory.length === 0) {
    return {
      isValid: false,
      error: 'Historique de conversation manquant'
    };
  }
  return {
    isValid: true
  };
}
export function validateEnvironment() {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    return {
      isValid: false,
      error: 'Clé API OpenAI non configurée'
    };
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    return {
      isValid: false,
      error: 'Configuration Supabase manquante'
    };
  }
  return {
    isValid: true
  };
}
