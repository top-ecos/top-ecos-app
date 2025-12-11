import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateRequest, validateEnvironment } from './validation.ts';
import { fetchEvaluationDataSeche, buildExpectedActions } from './data-fetcher.ts';
import { buildConversationText, buildEvaluationPrompt } from './prompt-builder.ts';
import { callOpenAI } from './openai-client.ts';
import { validateAndCorrectScores, generateFallbackEvaluation } from './evaluation-calculator.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    console.log('=== EVALUATION FUNCTION SECHE STARTED ===');
    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully');
      console.log('Request body keys:', Object.keys(requestBody));
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Validate request
    console.log('=== VALIDATING INPUT DATA ===');
    const requestValidation = validateRequest(requestBody);
    if (!requestValidation.isValid) {
      console.error('Request validation failed:', requestValidation.error);
      return new Response(JSON.stringify({
        error: requestValidation.error
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Input validation passed');
    console.log('Station ID:', requestBody.sddData.sdd_id);
    console.log('Conversation messages:', requestBody.conversationHistory.length);
    // Validate environment
    console.log('=== CHECKING ENVIRONMENT VARIABLES ===');
    const envValidation = validateEnvironment();
    if (!envValidation.isValid) {
      console.error('Environment validation failed:', envValidation.error);
      return new Response(JSON.stringify({
        error: envValidation.error
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Environment validation passed');
    // Fetch evaluation data from Type C tables
    console.log('=== FETCHING EVALUATION CRITERIA FOR SECHE STATION ===');
    const { data: evaluationData, communicationSkills, error: evalError } = await fetchEvaluationDataSeche(requestBody.sddData.sdd_id);
    if (evalError) {
      console.error('Error fetching evaluation criteria:', evalError);
      return new Response(JSON.stringify({
        error: `Erreur lors de la récupération des critères: ${evalError.message}`
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!evaluationData) {
      console.error('No evaluation data found for station:', requestBody.sddData.sdd_id);
      return new Response(JSON.stringify({
        error: 'Critères d\'évaluation non trouvés pour cette station sèche'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Evaluation data found for seche station');
    console.log('Communication skills found:', communicationSkills.length);
    // Build expected actions
    console.log('=== BUILDING EXPECTED ACTIONS ===');
    const expectedActions = buildExpectedActions(evaluationData);
    console.log('Expected actions found:', expectedActions.length);
    // Build conversation text and evaluation prompt
    console.log('=== BUILDING EVALUATION PROMPT ===');
    const conversationText = buildConversationText(requestBody.conversationHistory);
    const evaluationPrompt = buildEvaluationPrompt(requestBody.sddData, expectedActions, communicationSkills, conversationText);
    console.log('Evaluation prompt built');
    // Call OpenAI API with retry logic
    console.log('=== CALLING OPENAI API ===');
    let { result, error } = await callOpenAI(evaluationPrompt);
    if (error || !result) {
      console.log('=== GENERATING FALLBACK EVALUATION ===');
      console.warn('OpenAI API failed, generating conservative fallback evaluation');
      result = generateFallbackEvaluation(expectedActions.length, communicationSkills.length, expectedActions);
    } else {
      // Validate and correct scores server-side
      console.log('=== VALIDATING AND CORRECTING SCORES ===');
      result = validateAndCorrectScores(result, expectedActions.length, communicationSkills.length);
    }
    console.log('=== EVALUATION SECHE COMPLETED SUCCESSFULLY ===');
    console.log('Final result keys:', Object.keys(result));
    console.log('Final scores:', {
      clinical: result.score_clinique,
      communication: result.score_communication,
      final: result.note_finale
    });
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('=== UNEXPECTED ERROR IN EVALUATION SECHE FUNCTION ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error type:', error.constructor.name);
    return new Response(JSON.stringify({
      error: error.message,
      type: error.constructor.name
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
