# Clean Old Daily Notes

This plugin cleans old daily notes by applying a set of transformations:

- Remove code blocks starting with `button`.
- Remove code blocks starting with `tasks`.
- Remove empty sections (a heading followed by only blank lines).

Notes are only cleaned if their filename contains a `YYYY-MM-DD` date that is
older than a configurable number of days (defaults to **7**). The cleanup runs
automatically once a day and can also be triggered manually from the command
palette using **Clean old daily notes**.

Run `npm run build` to compile.
