export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function defaultSubdomain(slug: string, baseDomain: string): string {
  return `${slug}.${baseDomain}`;
}
