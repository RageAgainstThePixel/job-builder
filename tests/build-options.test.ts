import * as fs from 'fs';
import * as path from 'path';
import {
    generateJobsMatrix,
    BuildOptions
} from '../src/index';

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
            { prefix: 'include-only' }, // new test case for include-only, no groupBy
            // Add more test cases here as needed
        ];

    testCases.forEach(({ prefix, groupBy, jobNamePrefix }) => {
        const sourcePath = path.join(sourceDir, `${prefix}-build-options.json`);
        const expectedPath = path.join(expectedDir, `${prefix}-build-matrix.json`);
        it(`should match expected output for ${prefix}`, () => {
            const sourceJson: BuildOptions = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
            let expectedJson = {};
            let expectedExists = true;
            try {
                expectedJson = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
            } catch (e) {
                expectedExists = false;
            }
            const result = generateJobsMatrix(sourceJson, groupBy, jobNamePrefix);
            if (!expectedExists && prefix === 'unity-upm') {
                // Print the generated output for review
                // eslint-disable-next-line no-console
                console.log('Generated output for unity-upm:', JSON.stringify(result, null, 2));
            }
            expect(result).toEqual(expectedJson);
        });
    });
});
