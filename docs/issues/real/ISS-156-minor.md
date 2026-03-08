# ISS-156: Double file read in test framework detection

**Source**: `src/plugins/project/test.ts` lines 103-127, 137-166
**KB Reference**: KB-06 (I/O Efficiency)
**Severity**: Minor

## Issue Description
`findTests` reads each test file twice: once via `detectFramework(filePath)` (line 104/138) and once inline for test counting (line 109-110). Both reads return the same content.

### Verdict: CONFIRMED

In `findTests` (line 98), for each test file:
- Line 104: `await this.detectFramework(filePath)` reads the file content internally (lines 138-139)
- Lines 109-110: The file is read again for `estimateTestCount(content)` and `extractSuites(content)`

Both reads use the same file system call (`readFile` or `this._fs.readTextFile`). This doubles I/O for every test file discovered.

## Remediation
1. Read the file once in `findTests` and pass the content to both `detectFramework` and the counting logic
2. Add a `detectFrameworkFromContent(content: string)` variant that accepts pre-read content
3. This halves the I/O cost of test discovery, which matters for large codebases with hundreds of test files
