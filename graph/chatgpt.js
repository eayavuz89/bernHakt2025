import { OpenAI } from 'openai';
import 'dotenv/config';
import { getNutriScoreForName } from './off.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// prompt: string content for the user message
// options: { model?, max_tokens?, temperature?, system? }
export async function chatWithGPT_old(prompt, options = {}) {
  try {
    const messages = [];
    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o',
      messages,
      max_tokens: options.max_tokens || 1200,
      temperature: options.temperature || 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error?.message || error);
    throw new Error('Failed to get response from ChatGPT');
  }
}

// Tool definitions to let the model fetch Nutri-Score data on demand
const nutriTools = [
  {
    type: 'function',
    function: {
      name: 'get_nutri_score',
      description: 'Look up Nutri-Score for a food product by name using Open Food Facts.',
      parameters: {
        type: 'object',
        properties: {
          product_name: { type: 'string', description: 'Product name to search in Open Food Facts' },
          brand: { type: 'string', description: 'Optional brand hint to improve matching' }
        },
        required: ['product_name']
      }
    }
  }
];

async function handleToolCall(toolCall) {
  try {
    const fn = toolCall.function?.name;
    const rawArgs = toolCall.function?.arguments || '{}';
    let args = {};
    try { args = JSON.parse(rawArgs); } catch { args = {}; }
    if (fn === 'get_nutri_score') {
      const name = args.product_name || '';
      const result = await getNutriScoreForName(name);
      return JSON.stringify(result || null);
    }
    return JSON.stringify({ error: `Unknown tool: ${fn}` });
  } catch (e) {
    return JSON.stringify({ error: e?.message || String(e) });
  }
}

// Chat with GPT allowing tool use for Nutri-Score. Falls back to plain chat if no tools are used.
export async function chatWithGPT(prompt, options = {}) {
  const messages = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });

  const model = options.model || 'gpt-4o';
  const maxTokens = options.max_tokens || 1200;
  const temperature = options.temperature || 0.7;

  let content = null;
  for (let step = 0; step < (options.maxToolRounds || 3); step++) {
    const resp = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      tools: nutriTools,
      tool_choice: 'auto'
    });
    const msg = resp.choices?.[0]?.message;
    if (!msg) break;

    // If the assistant requests tools, execute them and continue the loop
    if (msg.tool_calls && msg.tool_calls.length) {
      // Record assistant message that includes tool calls
      messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        const toolResult = await handleToolCall(tc);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
      }
      continue;
    }

    // Otherwise, we have a normal assistant message
    content = msg.content;
    break;
  }

  // Fallback: if the loop did not yield content, run a plain call
  if (content == null) {
    return chatWithGPT(prompt, options);
  }
  return content;
}
