
import {
    BuildOptions,
    Job,
    JobMatrix,
} from './types';

export function generateJobsMatrix(buildOptions: BuildOptions, groupBy: string | undefined, jobNamePrefix: string | undefined): JobMatrix {
    const rootProperties: string[] = getRootProperties(buildOptions);
    const groupByKey: string | undefined = groupBy || rootProperties[0] || undefined;
    const exclude: Array<Record<string, string>> = getArrayOrEmpty(buildOptions.exclude);
    const include: Array<Record<string, string>> = getArrayOrEmpty(buildOptions.include);
    const values: Record<string, string[]> = getValuesForProperties(rootProperties, buildOptions);

    if (rootProperties.length === 0 && Array.isArray(buildOptions.include)) {
        const jobs = include.filter(job => !matchesExclusion(job, exclude));
        const dedupedJobs = filterUniqueJobs(jobs);
        return {
            jobs: [
                {
                    name: jobNamePrefix && jobNamePrefix.trim().length > 0 ? jobNamePrefix : 'job',
                    matrix: { include: dedupedJobs }
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
            otherProps.every(p => {
                if (Object.prototype.hasOwnProperty.call(inc, p)) {
                    return true;
                }
                const propValues = values[p];
                return Array.isArray(propValues) && propValues.length === 1;
            })
        );

        if (allIncludeCoverOtherProps) {
            const groupByValues = values[groupByKey] || [];
            const jobsArray: Array<Job> = [];

            for (const groupValue of groupByValues) {
                const groupJobs: Array<Record<string, string>> = [];

                for (const inc of include) {
                    const job = { ...inc, [groupByKey]: groupValue };

                    for (const prop of otherProps) {
                        if (!Object.prototype.hasOwnProperty.call(job, prop)) {
                            const propValues = values[prop];
                            if (Array.isArray(propValues) && propValues.length === 1) {
                                job[prop] = propValues[0];
                            }
                        }
                    }

                    if (!matchesExclusion(job, exclude)) {
                        if (!job.name) {
                            job.name = buildJobName(job, groupByKey, Object.keys(job));
                        }
                        groupJobs.push(job);
                    }
                }

                const dedupedGroupJobs = filterUniqueJobs(groupJobs);
                jobsArray.push({
                    name: jobNamePrefix && jobNamePrefix.trim().length > 0 ? `${jobNamePrefix} ${groupValue}` : groupValue,
                    matrix: { include: dedupedGroupJobs },
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
            include: filterUniqueJobs(jobs),
        }
    }));

    return { jobs: jobsArray };
}

// Filter jobs to ensure uniqueness by stringifying their properties
function filterUniqueJobs(jobs: Array<Record<string, any>>): Array<Record<string, any>> {
    const jobMap = new Map<string, Record<string, any>>();
    for (const job of jobs) {
        const keyParts: string[] = [];
        for (const k of Object.keys(job).sort()) {
            const v = job[k];
            const t = typeof v;
            if (t === 'string' || t === 'number' || t === 'boolean') {
                keyParts.push(`${k}:${v}`);
            }
        }
        const key = keyParts.join('|');
        if (!jobMap.has(key)) {
            jobMap.set(key, job);
        }
    }
    return Array.from(jobMap.values());
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
    const filteredKeys = keys.filter(k => k !== 'name' && k !== groupByKey && k !== 'build-args');
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