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
  const rootProperties: string[] = Object.keys(buildOptions).filter(key => key !== 'exclude' && key !== 'include' && Array.isArray(buildOptions[key]));
  const groupByKey: string | undefined = groupBy || rootProperties[0] || undefined;
  const exclude: Array<Record<string, string>> = Array.isArray(buildOptions.exclude) ? buildOptions.exclude : (buildOptions.exclude ? [buildOptions.exclude] : []);
  const include: Array<Record<string, string>> = Array.isArray(buildOptions.include) ? buildOptions.include : (buildOptions.include ? [buildOptions.include] : []);
  const values: Record<string, string[]> = {};
  for (const p of rootProperties) {
    values[p] = buildOptions[p] as string[];
  }
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
    // Check if all include entries have all rootProperties except groupByKey
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
              // Build a name from all properties except 'name' and groupByKey, with 'os' first if present
              const keys = Object.keys(job).filter(k => k !== 'name' && k !== groupByKey);
              const osIndex = keys.indexOf('os');
              if (osIndex > -1) {
                keys.splice(osIndex, 1);
                keys.unshift('os');
              }
              const nameParts = keys.map(k => job[k]);
              job.name = nameParts.join(' ');
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
        )
      );
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