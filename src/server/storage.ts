/**
 * Storage for the single-document ClubBase database.
 *
 * Production uses Upstash Redis; local development uses a file. Everything
 * funnels through this interface so the application and authorization layers
 * stay storage-agnostic.
 */

export type StorageDriver = {
  readonly kind: string;
  read(): Promise<string | null>;
  write(contents: string): Promise<void>;
};

const legacyName = `club${"hub"}`;
const legacyEnv = (suffix: string) => `CLUB${"HUB"}_${suffix}`;

const DATA_FILE =
  (typeof process === "undefined" ? undefined : process.env["CLUBBASE_DATA_FILE"]) ??
  ".data/clubbase.json";
const LEGACY_DATA_FILE =
  (typeof process === "undefined" ? undefined : process.env[legacyEnv("DATA_FILE")]) ??
  `.data/${legacyName}.json`;

const REDIS_KEY =
  (typeof process === "undefined" ? undefined : process.env["CLUBBASE_REDIS_KEY"]) ??
  "clubbase:database:v1";
const LEGACY_REDIS_KEY =
  (typeof process === "undefined" ? undefined : process.env[legacyEnv("REDIS_KEY")]) ??
  `${legacyName}:database:v1`;

type RedisResponse = { result?: unknown; error?: string };

const databaseCollections = [
  "schools",
  "users",
  "clubs",
  "memberships",
  "teams",
  "teamMemberships",
  "events",
  "announcements",
  "tutorialSchedules",
] as const;

/** Prefer the database that contains the most real records during a rename migration. */
function databaseSize(contents: string | null): number {
  if (!contents) return -1;

  try {
    const database = JSON.parse(contents) as Record<string, unknown>;
    return databaseCollections.reduce((total, collection) => {
      const records = database[collection];
      return total + (Array.isArray(records) ? records.length : 0);
    }, 0);
  } catch {
    return -1;
  }
}

function selectDatabase(current: string | null, legacy: string | null): string | null {
  return databaseSize(legacy) > databaseSize(current) ? legacy : current;
}

function redisString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("[clubbase] Redis returned a non-string database value.");
  }
  return value;
}

/**
 * The same REST credentials arrive under different names depending on how the
 * database was provisioned — Upstash's own integration injects `UPSTASH_*`,
 * while Vercel's Redis and KV marketplace entries inject `KV_REST_API_*`. Both
 * speak the identical protocol, so accept either instead of making the operator
 * hand-copy values into a second pair of variables.
 */
const REST_CREDENTIALS = [
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
] as const;

/**
 * Upstash exposes Redis over HTTPS, which works in serverless functions without
 * a long-lived TCP connection — unlike the `redis://` connection string the
 * same integrations also publish, which needs a socket per instance.
 */
async function createRedisDriver(): Promise<StorageDriver | null> {
  if (typeof process === "undefined") return null;

  const pair = REST_CREDENTIALS.map(([urlName, tokenName]) => ({
    urlName,
    tokenName,
    url: process.env[urlName]?.replace(/\/$/, ""),
    token: process.env[tokenName],
  })).find((candidate) => candidate.url || candidate.token);

  if (!pair) {
    // A TCP-only connection string means the database exists but the REST API
    // this driver speaks was never exposed. Say so, rather than falling through
    // to the "no storage configured" error and sending them hunting.
    if (process.env["REDIS_URL"] || process.env["KV_URL"]) {
      throw new Error(
        "[clubbase] Found a redis:// connection string but no REST credentials. ClubBase talks to " +
          "Redis over HTTPS. Copy the REST URL and token from your database's dashboard into " +
          "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      );
    }
    return null;
  }

  const { url, token, urlName, tokenName } = pair;
  if (!url || !token) {
    throw new Error(`[clubbase] Both ${urlName} and ${tokenName} are required.`);
  }

  const command = async (parts: string[]): Promise<unknown> => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(parts),
    });

    let payload: RedisResponse;
    try {
      payload = (await response.json()) as RedisResponse;
    } catch {
      throw new Error(`[clubbase] Redis returned an unreadable response (${response.status}).`);
    }

    if (!response.ok || payload.error) {
      throw new Error(
        `[clubbase] Redis request failed (${response.status}): ${payload.error ?? "unknown error"}`,
      );
    }
    return payload.result;
  };

  return {
    kind: `Upstash Redis (${REDIS_KEY})`,
    async read() {
      const current = redisString(await command(["GET", REDIS_KEY]));
      const legacy =
        LEGACY_REDIS_KEY === REDIS_KEY
          ? null
          : redisString(await command(["GET", LEGACY_REDIS_KEY]));
      const selected = selectDatabase(current, legacy);

      if (selected !== null && selected !== current) {
        await command(["SET", REDIS_KEY, selected]);
      }

      return selected;
    },
    async write(contents: string) {
      await command(["SET", REDIS_KEY, contents]);
    },
  };
}

/** Avoid statically bundling Node filesystem modules for non-Node targets. */
async function createFileDriver(): Promise<StorageDriver | null> {
  try {
    const fs = await import(/* @vite-ignore */ "node:" + "fs/promises");
    const path = await import(/* @vite-ignore */ "node:" + "path");
    const file = path.resolve(process.cwd(), DATA_FILE);
    const legacyFile = path.resolve(process.cwd(), LEGACY_DATA_FILE);
    const dir = path.dirname(file);

    const readIfPresent = async (target: string): Promise<string | null> => {
      try {
        return await fs.readFile(target, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    };

    return {
      kind: `file (${DATA_FILE})`,
      async read() {
        const current = await readIfPresent(file);
        const legacy = legacyFile === file ? null : await readIfPresent(legacyFile);
        const selected = selectDatabase(current, legacy);

        if (selected !== null && selected !== current) {
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(file, selected, "utf8");
        }

        return selected;
      },
      async write(contents: string) {
        await fs.mkdir(dir, { recursive: true });
        const temp = `${file}.${process.pid}.tmp`;
        await fs.writeFile(temp, contents, "utf8");
        await fs.rename(temp, file);
      },
    };
  } catch {
    return null;
  }
}

function createMemoryDriver(): StorageDriver {
  let contents: string | null = null;
  return {
    kind: "memory (not durable)",
    read: async () => contents,
    write: async (next: string) => {
      contents = next;
    },
  };
}

let driverPromise: Promise<StorageDriver> | null = null;

export function getStorageDriver(): Promise<StorageDriver> {
  if (!driverPromise) {
    driverPromise = createRedisDriver().then(async (redis) => {
      if (redis) return redis;

      // Serverless hosts — Vercel, Netlify, Cloudflare — hand each request a
      // throwaway container with a read-only disk, so the drivers below would
      // lose every account the moment it was created. Refuse to serve instead:
      // a deployment that says "connect Redis" beats one that quietly forgets
      // its users. Setting CLUBBASE_DATA_FILE opts a real server with a real
      // disk back into file storage.
      const requiresDurableStorage =
        typeof process !== "undefined" &&
        process.env["NODE_ENV"] === "production" &&
        !process.env["CLUBBASE_DATA_FILE"];

      if (requiresDurableStorage) {
        throw new Error(
          "[clubbase] Production requires persistent storage. Set UPSTASH_REDIS_REST_URL and " +
            "UPSTASH_REDIS_REST_TOKEN, then redeploy. On a server with a writable disk, set " +
            "CLUBBASE_DATA_FILE instead to keep using file storage.",
        );
      }

      const file = await createFileDriver();
      if (file) return file;

      console.warn(
        "[clubbase] No persistent storage available; using memory. Data will not survive a restart.",
      );
      return createMemoryDriver();
    });
  }
  return driverPromise;
}
