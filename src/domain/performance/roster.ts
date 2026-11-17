/**
 * Which scorecard a person gets, and under which lead, from their People
 * designation. Used to *propose* the scoring tree; a human reviews the
 * proposal before anything is written.
 *
 * Rules are deliberately narrow: anything that doesn't clearly fit returns
 * null and is reported rather than guessed (e.g. "Program Lead" roles, whose
 * scorecard hasn't been defined).
 */
export type Track = "TECH" | "DESIGN" | "MARKETING";

export type Classification =
  | { template: "Mentor"; track: Track }
  | { template: "SHO" | "SEM" | "Internship Coordinator" };

const is = (re: RegExp, s: string) => re.test(s);

const DESIGN = /design|brand|motion|\bui\b|\bux\b|uiux|graphic|video/;
const TECH = /\bweb\b|python|mern|developer|data|gen\s?ai|\bai\b|coding|software|full\s?stack|engineer/;
const MARKETING = /social media|content|google ads|\bseo\b|performance market|marketing|marketer/;

export function mentorTrack(designation: string): Track | null {
  const d = designation.toLowerCase();
  if (!is(/mentor|trainer|faculty/, d)) return null;
  // Design first ("Graphic Designer - Mentor"), then tech ("Web Developer &
  // SEO Mentor" is a web mentor), then marketing ("Google Ads and SEO Mentor").
  if (is(DESIGN, d)) return "DESIGN";
  if (is(TECH, d)) return "TECH";
  if (is(MARKETING, d)) return "MARKETING";
  return null;
}

export function classify(designation: string | null): Classification | null {
  if (!designation) return null;
  const d = designation.toLowerCase();
  if (is(/student happiness officer/, d)) return { template: "SHO" };
  if (is(/student experience manager/, d)) return { template: "SEM" };
  if (is(/internship coordinator/, d)) return { template: "Internship Coordinator" };
  const track = mentorTrack(designation);
  return track ? { template: "Mentor", track } : null;
}
