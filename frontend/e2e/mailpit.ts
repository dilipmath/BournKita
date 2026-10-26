// Mailpit catches the stack's outgoing email; its API lets tests read it.
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025'

/** The first link in the newest email to `to` whose URL contains `pathPart`, waiting for it. */
export async function linkFromEmail(to: string, pathPart: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    if (messages.length > 0) {
      const message = await fetch(`${mailpitUrl}/api/v1/message/${messages[0].ID}`)
      const { Text } = (await message.json()) as { Text: string }
      const link = Text.split(/\s+/).find((word) => /^https?:\/\//.test(word) && word.includes(pathPart))
      if (link) return link
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`No email with a ${pathPart} link reached ${to}`)
}
