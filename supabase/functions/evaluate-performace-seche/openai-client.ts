export async function callOpenAI(prompt) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    return {
      result: null,
      error: 'OpenAI API key not found'
    };
  }
  const maxRetries = 3;
  let lastError = null;
  for(let attempt = 1; attempt <= maxRetries; attempt++){
    try {
      console.log(`OpenAI API call attempt ${attempt}/${maxRetries}`);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            {
              role: 'system',
              content: 'Tu es un évaluateur expert pour les stations ECOS sèches. Tu dois retourner UNIQUEMENT du JSON valide, sans aucun texte additionnel.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 2500
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error (attempt ${attempt}):`, response.status, errorText);
        lastError = new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        if (attempt < maxRetries) {
          await new Promise((resolve)=>setTimeout(resolve, 1000 * attempt));
          continue;
        }
        break;
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new Error('No content in OpenAI response');
        if (attempt < maxRetries) {
          await new Promise((resolve)=>setTimeout(resolve, 1000 * attempt));
          continue;
        }
        break;
      }
      console.log('Raw OpenAI response:', content);
      // Nettoyer et parser le JSON
      let cleanedContent = content.trim();
      // Supprimer les blocs de code markdown si présents
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/```\n?/, '').replace(/\n?```$/, '');
      }
      cleanedContent = cleanedContent.trim();
      try {
        const result = JSON.parse(cleanedContent);
        console.log('Successfully parsed OpenAI response');
        return {
          result,
          error: null
        };
      } catch (parseError) {
        console.error(`JSON parsing error (attempt ${attempt}):`, parseError);
        console.error('Content that failed to parse:', cleanedContent);
        lastError = parseError;
        if (attempt < maxRetries) {
          await new Promise((resolve)=>setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
    } catch (fetchError) {
      console.error(`Network error (attempt ${attempt}):`, fetchError);
      lastError = fetchError;
      if (attempt < maxRetries) {
        await new Promise((resolve)=>setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }
  console.error('All OpenAI API attempts failed');
  return {
    result: null,
    error: lastError
  };
}
