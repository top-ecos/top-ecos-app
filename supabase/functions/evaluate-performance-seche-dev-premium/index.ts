import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateRequest, validateEnvironment } from './validation.ts';
import { fetchEvaluationDataSeche, buildExpectedActions, fetchFicheLisa } from './data-fetcher.ts';
import { buildConversationText, buildEvaluationPrompt, buildSystemMessage } from './prompt-builder.ts';
import { callOpenAI } from './openai-client.ts';
import { validateAndCorrectScores, generateFallbackEvaluation } from './evaluation-calculator.ts';
import { generateRecommendations, determinePerformanceLevel } from './recommendation-generator.ts';

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
    console.log('=== EVALUATION FUNCTION SECHE (GPT-5.1 DEV PREMIUM) STARTED ===');
    
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
    const systemMessage = buildSystemMessage();
    const userPrompt = buildEvaluationPrompt(requestBody.sddData, expectedActions, communicationSkills, conversationText);
    console.log('Evaluation prompt built');
    
    // Call OpenAI API with retry logic for main evaluation
    console.log('=== CALLING OPENAI API (GPT-5.1) FOR EVALUATION ===');
    let { result, error } = await callOpenAI(systemMessage, userPrompt);
    if (error || !result) {
      console.log('=== GENERATING FALLBACK EVALUATION ===');
      console.warn('OpenAI API failed, generating conservative fallback evaluation');
      result = generateFallbackEvaluation(expectedActions.length, communicationSkills.length, expectedActions);
    } else {
      // Validate and correct scores server-side
      console.log('=== VALIDATING AND CORRECTING SCORES ===');
      result = validateAndCorrectScores(result, expectedActions.length, communicationSkills.length);
    }
    
    console.log('=== EVALUATION COMPLETED ===');
    console.log('=== FINAL SCORES (AFTER SERVER-SIDE VALIDATION) ===');
    console.log(`Clinical: ${result.score_clinique}/${expectedActions.length}`);
    console.log(`Communication: ${result.score_communication}/${communicationSkills.length}`);
    console.log(`Final: ${result.note_finale}/20`);
    console.log(`Actions validated: ${result.actions_reussies.length}`);
    console.log(`Actions missed: ${result.actions_manquees.length}`);
    
    // PREMIUM FEATURE: Generate AI Recommendations for Seche Stations
    console.log('=== GENERATING AI RECOMMENDATIONS (PREMIUM) ===');
    const performanceLevel = determinePerformanceLevel(result.note_finale);
    console.log(`Performance level: ${performanceLevel}`);
    
    // Fetch Fiche Lisa content
    const { ficheLisaContent, ficheLisaTitle, stationContext } = await fetchFicheLisa(requestBody.sddData.sdd_id);
    
    let ai_recommendations = null;
    if (ficheLisaContent) {
      console.log(`Fiche Lisa found: "${ficheLisaTitle}"`);
      console.log(`Fiche Lisa content length: ${ficheLisaContent.length} characters`);
      
      ai_recommendations = await generateRecommendations(
        result,
        {
          title: stationContext.title || requestBody.sddData.sdd_titre || '',
          consignes: stationContext.consignes || requestBody.sddData.consignes_etudiant || ''
        },
        expectedActions,
        conversationText,
        ficheLisaContent,
        performanceLevel
      );
      
      if (ai_recommendations) {
        console.log('✅ AI Recommendations generated successfully');
        console.log(`Recommendations count: ${ai_recommendations.bullets?.length || 0}`);
      } else {
        console.warn('⚠️ AI Recommendations generation failed');
      }
    } else {
      console.warn('⚠️ No Fiche Lisa content available for this station');
    }
    
    // Add recommendations to result
    const finalResult = {
      ...result,
      ai_recommendations
    };
    
    console.log('=== EVALUATION SECHE (GPT-5.1 DEV PREMIUM) COMPLETED SUCCESSFULLY ===');
    console.log('Final result keys:', Object.keys(finalResult));
    console.log('Final scores:', {
      clinical: finalResult.score_clinique,
      communication: finalResult.score_communication,
      final: finalResult.note_finale
    });
    
    return new Response(JSON.stringify(finalResult), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('=== UNEXPECTED ERROR IN EVALUATION SECHE FUNCTION (GPT-5.1 DEV PREMIUM) ===');
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
