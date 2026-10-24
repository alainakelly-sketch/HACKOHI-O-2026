import rawPapers from './network-ecology-papers.json';
import { validateAnalysis } from '../evidence-validation';
import type { Analysis, Brief, Paper } from '../../shared/types';
export const examplePapers = rawPapers as Paper[];
const [architecture, ecology, percolation, attacks] = examplePapers;
function ref(paper: Paper, begins: string) {
  const passage = paper.passages.find((p) => p.text.startsWith(begins));
  if (!passage)
    throw new Error('Saved example source passage no longer matches.');
  return { paperId: paper.id, passageId: passage.id };
}
export const exampleBrief: Brief = {
  question:
    'Can network-removal simulations help compare vulnerability across ecological interaction types?',
  fieldA: 'Network science',
  fieldB: 'Ecology',
  resources: {
    data: 'Public ecological networks, if access and licensing permit',
    equipment: 'Laptop',
    skills: 'Basic Python and graph analysis',
    deadline: 'One-day exploratory prototype',
  },
};
// MANUALLY PREPARED EXAMPLE. No model request produced this analysis.
// Source records/abstracts retrieved from OpenAlex on the dates stored in the JSON.
// Interpretation remains untested, including whether these papers already contain the proposed test.
const prepared = validateAnalysis(
  {
    status: 'connections',
    summary:
      'Saved, manually prepared example: network-removal ideas may help explore ecological robustness, but interaction type matters. This is not a live model response or a claim of novelty.',
    hypotheses: [
      {
        id: 'network-ecology-1',
        title: 'Compare removal sensitivity across interaction layers',
        hypothesis:
          'The contrast between random and high-degree species removal may vary by ecological interaction layer. A small simulation can test this as a structural proxy, not a prediction of real extinctions.',
        contributionA:
          'The network-science abstracts describe random/targeted deletion and percolation models for reasoning about connectivity and resilience.',
        contributionB:
          'The ecology abstracts report interaction-dependent architecture and that connections between interaction layers affect their robustness interdependence.',
        transfer:
          'Try the random-versus-targeted removal comparison on typed ecological interaction layers. Whether connectivity captures ecological persistence is an assumption to test, not a statement established by these passages.',
        evidence: [
          ref(percolation, 'Recent work'),
          ref(attacks, 'However, error tolerance'),
          ref(ecology, 'The way in which'),
          ref(architecture, 'A highly connected'),
        ],
        assumptions: [
          'Edges and their interaction types are sufficiently well measured for a structural comparison.',
          'A graph-removal proxy is useful for an initial exploratory question, though it does not model population dynamics.',
          'The selected network-science results may not carry over to directed, weighted, or multilayer ecological graphs.',
        ],
        incompatibilities: [
          'The ecology abstract reports different stabilizing architectures for trophic and mutualistic networks; a single connectivity rule may not transfer across them.',
          'Connectivity of communication networks is not equivalent to persistence of ecological populations.',
        ],
        unknowns: [
          'Only abstracts were retrieved. Full methods, licenses, data availability and implementation details still need review.',
          'These papers may already investigate this comparison. Search and read related work before treating it as a new idea.',
          'The direction and size of any difference between interaction layers are not established.',
        ],
        requirements: [
          {
            category: 'data',
            term: 'tripartite ecological networks',
            evidence: ref(ecology, 'We studied the structural'),
          },
        ],
        experiment: {
          question:
            'Does the random-versus-targeted removal contrast differ across ecological interaction layers in a small accessible network?',
          data: 'Locate one openly usable network with typed interactions and document its license, missing edges, and directionality. The cited abstract describes tripartite ecological networks; it does not establish that its data are available to this team.',
          method:
            'As a proposed first test, represent the interaction layers as graphs. Remove species in random order and in descending initial-degree order. Track each layer separately and record modelling choices. Run only a manually reviewed graph simulation, not a biological experiment.',
          baseline:
            'Compare targeted removal with repeated random-removal orderings on the same graph. If time permits, add degree-preserving rewired graphs as a proposed structural control.',
          measure:
            'Compare remaining connectivity curves across layers, including the largest connected component as a structural proxy. Report uncertainty across random orderings and avoid treating connectivity as population survival.',
          against:
            'If the layer differences are absent, unstable under plausible missing-edge changes, or indistinguishable from the control comparison, that counts against the proposed transfer. A mismatch between connectivity and known ecological behaviour also undermines the proxy.',
        },
      },
    ],
  },
  examplePapers,
);
export const exampleAnalysis: Analysis = {
  ...prepared,
  origin: 'saved-example',
};
