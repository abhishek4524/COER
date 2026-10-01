import 'dotenv/config';
import { callLLM } from '../src/services/llm.js';

async function test() {
  console.log('Testing callLLM with provider:', process.env.LLM_PROVIDER);
  console.log('Model:', process.env.OPENROUTER_MODEL);
  try {
    const res = await callLLM(
      'You are a UX tester.',
      'Decide your next action. Reply with JSON object containing action, thought, emotion, frustration.'
    );
    console.log('Result:', res);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
