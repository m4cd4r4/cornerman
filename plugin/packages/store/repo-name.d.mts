/** The row for windows in a folder that is in no repo. */
export const NO_REPO: string;
/** A function from a folder to its repo's name, caching what it looked up. */
export function repoNamer(): (cwd: string | undefined) => string;
