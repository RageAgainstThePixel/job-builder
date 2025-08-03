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

export interface Job {
    name: string;
    matrix: {
        include: Array<Record<string, string>>;
    }
}