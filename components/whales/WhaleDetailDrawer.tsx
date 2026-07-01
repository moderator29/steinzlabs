// DEAD CODE — WhaleDetailDrawer has been retired.
//
// This component was never mounted anywhere in the app (it was only referenced
// in a comment) and it expected a stale `whale_activity` shape
// (from_address / to_address / value / direction / block_number) that no longer
// matches the current whale API. Keeping the implementation around risked it
// being re-wired against an incompatible contract.
//
// The file is intentionally emptied to an empty module so it compiles cleanly
// and no longer carries the stale type definitions. It should ideally be
// removed from git entirely.
export {};
