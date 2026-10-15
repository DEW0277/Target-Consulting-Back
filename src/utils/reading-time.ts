/**
 * Minutes needed to read a blog post: ~200 words per minute, never less than 1.
 * Works for both the Markdown and the HTML the rich-text editor can produce.
 */
const WORDS_PER_MINUTE = 200;

export function readingTime(content: unknown): number | null {
  if (typeof content !== 'string' || !content.trim()) return null;
  const text = content
    .replace(/<[^>]*>/g, ' ') // HTML tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // Markdown images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Markdown links -> their text
    .replace(/[#>*_`~|-]+/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
