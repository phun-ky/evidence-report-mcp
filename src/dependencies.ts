/** One entry of a lockfile or an SBOM, as a query for OSV.dev's batch API. */
export interface Dependency {
  /** How findings name it: `name@version`, or the purl. */
  label: string;
  query:
    | { package: { name: string; ecosystem: 'npm' }; version: string }
    | { package: { purl: string } };
}

/** An entry OSV.dev can't look up, and why. */
export interface Unresolved {
  label: string;
  why: string;
}

export interface Dependencies {
  resolved: Dependency[];
  unresolved: Unresolved[];
}

interface LockEntry {
  name?: string;
  version?: string;
  resolved?: string;
  link?: boolean;
  /** On the root entry: the package.json `workspaces` patterns. */
  workspaces?: unknown;
}

interface Component {
  name?: string;
  version?: string;
  purl?: string;
  components?: Component[];
}

const NM = 'node_modules/';

/**
 * An npm workspace pattern ("packages/*", "apps/**") as a RegExp over folder paths.
 * shortcut: no negation (!) or braces, so such a workspace stays unresolved; add them if lockfiles need them.
 */
function workspacePattern(glob: string): RegExp {
  const path = glob.replace(/^\.\//, '').replace(/\/$/, '');
  const escape = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const source = path
    .split('**')
    .map((part) => part.split('*').map(escape).join('[^/]*'))
    .join('.*');

  return new RegExp(`^${source}$`);
}

/** npm package-lock.json, lockfile versions 2 and 3 (the `packages` map). */
function fromPackageLock(lock: {
  lockfileVersion?: unknown;
  packages?: unknown;
}): Dependencies {
  if (typeof lock.packages !== 'object' || lock.packages === null)
    throw new Error(
      `package-lock.json (lockfileVersion ${String(lock.lockfileVersion)}) has no "packages"; regenerate it with npm 7 or later`
    );

  const packages = lock.packages as Record<string, LockEntry>;
  const patterns = packages['']?.workspaces;
  const workspaces = Array.isArray(patterns)
    ? patterns.filter((w) => typeof w === 'string').map(workspacePattern)
    : [];
  const resolved = new Map<string, Dependency>();
  const unresolved: Unresolved[] = [];

  for (const [key, e] of Object.entries(packages)) {
    const at = key.lastIndexOf(NM);

    // The root project and workspace sources are the project itself, not a dependency.
    if (at === -1) continue;

    const name = e.name ?? key.slice(at + NM.length);

    // So is a link to a workspace folder (#73).
    if (e.link && workspaces.some((w) => w.test(String(e.resolved)))) continue;

    if (e.link) unresolved.push({ label: name, why: `link to ${e.resolved}` });
    else if (!e.version) unresolved.push({ label: name, why: 'no version' });
    else if (e.resolved && !/^https?:\/\//.test(e.resolved))
      unresolved.push({
        label: `${name}@${e.version}`,
        why: `not from a registry: ${e.resolved}`
      });
    else {
      const label = `${name}@${e.version}`;

      resolved.set(label, {
        label,
        query: { package: { name, ecosystem: 'npm' }, version: e.version }
      });
    }
  }

  return { resolved: [...resolved.values()], unresolved };
}

/** CycloneDX JSON: every component, nested ones included, by its purl. */
function fromCycloneDx(bom: { components?: unknown }): Dependencies {
  const resolved = new Map<string, Dependency>();
  const unresolved: Unresolved[] = [];
  const all: Component[] = Array.isArray(bom.components)
    ? [...(bom.components as Component[])]
    : [];

  // A loop over a growing list, not recursion: deep nesting can't overflow the stack.
  for (let i = 0; i < all.length; i++) {
    const c = all[i]!;

    if (Array.isArray(c.components)) all.push(...c.components);

    const label =
      c.purl ?? `${c.name ?? '(unnamed)'}${c.version ? `@${c.version}` : ''}`;

    if (typeof c.purl !== 'string') unresolved.push({ label, why: 'no purl' });
    // A purl's version follows the only literal "@" (an npm scope is %40)
    else if (!c.purl.split(/[?#]/)[0]!.includes('@'))
      unresolved.push({ label, why: 'no version in the purl' });
    else resolved.set(label, { label, query: { package: { purl: c.purl } } });
  }

  return { resolved: [...resolved.values()], unresolved };
}

/**
 * Reads a package-lock.json or a CycloneDX JSON file into the entries OSV.dev
 * can look up and those it can't. Throws on anything else.
 */
export function readDependencies(text: string): Dependencies {
  const doc = JSON.parse(text) as Record<string, unknown> | null;

  if (typeof doc === 'object' && doc !== null) {
    if (doc.bomFormat === 'CycloneDX') return fromCycloneDx(doc);

    if ('lockfileVersion' in doc) return fromPackageLock(doc);
  }

  throw new Error('Not a package-lock.json or a CycloneDX JSON file');
}
