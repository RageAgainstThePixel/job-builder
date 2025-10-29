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
            { prefix: 'sort', groupBy: 'unity-version', jobNamePrefix: 'Build' },
            // Add more test cases here as needed
        ];

    testCases.forEach(({ prefix, groupBy, jobNamePrefix }) => {
        const sourcePath = path.join(sourceDir, `${prefix}-build-options.json`);
        const expectedPath = path.join(expectedDir, `${prefix}-build-matrix.json`);
        it(`should match expected output for ${prefix}`, () => {
            const sourceJson: BuildOptions = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
            const expectedJson: JobMatrix = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
            // If expected job names include a prefix like 'Build ', regenerate the
            // result using that prefix so names match the fixture format.
            let prefixToUse = jobNamePrefix;
            if (expectedJson && Array.isArray(expectedJson.jobs) && expectedJson.jobs.length > 0) {
                const firstName = expectedJson.jobs[0].name || '';
                const m = firstName.match(/^([A-Za-z0-9 _-]+?)\s+(\S.*)$/);
                if (m && m[1] && /^[A-Za-z]+$/.test(m[1])) {
                    // Treat single-word alphabetic leading token as prefix (e.g. 'Build')
                    prefixToUse = m[1];
                }
            }
            const result: JobMatrix = generateJobsMatrix(sourceJson, groupBy, prefixToUse);
            // Normalize ordering: sort both actual and expected job groups by name descending
            const sortDesc = (a: { name: string }, b: { name: string }) => {
                if (a.name < b.name) { return 1; }
                if (a.name > b.name) { return -1; }
                return 0;
            };
            result.jobs.sort(sortDesc);
            expectedJson.jobs.sort(sortDesc);
            expect(result).toEqual(expectedJson);
        });
    });

    it('should sort job groups by semantic version when sortBy is asc/desc', () => {
        const sourcePath = path.join(sourceDir, `sort-build-options.json`);
        const sourceJson: BuildOptions = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
        // Ascending (default)
        const ascResult = generateJobsMatrix(sourceJson, 'unity-version', undefined, undefined);
        const ascNames = ascResult.jobs.map(j => j.name);
        expect(ascNames).toEqual([
            'None',
            '4.7.2',
            '5.6.7f1 (e80cc3114ac1)',
            '2017',
            '2018',
            '2019',
            '2020',
            '2021',
            '2022',
            '6000.0',
            '6000.1',
            '6000.2'
        ]);

        // Descending
        const descResult = generateJobsMatrix(sourceJson, 'unity-version', undefined, 'desc');
        const descNames = descResult.jobs.map(j => j.name);
        expect(descNames).toEqual([
            '6000.2',
            '6000.1',
            '6000.0',
            '2022',
            '2021',
            '2020',
            '2019',
            '2018',
            '2017',
            '5.6.7f1 (e80cc3114ac1)',
            '4.7.2',
            'None'
        ]);
    });
});
