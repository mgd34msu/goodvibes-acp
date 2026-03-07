/**
 * @module memory
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Memory record types for the GoodVibes ACP runtime.
 * These types define the schema for cross-session persistent memory
 * stored in .goodvibes/memory/.
 */

// ---------------------------------------------------------------------------
// Decision record
// ---------------------------------------------------------------------------

/** Confidence level for a recorded decision */
export type DecisionConfidence = 'low' | 'medium' | 'high' | 'definitive';

/** Status of a recorded decision */
export type DecisionStatus = 'active' | 'superseded' | 'reverted';

/** A recorded architectural or implementation decision */
export type DecisionRecord = {
  /** Unique identifier */
  id: string;
  /** ISO 8601 date string */
  date: string;
  /** Category (e.g. "library", "architecture", "pattern") */
  category: string;
  /** What was decided */
  what: string;
  /** Why it was decided */
  why: string;
  /** Scope of impact (e.g. "project", "module", "session") */
  scope: string;
  /** Confidence level */
  confidence: DecisionConfidence;
  /** Current status */
  status: DecisionStatus;
  /** Optional related decision IDs */
  supersedes?: string[];
};

// ---------------------------------------------------------------------------
// Pattern record
// ---------------------------------------------------------------------------

/** A reusable implementation pattern worth remembering */
export type PatternRecord = {
  /** Unique identifier */
  id: string;
  /** Short name for the pattern */
  name: string;
  /** What the pattern does */
  description: string;
  /** When to apply this pattern */
  when_to_use: string;
  /** Paths to example files that demonstrate the pattern */
  example_files?: string[];
  /** Keywords for search */
  keywords: string[];
};

// ---------------------------------------------------------------------------
// Failure record
// ---------------------------------------------------------------------------

/** A recorded failure and its resolution, to prevent recurrence */
export type FailureRecord = {
  /** Unique identifier */
  id: string;
  /** ISO 8601 date string */
  date: string;
  /** Short error description or error code */
  error: string;
  /** What was being attempted when the failure occurred */
  context: string;
  /** Root cause analysis */
  root_cause: string;
  /** How it was resolved */
  resolution: string;
  /** How to prevent recurrence */
  prevention: string;
  /** Keywords for search */
  keywords: string[];
};

// ---------------------------------------------------------------------------
// Preference record
// ---------------------------------------------------------------------------

/** A user or project preference to respect across sessions */
export type PreferenceRecord = {
  /** Preference key (e.g. "code-style.semicolons") */
  key: string;
  /** Preference value */
  value: unknown;
  /** Why this preference was recorded */
  reason?: string;
  /** ISO 8601 date string when this preference was set */
  setAt?: string;
};

// ---------------------------------------------------------------------------
// Memory store shape
// ---------------------------------------------------------------------------

/** The complete shape of the persistent memory store */
export type MemoryStore = {
  /** Schema version for migration support */
  $schema: string;
  decisions: DecisionRecord[];
  patterns: PatternRecord[];
  failures: FailureRecord[];
  preferences: PreferenceRecord[];
};
