import * as core from '@actions/core';
import * as fs from 'fs';

const main = async () => {
  try {
    const buildOptionsPath = core.getInput('build-options', { required: true });
    const buildOptions: BuildOptions = JSON.parse(fs.readFileSync(buildOptionsPath, 'utf-8'));
    const groupBy: string | undefined = core.getInput('group-by');
    const jobNamePrefix: string | undefined = core.getInput('job-name-prefix');
    const jobs = generateJobsMatrix(buildOptions, groupBy, jobNamePrefix);
    core.info(JSON.stringify(jobs, null, 2));
    core.setOutput('jobs', JSON.stringify(jobs));
  } catch (error) {
    core.setFailed(error);
  }
}

main();

export interface BuildOptions {
  [key: string]: string[] | any;
  exclude?: Array<Record<string, string>>;
  include?: Array<Record<string, string>>;
}

export interface JobMatrix {
  jobs: Array<{
    name: string;
    matrix: { include: Array<Record<string, string>> };
  }>;
}

interface Job {
  name: string;
  matrix: {
    include: Array<Record<string, string>>;
  }
}

export function generateJobsMatrix(buildOptions: BuildOptions, groupBy: string | undefined, jobNamePrefix: string | undefined): JobMatrix {
  const props: string[] = Object.keys(buildOptions).filter(key => key !== 'exclude' && key !== 'include' && Array.isArray(buildOptions[key]));
  const values: Record<string, string[]> = {};
  for (const p of props) {
    values[p] = buildOptions[p] as string[];
  }
  if (props.length === 0 && Array.isArray(buildOptions.include)) {
    const exclude: Array<Record<string, string>> = Array.isArray(buildOptions.exclude) ? buildOptions.exclude : (buildOptions.exclude ? [buildOptions.exclude] : []);
    const jobs = (buildOptions.include as Array<Record<string, string>>).filter(job => !matchesExclusion(job, exclude));
    return {
      jobs: [
        {
          name: jobNamePrefix && jobNamePrefix.trim().length > 0 ? jobNamePrefix : 'job',
          matrix: { include: jobs }
        }
      ]
    };
  }
  const combinations: Array<Record<string, string>> = getCombinations(props, values);
  const exclude: Array<Record<string, string>> = Array.isArray(buildOptions.exclude) ? buildOptions.exclude : (buildOptions.exclude ? [buildOptions.exclude] : []);
  const jobs: Record<string, any[]> = {};
  const groupByKey: string = groupBy || props[0];
  for (const combination of combinations) {
    let includeProps = {};
    if (buildOptions.include) {
      const includeArr = Array.isArray(buildOptions.include)
        ? buildOptions.include
        : [buildOptions.include];
      const match = includeArr.find(e => typeof e === 'object' && e !== null && e.os === combination.os);
      if (match) {
        includeProps = { ...match };
      }
    }
    let jobName = props
      .filter(p => p !== groupByKey && values[p].length > 1)
      .map(p => combination[p])
      .join(' ');
    const includeKeys = Object.keys(includeProps);
    if (jobName === combination.os && includeKeys.length > 0) {
      jobName = `${includeKeys.map(k => `${includeProps[k]}`).join(' ')}`;
    }
    if (jobNamePrefix && jobNamePrefix.trim().length > 0) {
      jobName = `${jobNamePrefix} ${jobName}`;
    }
    const job = {
      name: jobName,
      ...combination,
      ...includeProps,
    };
    if (matchesExclusion(job, exclude)) {
      continue;
    }
    let group = combination[groupByKey];
    if (group === undefined && includeProps && includeProps[groupByKey]) {
      group = includeProps[groupByKey];
    }
    if (group === undefined) {
      throw new Error(`Group '${groupByKey}' is undefined for job: ${JSON.stringify(job)}`);
    }
    if (!jobs[group]) {
      jobs[group] = [];
    }
    jobs[group].push(job);
  }
  const jobsArray: Array<Job> = Object.entries(jobs).map(([group, jobs]) => ({
    name: jobNamePrefix && jobNamePrefix.trim().length > 0 ? `${jobNamePrefix} ${group}` : group,
    matrix: {
      include: jobs,
    },
  }));
  return { jobs: jobsArray };
}

function matchesExclusion(job: Record<string, string>, exclude: Array<Record<string, string>>): boolean {
  if (!exclude) return false;
  return exclude.some(rule =>
    Object.entries(rule).every(([k, v]) => job[k] === v)
  );
}

function getCombinations(props: string[], values: Record<string, string[]>): Array<Record<string, string>> {
  if (props.length === 0) return [{}];
  const [first, ...rest] = props;
  const restComb = getCombinations(rest, values);
  const result: Array<Record<string, string>> = [];
  for (const v of values[first]) {
    for (const comb of restComb) {
      result.push({ [first]: v, ...comb });
    }
  }
  return result;
}