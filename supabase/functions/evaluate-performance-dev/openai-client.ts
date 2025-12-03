function validateEvaluationResult(result) {
  if (!result || typeof result !== 'object') return false;
  const requiredFields = [
    'score_clinique',
    'score_communication',
    'note_finale',
    'actions_reussies',
    'actions_manquees',
    'communication_details',
    'feedback'
  ];
  for (const field of requiredFields){
    if (!(field in result)) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }
  // Validate score ranges
  if (typeof result.score_clinique !== 'number' || result.score_clinique < 0) {
    console.error('Invalid score_clinique:', result.score_clinique);
    return false;
  }
  if (typeof result.score_communication !== 'number' || result.score_communication < 0) {
    console.error('Invalid score_communication:', result.score_communication);
    return false;
  }
  if (typeof result.note_finale !== 'number' || result.note_finale < 0 || result.note_finale > 20) {
    console.error('Invalid note_finale:', result.note_finale);
    return false;
  }
  if (!Array.isArray(result.actions_reussies) || !Array.isArray(result.actions_manquees)) {
    console.error('Invalid actions arrays');
    return false;
  }
  if (!result.communication_details || typeof result.communication_details !== 'object') {
    console.error('Invalid communication_details');
    return false;
  }
  if (typeof result.feedback !== 'string') {
    console.error('Invalid feedback');
    return false;
  }
  return true;
}
export async function callOpenAI(prompt) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        reasoning: {
          effort: "medium",
          summary: "auto"
        },
        store: true,
        include: [
          "reasoning.encrypted_content",
          "web_search_call.action.sources"
        ]
      })
    });
    if (!response.ok) {
      const error = await response.text();
      return {
        result: null,
        error: `Erreur API OpenAI: ${response.status} - ${error}`
      };
    }
    const data = await response.json();
    let evaluationResult = data.choices[0].message.content;
    // Clean markdown backticks if present (though GPT-5.1 with json_object should not include them)
    if (evaluationResult.includes('```json')) {
      evaluationResult = evaluationResult.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
    }
    try {
      const parsedResult = JSON.parse(evaluationResult);
      // Validate the structure and scores
      if (!validateEvaluationResult(parsedResult)) {
        console.error('Invalid evaluation result structure:', parsedResult);
        return {
          result: null,
          error: 'Structure d\'évaluation invalide retournée par l\'IA'
        };
      }
      return {
        result: parsedResult,
        error: null
      };
    } catch (parseError) {
      console.error('Error parsing evaluation result:', parseError);
      console.error('Cleaned result was:', evaluationResult);
      // Try to extract JSON from response more aggressively
      const jsonMatch = evaluationResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const fallbackResult = JSON.parse(jsonMatch[0]);
          if (validateEvaluationResult(fallbackResult)) {
            return {
              result: fallbackResult,
              error: null
            };
          }
        } catch (fallbackError) {
          console.error('Fallback parsing also failed:', fallbackError);
        }
      }
      return {
        result: null,
        error: 'Erreur lors de l\'analyse de l\'évaluation'
      };
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      result: null,
      error: error.message
    };
  }
}

