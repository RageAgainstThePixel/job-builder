import * as core from '@actions/core';
import * as fs from 'fs';

interface BuildOptions {
  [key: string]: string[] | any;
  exclude?: Array<Record<string, string>>;
}

interface Job {
  name: string;
  matrix: {
    include: Array<Record<string, string>>;
  }
}

const main = async () => {
  try {
    generateJobs();
  } catch (error) {
    core.setFailed(error);
  }
}

main();

function generateJobs(): void {
  const buildOptionsInputPath: string = core.getInput('build-options', { required: true });
  const buildOptions: BuildOptions = JSON.parse(fs.readFileSync(buildOptionsInputPath, 'utf8'));
  const props: string[] = Object.keys(buildOptions).filter(key => key !== 'exclude' && key !== 'include' && Array.isArray(buildOptions[key]));
  const values: Record<string, string[]> = {};
  for (const p of props) {
    values[p] = buildOptions[p] as string[];
  }
  const combinations: Array<Record<string, string>> = getCombinations(props, values);
  const exclude: Array<Record<string, string>> = Array.isArray(buildOptions.exclude) ? buildOptions.exclude : (buildOptions.exclude ? [buildOptions.exclude] : []);
  const jobs: Record<string, any[]> = {};
  const groupBy: string = core.getInput('group-by') || props[0];
  core.startGroup(`Generating jobs for group: ${groupBy}`);
  try {
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
        .filter(p => p !== groupBy && values[p].length > 1)
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
        core.debug(`Excluding job: ${JSON.stringify(job)}`);
        continue;
      }
      let group = combination[groupBy];
      if (group === undefined && includeProps && includeProps[groupBy]) {
        group = includeProps[groupBy];
      }
      if (group === undefined) {
        throw new Error(`Group '${groupBy}' is undefined for job: ${JSON.stringify(job)}`);
      }
      if (!jobs[group]) {
        jobs[group] = [];
      }
      jobs[group].push(job);
    }
  } finally {
    core.endGroup();
  }
  const jobsArray: Array<Job> = Object.entries(jobs).map(([group, jobs]) => ({
    name: getGroupName(group),
    matrix: {
      include: jobs,
    },
  }));
  const jobsJson = { jobs: jobsArray };
  core.info(JSON.stringify(jobsJson, null, 2));
  core.setOutput('jobs', JSON.stringify(jobsJson));
}

function getGroupName(group: string): string {
  const prefix: string = core.getInput('job-name-prefix');
  if (prefix && prefix.trim().length > 0) {
    return `${prefix} ${group}`;
  } else {
    return group;
  }
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