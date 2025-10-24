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
    it('should produce only unique jobs in matrix', () => {
        const buildOptions: BuildOptions = {
            include: [
                { os: 'ubuntu-latest', 'build-targets': 'None', modules: 'None', 'unity-version': 'None', name: 'ubuntu-latest None None' },
                { os: 'ubuntu-latest', 'build-targets': 'None', modules: 'None', 'unity-version': 'None', name: 'ubuntu-latest None None' },
                { os: 'windows-latest', 'build-targets': 'None', modules: 'None', 'unity-version': 'None', name: 'windows-latest None None' },
                { os: 'macos-latest', 'build-targets': 'None', modules: 'None', 'unity-version': 'None', name: 'macos-latest None None' },
            ]
        };
        const result: JobMatrix = generateJobsMatrix(buildOptions, undefined, undefined);
        const jobs = result.jobs[0].matrix.include;
        // Build keys for each job using primitive properties
        const keys = jobs.map(job => {
            return Object.keys(job).sort().map(k => {
                const v = job[k];
                const t = typeof v;
                return (t === 'string' || t === 'number' || t === 'boolean') ? `${k}:${v}` : '';
            }).filter(Boolean).join('|');
        });
        // Check for duplicates
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(jobs.length);
    });
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
            { prefix: 'insert', groupBy: 'unity-version' },
            { prefix: 'all-versions', groupBy: 'unity-version', jobNamePrefix: 'Build' },
            // Add more test cases here as needed
        ];

    testCases.forEach(({ prefix, groupBy, jobNamePrefix }) => {
        const sourcePath = path.join(sourceDir, `${prefix}-build-options.json`);
        const expectedPath = path.join(expectedDir, `${prefix}-build-matrix.json`);
        it(`should match expected output for ${prefix}`, () => {
            const sourceJson: BuildOptions = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
            const result: JobMatrix = generateJobsMatrix(sourceJson, groupBy, jobNamePrefix);
            const expectedJson: JobMatrix = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
            expect(result).toEqual(expectedJson);
        });
    });
});
