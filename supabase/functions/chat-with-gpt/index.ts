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
    console.log('Edge function called');
    const { messages, caseContext } = await req.json();
    console.log('Received messages:', messages);
    console.log('Case context:', caseContext);
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key not found');
    }
    console.log('OpenAI API key found, making request...');
    // Préparer le prompt système pour le contexte médical
    const systemPrompt = `Tu es un patient virtuel dans une simulation ECOS (Examen Clinique Objectif Structuré). 

Contexte du cas: ${caseContext}

Instructions:
- Réponds comme un vrai patient avec ce problème médical
- Sois réaliste dans tes symptômes et réponses
- Adapte-toi aux questions de l'étudiant
- Ne donne pas de diagnostic toi-même
- Reste dans le rôle du patient
- Réponds de manière naturelle et conversationnelle
- Limite tes réponses à 2-3 phrases maximum
- Réponds en français`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...messages
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });
    console.log('OpenAI response status:', response.status);
    const data = await response.json();
    console.log('OpenAI response data:', data);
    if (!response.ok) {
      console.error('OpenAI API error:', data);
      throw new Error(data.error?.message || 'OpenAI API error');
    }
    const aiMessage = data.choices[0]?.message?.content || "Je n'ai pas bien compris votre question.";
    console.log('AI message:', aiMessage);
    return new Response(JSON.stringify({
      message: aiMessage
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in chat-with-gpt function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      message: "Désolé, je rencontre un problème technique. Veuillez réessayer."
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
