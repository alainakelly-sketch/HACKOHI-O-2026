export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  let data: T & { error?: string };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    throw new Error(
      'The PaperBridge server is not responding correctly. Start both the website and backend with npm run dev.',
    );
  }
  if (!response.ok)
    throw new Error(data.error || 'Request failed. Please retry.');
  return data;
}
