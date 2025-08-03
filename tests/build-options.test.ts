import * as fs from 'fs';
import * as path from 'path';
import {
    generateJobsMatrix,
} from '../src/generate-job-matrix';
import {
    BuildOptions,
    JobMatrix
} from '../src/types';

describe('build-options source/expected pairs', () => {
    const sourceDir = path.resolve(__dirname, 'source');
    const expectedDir = path.resolve(__dirname, 'expected');

    // Define test cases with their grouping and prefix
    const testCases: Array<{
        prefix: string,
        groupBy?: string,
        jobNamePrefix?: string
    }> = [
            { prefix: 'wsa', groupBy: 'unity-version', jobNamePrefix: 'Build' },
            { prefix: 'unity-setup', groupBy: 'os' },
            { prefix: 'unity-upm', groupBy: 'unity-version' },
            { prefix: 'include-only' },
            // Add more test cases here as needed
        ];

    testCases.forEach(({ prefix, groupBy, jobNamePrefix }) => {
        const sourcePath = path.join(sourceDir, `${prefix}-build-options.json`);
        const expectedPath = path.join(expectedDir, `${prefix}-build-matrix.json`);
        it(`should match expected output for ${prefix}`, () => {
            const sourceJson: BuildOptions = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
            const expectedJson = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
            const result: JobMatrix = generateJobsMatrix(sourceJson, groupBy, jobNamePrefix);
            expect(result).toEqual(expectedJson);
        });
    });
});
