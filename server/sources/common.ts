import { createHash } from 'node:crypto';
import type { Passage } from '../../shared/types';
import { AppError } from '../errors';
export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function sourcePassages(
  id: string,
  text: string,
  kind: 'abstract' | 'full-text' = 'abstract',
  section = 'Abstract',
): Passage[] {
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 12);
  return Array.from(
    new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text),
    (part, i) => ({
      id: `${id}:${kind}:${hash}:${i + 1}`,
      text: part.segment.trim(),
      kind,
      section,
    }),
  ).filter((p) => p.text);
}
export async function readSource(
  response: Response,
  label: string,
  limit = 8_000_000,
) {
  async function reject(status: number, message: string): Promise<never> {
    try {
      await response.body?.cancel();
    } catch {
      /* Keep the original safe error. */
    }
    throw new AppError(status, message);
  }
  if (response.status === 429)
    return reject(429, `${label} rate limit reached. Wait before retrying.`);
  if (!response.ok)
    return reject(
      502,
      `${label} returned an error (${response.status}). The search or retrieval is incomplete.`,
    );
  if (Number(response.headers.get('content-length')) > limit)
    return reject(502, `${label} response is too large to read safely.`);
  const reader = response.body?.getReader();
  if (!reader) throw new AppError(502, `${label} returned an empty response.`);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new AppError(
          502,
          `${label} response is too large to read safely.`,
        );
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts).toString('utf8');
}
