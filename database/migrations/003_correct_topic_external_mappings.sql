UPDATE tags
SET external_scheme = 'internal-curated-from-IPTC', external_id = 'medtop:11000000'
WHERE id = 'topic-politics';

UPDATE tags
SET external_scheme = 'internal-curated-from-IPTC', external_id = 'medtop:04000000'
WHERE id = 'topic-economy';

UPDATE tags
SET external_scheme = 'internal-curated-from-IPTC', external_id = 'medtop:13000000'
WHERE id = 'topic-science';

UPDATE tags
SET external_scheme = 'internal-curated-from-IPTC', external_id = 'medtop:20000756'
WHERE id = 'topic-technology';

UPDATE tags
SET external_scheme = 'IPTC Media Topics', external_id = 'medtop:20000002'
WHERE id = 'topic-arts-entertainment';

UPDATE tags
SET external_scheme = 'internal-curated-from-IPTC', external_id = 'medtop:02000000'
WHERE id = 'topic-law-justice';
