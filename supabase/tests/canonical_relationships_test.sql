BEGIN;
SELECT plan(2);

WITH foreign_keys AS (
  SELECT conrelid, confrelid, conkey
  FROM pg_constraint
  WHERE contype = 'f'
    AND connamespace = 'public'::regnamespace
)
SELECT is(
  (SELECT count(*)::integer
   FROM foreign_keys single_fk
   JOIN foreign_keys composite_fk
     ON composite_fk.conrelid = single_fk.conrelid
    AND composite_fk.confrelid = single_fk.confrelid
    AND array_length(composite_fk.conkey, 1) = 2
    AND composite_fk.conkey[1] = single_fk.conkey[1]
   WHERE array_length(single_fk.conkey, 1) = 1),
  0,
  'each logical relationship has one canonical foreign key'
);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_constraint constraint_record
   JOIN pg_class parent_table ON parent_table.oid = constraint_record.confrelid
   WHERE constraint_record.contype = 'f'
     AND constraint_record.connamespace = 'public'::regnamespace
     AND parent_table.relnamespace = 'public'::regnamespace
     AND parent_table.relname <> 'societies'
     AND array_length(constraint_record.conkey, 1) = 1),
  0,
  'domain relationships include society_id in their foreign key'
);

SELECT * FROM finish();
ROLLBACK;
