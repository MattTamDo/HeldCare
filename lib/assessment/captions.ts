const DISCLAIMER =
  /not medical (advice|care|guidance)|healthcare professional|seek care|hackathon demonstration/i;

export function cleanCaption(text: string): string {
  return text.replace(/\*+/g, " ").replace(/\s+/g, " ").trim();
}

export function isDisclaimerCaption(text: string): boolean {
  return DISCLAIMER.test(text);
}

export function splitSpokenSentences(text: string): {
  done: string[];
  open: string;
} {
  const cleaned = cleanCaption(text);
  if (!cleaned) return { done: [], open: "" };

  const done: string[] = [];
  let start = 0;
  const breaks = /[.!?…]+(?:\s+|$)/g;
  let match = breaks.exec(cleaned);
  while (match) {
    const sentence = cleaned.slice(start, match.index + match[0].length).trim();
    if (sentence) done.push(sentence);
    start = match.index + match[0].length;
    match = breaks.exec(cleaned);
  }

  return { done, open: cleaned.slice(start).trim() };
}
