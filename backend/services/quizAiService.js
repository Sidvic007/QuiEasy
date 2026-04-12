const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const HUGGINGFACE_BASE_URL = 'https://api-inference.huggingface.co/models';

const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const OPENROUTER_FALLBACK_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
];
const DEFAULT_HUGGINGFACE_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';

function extractJsonPayload(text) {
  if (!text || typeof text !== 'string') return null;
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) return null;

  const candidate = text.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch (_err) {
    return null;
  }
}

function buildPrompt({ title, prompt, context, questionCount }) {
  return [
    'Generate a quiz as strict JSON only. No markdown, no explanations.',
    `Quiz title: ${title || 'General Knowledge Quiz'}`,
    `Question count: ${questionCount}`,
    'Allowed question types: multiple_choice, true_false, word_cloud.',
    'Output shape:',
    '{"title":"string","description":"string","questions":[{"type":"multiple_choice|true_false|word_cloud","text":"string","timeLimit":30,"points":100,"options":[{"text":"string","isCorrect":true}]}]}',
    'Rules:',
    '- multiple_choice must have 2-6 options and exactly one isCorrect=true',
    '- true_false must include options True and False, with exactly one correct',
    '- word_cloud must have an empty options array',
    '- timeLimit must be between 10 and 120 seconds',
    '- points should be 50 to 300 for scored questions; 0 for word_cloud',
    '',
    `User prompt: ${prompt}`,
    context ? `Context: ${context}` : '',
  ].filter(Boolean).join('\n');
}

async function callOpenRouter({ prompt, context, questionCount, title }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const configured = (process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL).trim();
  const candidates = [configured, ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== configured)];

  let lastError = null;

  for (const model of candidates) {
    const body = {
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are a quiz generator that returns valid JSON only.' },
        { role: 'user', content: buildPrompt({ title, prompt, context, questionCount }) },
      ],
    };

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:3000',
        'X-Title': 'QuiEasy Quiz Generator',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const shouldFallback =
        (response.status === 404 && errorText.includes('No endpoints found'))
        || response.status === 429
        || response.status === 503;
      if (shouldFallback) {
        lastError = new Error(`OpenRouter model unavailable: ${model}`);
        continue;
      }
      throw new Error(`OpenRouter request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    const parsed = extractJsonPayload(text);

    if (!parsed) {
      lastError = new Error(`OpenRouter returned invalid JSON payload for model: ${model}`);
      continue;
    }

    return { provider: 'openrouter', model, draft: parsed };
  }

  throw lastError || new Error('OpenRouter request failed for all candidate models');
}

async function callHuggingFace({ prompt, context, questionCount, title }) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is not configured');
  }

  const model = process.env.HUGGINGFACE_MODEL || DEFAULT_HUGGINGFACE_MODEL;
  const response = await fetch(`${HUGGINGFACE_BASE_URL}/${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: buildPrompt({ title, prompt, context, questionCount }),
      parameters: {
        max_new_tokens: 1400,
        temperature: 0.7,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HuggingFace request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
  const parsed = extractJsonPayload(text);

  if (!parsed) {
    throw new Error('HuggingFace returned an invalid JSON payload');
  }

  return { provider: 'huggingface', model, draft: parsed };
}

async function generateQuizDraft(params) {
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await callOpenRouter(params);
    } catch (openRouterError) {
      if (process.env.HUGGINGFACE_API_KEY) {
        return callHuggingFace(params);
      }
      throw openRouterError;
    }
  }

  if (process.env.HUGGINGFACE_API_KEY) {
    return callHuggingFace(params);
  }

  throw new Error('Configure OPENROUTER_API_KEY or HUGGINGFACE_API_KEY to use AI generation');
}

module.exports = { generateQuizDraft };
