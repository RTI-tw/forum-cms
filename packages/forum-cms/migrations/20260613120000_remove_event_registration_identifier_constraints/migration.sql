-- Remove obsolete registration identifier constraints while keeping legacy data columns.
DROP INDEX IF EXISTS "EventRegistration_event_identityHash_key";
DROP INDEX IF EXISTS "EventRegistration_identityHash_idx";
DROP INDEX IF EXISTS "EventRegistration_phoneHash_idx";
