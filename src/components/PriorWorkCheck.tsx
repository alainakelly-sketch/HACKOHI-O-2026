import { useEffect, useRef, useState } from 'react';
import type { PriorWork } from '../../shared/types';
import { api } from '../lib/api';
import { Busy, Notice } from './Primitives';
import './prior-work-check.css';

/** Explicit, free literature search. Never invoked automatically when a lead opens. */
export function PriorWorkCheck({
  initialQuery,
  field = '',
}: {
  initialQuery: string;
  field?: string;
}) {
  const [query, setQuery] = useState(() => initialQuery.slice(0, 400));
  const [result, setResult] = useState<PriorWork | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setQuery(initialQuery.slice(0, 400));
    setResult(null);
    setError('');
    setBusy(false);
    return () => controller.current?.abort();
  }, [initialQuery, field]);
  function editQuery(value: string) {
    controller.current?.abort();
    setQuery(value);
    setResult(null);
    setError('');
    setBusy(false);
  }
  async function search() {
    if (query.trim().length < 2 || busy) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await api<PriorWork>(
        '/api/prior-work/search',
        { question: query.trim(), field },
        current.signal,
      );
      if (!current.signal.aborted) setResult(response);
    } catch (failure) {
      if (!current.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Related-work search could not be completed. Please retry.',
        );
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="prior-work-check" aria-label="Check related prior work">
      <h3>Has related work already explored this?</h3>
      <p>
        Search the free-paper collections for your question before treating a
        lead as a research opportunity. No OpenAI request is made.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label>
          Prior-work search terms
          <input
            value={query}
            onChange={(event) => editQuery(event.target.value)}
            maxLength={400}
            placeholder="A question, dataset, method or possible explanation"
          />
        </label>
        <button
          className="secondary"
          disabled={busy || query.trim().length < 2}
        >
          {busy ? (
            <Busy>Checking related prior work</Busy>
          ) : result || error ? (
            'Check related prior work again'
          ) : (
            'Check related prior work'
          )}
        </button>
      </form>
      <p className="muted">
        The search uses these terms
        {field.trim()
          ? ` and a second search with your field, “${field.trim()}”.`
          : '.'}{' '}
        Edit them to test alternative wording. No close match does not establish
        novelty.
      </p>
      {error ? (
        <Notice error>
          {error} Search incomplete. Retry when the paper sources are available.
        </Notice>
      ) : null}
      {result ? (
        <div className="manual-prior-result">
          <strong role="status">{result.status}</strong>
          <h4>Searches performed</h4>
          <ul className="manual-prior-queries">
            {result.searches.map((search, index) => (
              <li key={`${index}:${search.query}`}>
                <code>{search.query}</code>
                {search.error ? <span>{search.error}</span> : null}
              </li>
            ))}
          </ul>
          <p>
            Search results are candidates for possible overlap, not verified
            matches. Compare the actual question, population, dataset, methods
            and findings before deciding how your idea differs.
          </p>
          <div className="manual-prior-papers">
            {result.matches.map(({ paper, overlap }) => (
              <article key={paper.id}>
                <a href={paper.url} target="_blank" rel="noreferrer">
                  <strong>{paper.title}</strong> ↗
                </a>
                <p className="muted">
                  {paper.year ?? 'Year unavailable'} · {paper.coverage}
                </p>
                <p>{overlap}</p>
                {paper.abstract ? (
                  <details>
                    <summary>Read available abstract</summary>
                    <p>{paper.abstract}</p>
                    <p className="muted">
                      Abstract only in this preview; this is not the complete
                      paper.
                    </p>
                  </details>
                ) : (
                  <p className="muted">
                    No abstract was available for this record. Open the source
                    to inspect the study.
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
