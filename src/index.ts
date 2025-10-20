import * as core from '@actions/core';
import * as fs from 'fs';
import {
  BuildOptions,
  JobMatrix,
} from './types';
import {
  generateJobsMatrix
} from './generate-job-matrix';

async function main() {
  try {
    const buildOptionsPath = core.getInput('build-options', { required: true });
    const buildOptions: BuildOptions = JSON.parse(fs.readFileSync(buildOptionsPath, 'utf-8'));
    const groupBy: string | undefined = core.getInput('group-by');
    const jobNamePrefix: string | undefined = core.getInput('job-name-prefix');
    const jobs: JobMatrix = generateJobsMatrix(buildOptions, groupBy, jobNamePrefix);
    core.info(JSON.stringify(jobs, null, 2));
    core.setOutput('jobs', JSON.stringify(jobs));
  } catch (error) {
    core.setFailed(error);
  }
}

main();
