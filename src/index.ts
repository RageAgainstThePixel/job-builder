import * as core from '@actions/core';
import * as fs from 'fs';
import {
  BuildOptions,
  Job,
  JobMatrix,
} from './types';

const main = async () => {
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

export function generateJobsMatrix(buildOptions: BuildOptions, groupBy: string | undefined, jobNamePrefix: string | undefined): JobMatrix {
  const rootProperties: string[] = getRootProperties(buildOptions);
  const groupByKey: string | undefined = groupBy || rootProperties[0] || undefined;
  const exclude: Array<Record<string, string>> = getArrayOrEmpty(buildOptions.exclude);
  const include: Array<Record<string, string>> = getArrayOrEmpty(buildOptions.include);
  const values: Record<string, string[]> = getValuesForProperties(rootProperties, buildOptions);

  if (rootProperties.length === 0 && Array.isArray(buildOptions.include)) {
    const jobs = include.filter(job => !matchesExclusion(job, exclude));
    return {
      jobs: [
        {
          name: jobNamePrefix && jobNamePrefix.trim().length > 0 ? jobNamePrefix : 'job',
          matrix: { include: jobs }
        }
      ]
    };
  }

  // Only use the special include × group-by logic if:
  // - include is present
  // - rootProperties.length > 0
  // - all include entries cover all rootProperties except one (the groupByKey)
  if (include.length > 0 && rootProperties.length > 0 && groupByKey) {
    const otherProps = rootProperties.filter(p => p !== groupByKey);
    const allIncludeCoverOtherProps = include.every(inc =>
      otherProps.every(p => Object.prototype.hasOwnProperty.call(inc, p))
    );

    if (allIncludeCoverOtherProps) {
      const groupByValues = values[groupByKey] || [];
      const jobsArray: Array<Job> = [];

      for (const groupValue of groupByValues) {
        const groupJobs: Array<Record<string, string>> = [];

        for (const inc of include) {
          const job = { ...inc, [groupByKey]: groupValue };

          if (!matchesExclusion(job, exclude)) {
            if (!job.name) {
              job.name = buildJobName(job, groupByKey, Object.keys(job));
            }
            groupJobs.push(job);
          }
        }

        jobsArray.push({
          name: jobNamePrefix && jobNamePrefix.trim().length > 0 ? `${jobNamePrefix} ${groupValue}` : groupValue,
          matrix: { include: groupJobs },
        });
      }

      return { jobs: jobsArray };
    }
  }

  const combinations: Array<Record<string, string>> = getCombinations(rootProperties, values);
  const jobs: Record<string, any[]> = {};

  for (const combination of combinations) {
    let includeProps = {};

    if (include.length > 0) {
      const matchingIncludes = include.filter(rule =>
        Object.entries(rule).every(([k, v]) =>
          combination[k] === undefined || combination[k] === v
        ));

      for (const rule of matchingIncludes) {
        includeProps = { ...includeProps, ...rule };
      }
    }

    let jobName = rootProperties
      .filter(p => (groupByKey !== undefined && p !== groupByKey) && values[p].length > 1)
      .map(p => combination[p])
      .join(' ');

    const includeKeys = Object.keys(includeProps);

    if (jobName === combination.os && includeKeys.length > 0) {
      jobName = `${includeKeys.map(k => `${includeProps[k]}`).join(' ')}`;
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
    }
  }));

  return { jobs: jobsArray };
}

function getRootProperties(buildOptions: BuildOptions): string[] {
  return Object.keys(buildOptions).filter(key =>
    key !== 'exclude' && key !== 'include' && Array.isArray(buildOptions[key])
  );
}

function getArrayOrEmpty<T>(value: T | T[] | undefined): T[] {
  if (Array.isArray(value)) { return value; }
  if (value) { return [value]; }
  return [];
}

function getValuesForProperties(props: string[], buildOptions: BuildOptions): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  for (const p of props) {
    values[p] = buildOptions[p] as string[];
  }
  return values;
}

function buildJobName(job: Record<string, string>, groupByKey: string, keys: string[]): string {
  const filteredKeys = keys.filter(k => k !== 'name' && k !== groupByKey);
  const osIndex = filteredKeys.indexOf('os');
  if (osIndex > -1) {
    filteredKeys.splice(osIndex, 1);
    filteredKeys.unshift('os');
  }
  const nameParts = filteredKeys.map(k => job[k]);
  return nameParts.join(' ');
}

function matchesExclusion(job: Record<string, string>, exclude: Array<Record<string, string>>): boolean {
  if (!exclude) { return false; }
  return exclude.some(rule =>
    Object.entries(rule).every(([k, v]) => job[k] === v)
  );
}

function getCombinations(props: string[], values: Record<string, string[]>): Array<Record<string, string>> {
  if (props.length === 0) { return [{}]; }
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