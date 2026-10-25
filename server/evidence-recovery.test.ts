// SYNTHETIC mutations of stored example fixtures. No network or model requests.
import { describe, it, expect } from 'vitest';
import {
  recoverSupportedAnalysis,
  validateAnalysis,
  AnalysisValidationError,
} from './evidence-validation';
import { exampleAnalysis, examplePapers } from './examples/network-ecology';
const fresh = () => structuredClone(exampleAnalysis);
describe('supported hypothesis recovery', () => {
  it('preserves strict validator rejection while safely dropping unsupported optional resource requirements', () => {
    const value = fresh();
    value.hypotheses[0].requirements = [
      {
        category: 'equipment',
        term: 'SYNTHETIC invented microscope',
        evidence: value.hypotheses[0].evidence[0],
      },
    ];
    expect(() => validateAnalysis(value, examplePapers)).toThrow();
    const output = recoverSupportedAnalysis(value, examplePapers);
    expect(output.hypotheses[0].requirements).toEqual([]);
    expect(output.hypotheses[0].unknowns.join(' ')).toContain(
      'Resource feasibility is unknown',
    );
    expect(output.summary).toContain('optional resource claims were omitted');
  });
  it('retains a valid hypothesis when its neighbor has invented core source references', () => {
    const value = fresh();
    const valid = structuredClone(value.hypotheses[0]);
    valid.id = 'synthetic-valid';
    const bad = structuredClone(valid);
    bad.id = 'synthetic-bad';
    bad.evidence[0] = {
      paperId: 'SYNTHETIC_UNKNOWN',
      passageId: 'SYNTHETIC_UNKNOWN',
    };
    value.hypotheses = [valid, bad];
    const result = recoverSupportedAnalysis(value, examplePapers);
    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0].id).toBe('synthetic-valid');
    expect(result.summary).toContain('Validation warning');
  });
  it.each(['paper', 'passage', 'single-source'] as const)(
    'rejects all-invalid %s evidence with safe typed diagnostics',
    (kind) => {
      const value = fresh();
      value.hypotheses = [value.hypotheses[0]];
      const refs = value.hypotheses[0].evidence;
      if (kind === 'paper') refs[0].paperId = 'DO_NOT_ECHO_RAW_SECRET';
      else if (kind === 'passage') refs[0].passageId = 'DO_NOT_ECHO_RAW_SECRET';
      else value.hypotheses[0].evidence = [refs[0], refs[0]];
      let error: unknown;
      try {
        recoverSupportedAnalysis(value, examplePapers);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(AnalysisValidationError);
      const typed = error as AnalysisValidationError;
      expect(typed.diagnostics[0].code).toBe(
        kind === 'paper'
          ? 'unknown-paper'
          : kind === 'passage'
            ? 'unknown-passage'
            : 'insufficient-sources',
      );
      expect(JSON.stringify(typed.diagnostics) + typed.message).not.toContain(
        'DO_NOT_ECHO_RAW_SECRET',
      );
    },
  );
  it('wraps malformed outputs and inconsistent outcomes in safe typed errors', () => {
    for (const value of [
      null,
      { status: 'DO_NOT_ECHO_RAW_SECRET' },
      { ...fresh(), status: 'insufficient' },
      { ...fresh(), hypotheses: [] },
    ])
      expect(() => recoverSupportedAnalysis(value, examplePapers)).toThrow(
        AnalysisValidationError,
      );
  });
  it('does not fill in malformed hypothesis fields or invent evidence', () => {
    const value = fresh();
    value.hypotheses[0].title = '';
    value.hypotheses = [value.hypotheses[0]];
    expect(() => recoverSupportedAnalysis(value, examplePapers)).toThrow(
      AnalysisValidationError,
    );
  });
  it('keeps unknowns bounded and explicitly labels discarded requirements even at the limit', () => {
    const value = fresh();
    value.hypotheses[0].unknowns = Array.from(
      { length: 8 },
      (_, i) => `Synthetic unknown ${i}`,
    );
    value.hypotheses[0].requirements = [
      {
        category: 'data',
        term: 'UNKNOWN',
        evidence: { paperId: 'UNKNOWN', passageId: 'UNKNOWN' },
      },
    ];
    const result = recoverSupportedAnalysis(value, examplePapers);
    expect(result.hypotheses[0].unknowns).toHaveLength(8);
    expect(result.hypotheses[0].unknowns[7]).toContain(
      value.hypotheses[0].unknowns[7],
    );
    expect(result.hypotheses[0].unknowns[7]).toContain(
      'Resource feasibility is unknown',
    );
    expect(() => validateAnalysis(result, examplePapers)).not.toThrow();
  });
  it('retains a source-supported resource requirement unchanged', () => {
    const value = fresh();
    const ref = value.hypotheses[0].evidence[0];
    const paper = examplePapers.find((p) => p.id === ref.paperId)!;
    const term = paper.passages
      .find((p) => p.id === ref.passageId)!
      .text.slice(0, 30);
    value.hypotheses[0].requirements = [
      { category: 'data', term, evidence: ref },
    ];
    expect(
      recoverSupportedAnalysis(value, examplePapers).hypotheses[0].requirements,
    ).toEqual(value.hypotheses[0].requirements);
  });
});
