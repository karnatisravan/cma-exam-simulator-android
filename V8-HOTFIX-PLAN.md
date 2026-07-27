# V8 Question Bank Import Hotfix

The compatibility importer rejected the audited v22 database because optional text fields may be `null` and some records store classification in `sectionId` / `unitId` rather than legacy `section` / `unit` fields.

This hotfix will:

- treat `null` optional text as empty text;
- derive Section A–F from legacy and modern identifiers;
- derive `Unit N` from `unitId` where possible;
- permit archived/removed classification-review records to remain unassigned;
- keep active questions subject to strict section/unit validation;
- test the exact failure patterns reported by the user;
- rebuild and regression-test Windows and Android before merge.
