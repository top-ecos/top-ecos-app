import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    console.log('📝 Save Results Mock - Request received');
    const requestBody = await req.json();
    console.log('📊 Mock save request data:', {
      sddId: requestBody.sddId,
      score: requestBody.score,
      timestamp: new Date().toISOString(),
      requestBody
    });
    // Simuler un délai de traitement
    await new Promise((resolve)=>setTimeout(resolve, 500));
    // Mock des données de réponse
    const mockResponse = {
      success: true,
      saved: true,
      resultId: `mock_result_${Date.now()}`,
      data: {
        sddId: requestBody.sddId,
        finalScore: requestBody.score || requestBody.note_finale,
        clinicalScore: requestBody.score_clinique,
        communicationScore: requestBody.score_communication,
        savedAt: new Date().toISOString(),
        sessionDuration: requestBody.sessionDuration || '8 minutes',
        stationType: requestBody.stationType || 'PS'
      },
      message: 'Résultats sauvegardés avec succès (simulation)'
    };
    console.log('✅ Mock response sent:', mockResponse);
    return new Response(JSON.stringify(mockResponse), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('❌ Mock save error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Erreur lors de la simulation de sauvegarde',
      details: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
