import 'dotenv/config'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('Missing OPENAI_API_KEY in environment')
  }

  const result = streamText({
    model: openai('gpt-4.1'),
    prompt: 'Invent a new holiday and describe its traditions.',
  })

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart)
  }

  console.log()
  console.log('Token usage:', await result.usage)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
