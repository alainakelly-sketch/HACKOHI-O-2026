/** Editable discovery terms, not an AI interpretation of the question. */
const generic = new Set(
  'what which how why when where who is are was were a an the and or in on of to for from with by can could would should does do did may might will have has had i my we our me help research study studies field question gap gaps identify find explore investigate interested limitations limitation limited remain remains remaining unknown unanswered understand understanding future further additional work this that these those it its they their them such also some any another other authors author several including need needs needed still unclear'.split(
    ' ',
  ),
);
export function buildResearchQuery({
  field,
  question,
}: {
  field: string;
  question: string;
}) {
  const fieldTerms = field.trim().split(/\s+/).filter(Boolean);
  const seen = new Set(fieldTerms.map((t) => t.toLowerCase()));
  const keywords = (
    question.match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? []
  )
    .filter((t) => {
      const key = t.toLowerCase();
      if (generic.has(key) || seen.has(key) || t.length < 3) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
  return [...fieldTerms, ...keywords].join(' ').slice(0, 400);
}
