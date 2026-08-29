"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Chip, Copyable, Icon } from "@/components/ui";

interface Target {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  database: string;
  free: string;
  color: string;
  url: (repo: string) => string;
  env: string[];
}

const encode = encodeURIComponent;

const TARGETS: Target[] = [
  {
    id: "vercel",
    name: "Vercel",
    icon: "▲",
    subtitle: "Fastest Next.js path",
    database: "Neon pooled Postgres",
    free: "Hobby tier",
    color: "#ffffff",
    url: (repo) =>
      `https://vercel.com/new/clone?repository-url=${encode(repo)}&project-name=sher-messenger&repository-name=sher-messenger&env=DATABASE_URL,SHER_INVITE_ONLY,OPERATOR_EMAIL&envDescription=${encode("DATABASE_URL = your pooled Postgres URL. Start SHER_INVITE_ONLY=0 for the first identity, then switch it to 1.")}`,
    env: ["DATABASE_URL", "SHER_INVITE_ONLY=0 (first boot)", "OPERATOR_EMAIL"],
  },
  {
    id: "netlify",
    name: "Netlify",
    icon: "◆",
    subtitle: "Static shell + functions",
    database: "Neon or Turso",
    free: "125k functions",
    color: "#32e6e2",
    url: (repo) => `https://app.netlify.com/start/deploy?repository=${encode(repo)}`,
    env: ["DATABASE_URL or TURSO_URL", "TURSO_TOKEN (if Turso)", "SHER_INVITE_ONLY=0 (first boot)"],
  },
  {
    id: "render",
    name: "Render",
    icon: "R",
    subtitle: "Blueprint from render.yaml",
    database: "Turso or Neon",
    free: "750 hrs · sleeps",
    color: "#8c7dff",
    url: (repo) => `https://render.com/deploy?repo=${encode(repo)}`,
    env: ["DATABASE_URL or TURSO_URL", "TURSO_TOKEN (if Turso)", "SHER_INVITE_ONLY=0 (first boot)"],
  },
  {
    id: "railway",
    name: "Railway",
    icon: "R",
    subtitle: "railway.json included",
    database: "Postgres plugin or Turso",
    free: "usage credits",
    color: "#b7a8ff",
    url: (repo) => `https://railway.app/new/template?template=${encode(repo)}`,
    env: ["DATABASE_URL", "SHER_INVITE_ONLY=0 (first boot)", "OPERATOR_EMAIL"],
  },
  {
    id: "deno",
    name: "Deno Deploy",
    icon: "D",
    subtitle: "TypeScript-native edge",
    database: "Turso over HTTP",
    free: "100k req/day-class",
    color: "#ffffff",
    url: (repo) => `https://console.deno.com/new?clone=${encode(repo)}&install=${encode("npm ci")}&build=${encode("npm run build")}`,
    env: ["TURSO_URL", "TURSO_TOKEN", "SHER_DB=turso"],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    icon: "☁",
    subtitle: "Workers + Pages edge",
    database: "Memory zero-config · Turso optional",
    free: "100k req/day",
    color: "#ffbe55",
    url: (repo) => `https://deploy.workers.cloudflare.com/?url=${encode(repo)}`,
    env: ["No env for a volatile demo", "For persistence: TURSO_URL + TURSO_TOKEN", "Then SHER_DB=turso"],
  },
];

function normalizeRepo(raw: string): string | null {
  const s = raw.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const shorthand = s.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shorthand) return `https://github.com/${shorthand[1]}/${shorthand[2]}`;
  try {
    const u = new URL(s);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return `https://github.com/${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="row items-start gap-3">
      <span className="mono grid h-7 w-7 flex-none place-items-center rounded-full border border-[rgba(79,240,182,.4)] bg-[rgba(79,240,182,.1)] text-[10px] font-bold text-[var(--acc)]">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-bold">{title}</div>
        <div className="mono mt-1 text-[10.5px] leading-relaxed text-[var(--ink-faint)]">{children}</div>
      </div>
    </div>
  );
}

export default function DeployPage() {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const repo = useMemo(() => normalizeRepo(input), [input]);

  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search).get("repo");
      const saved = localStorage.getItem("sher.deploy.repo");
      if (q || saved) setInput(q || saved || "");
    } catch {
      /* storage optional */
    }
  }, []);

  useEffect(() => {
    if (!repo) return;
    try {
      localStorage.setItem("sher.deploy.repo", repo);
    } catch {
      /* storage optional */
    }
  }, [repo]);

  const copy = async (value: string, id: string) => {
    await navigator.clipboard.writeText(value).catch(() => undefined);
    setCopied(id);
    setTimeout(() => setCopied(null), 1400);
  };

  return (
    <div className="relative z-[1] h-[100dvh] overflow-x-hidden overflow-y-auto">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[rgba(5,7,12,.8)] backdrop-blur-xl">
        <div className="mx-auto row max-w-[1180px] items-center justify-between gap-3 px-5 py-3">
          <a className="row gap-2.5" href="/">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={16} />
            </span>
            <span className="text-[13.5px] font-bold tracking-tight">
              SHER<span className="text-[var(--acc)]">·</span>MESSENGER <span className="kicker ml-1">/ deploy</span>
            </span>
          </a>
          <div className="row gap-1.5">
            <Chip tone="good">₹0-ready</Chip>
            <a className="btn btn-sm" href="/guide">
              Guide
            </a>
            <a className="btn btn-primary btn-sm" href="/">
              Open app
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 py-12 md:py-16">
        <section className="relative overflow-hidden rounded-[24px] border border-[var(--line)] bg-gradient-to-br from-[rgba(79,240,182,.08)] via-transparent to-[rgba(106,166,255,.08)] p-6 md:p-10">
          <span className="glowline" />
          <div aria-hidden className="orb orb-b !-right-[250px] !-top-[200px] !opacity-30" />
          <div className="relative z-10 grid gap-6 md:grid-cols-[1.1fr_.9fr] md:items-center">
            <div>
              <div className="kicker">fork once · deploy anywhere</div>
              <h1 className="mt-2 max-w-[18ch] text-[clamp(28px,5vw,46px)] font-bold leading-[1.03] tracking-[-0.03em]">
                One repository. Five one-click targets.
              </h1>
              <p className="mt-4 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--ink-dim)]">
                Paste your GitHub fork below. Every deploy button becomes a real provider URL for <i>your</i> repository—no placeholders,
                no platform lock-in, no paid dependency. Config files already live in the repo.
              </p>
            </div>
            <div className="panel p-4">
              <label className="kicker" htmlFor="repo">
                GitHub repository
              </label>
              <input
                id="repo"
                className="input mono mt-2"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="yourname/sher-messenger or full URL"
                autoCapitalize="none"
                spellCheck={false}
              />
              <div className="mono mt-2 min-h-[32px] text-[10.5px] leading-relaxed">
                {repo ? (
                  <span className="text-[#a9ffe2]">
                    ✓ ready · {repo}
                  </span>
                ) : input ? (
                  <span className="text-[#ffc2c9]">Use a github.com/owner/repo URL or owner/repo</span>
                ) : (
                  <span className="text-[var(--ink-faint)]">Fork/import the repository first, then paste its URL here.</span>
                )}
              </div>
              <a className="btn btn-sm mt-2 w-full justify-center" href="https://github.com/new/import" target="_blank" rel="noreferrer">
                <Icon name="globe" size={13} /> Import repository on GitHub
              </a>
            </div>
          </div>
        </section>

        <section>
          <div className="text-center">
            <div className="kicker">choose a host</div>
            <h2 className="mt-2 text-[clamp(22px,3.6vw,32px)] font-bold tracking-[-0.02em]">All adapters stay hot-swappable.</h2>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {TARGETS.map((target, i) => {
              const href = repo ? target.url(repo) : "#repo";
              return (
                <article
                  key={target.id}
                  className="group panel sheet relative overflow-hidden p-5 transition hover:-translate-y-1 hover:border-[rgba(79,240,182,.38)]"
                  style={{ animationDelay: `${i * 65}ms`, animationFillMode: "backwards" }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-3xl transition group-hover:opacity-20"
                    style={{ background: target.color }}
                  />
                  <div className="row justify-between gap-3">
                    <span
                      className="mono grid h-11 w-11 place-items-center rounded-xl border border-[var(--line-strong)] text-[17px] font-bold"
                      style={{ color: target.color, background: `${target.color}13` }}
                    >
                      {target.icon}
                    </span>
                    <Chip tone="good">{target.free}</Chip>
                  </div>
                  <h3 className="mt-4 text-[16px] font-bold">{target.name}</h3>
                  <p className="mono mt-1 text-[10.5px] text-[var(--ink-faint)]">{target.subtitle}</p>
                  <div className="divider my-4" />
                  <div className="grid gap-2">
                    <div className="row justify-between gap-3">
                      <span className="kicker">database</span>
                      <span className="mono text-right text-[10.5px] text-[var(--ink-dim)]">{target.database}</span>
                    </div>
                    <div>
                      <span className="kicker">required env</span>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {target.env.map((e) => (
                          <span key={e} className="chip !py-0.5 text-[9px]">
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                    <a
                      className={`btn ${repo ? "btn-primary" : ""} justify-center`}
                      href={href}
                      target={repo ? "_blank" : undefined}
                      rel={repo ? "noreferrer" : undefined}
                      aria-disabled={!repo}
                      onClick={(e) => {
                        if (!repo) {
                          e.preventDefault();
                          document.getElementById("repo")?.focus();
                        }
                      }}
                    >
                      <Icon name="bolt" size={13} /> {repo ? `Deploy on ${target.name}` : "Add repo first"}
                    </a>
                    <button
                      className="btn btn-icon"
                      title="Copy deploy URL"
                      disabled={!repo}
                      onClick={() => repo && void copy(target.url(repo), target.id)}
                    >
                      <Icon name={copied === target.id ? "check" : "copy"} size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-[.9fr_1.1fr]">
          <div className="panel p-5">
            <div className="kicker mb-4">first-boot checklist</div>
            <div className="grid gap-4">
              <Step n="1" title="Deploy with the signup gate temporarily open">
                Set <b>SHER_INVITE_ONLY=0</b>. Create your first identity. Save the passphrase offline.
              </Step>
              <Step n="2" title="Mint an admin invite">
                Use the first-boot bootstrap route on an empty relay, or open /admin and create a role=admin invite.
              </Step>
              <Step n="3" title="Close the gate forever">
                Set <b>SHER_INVITE_ONLY=1</b>, redeploy, then share only expiring invite links.
              </Step>
              <Step n="4" title="Verify production">
                Open /api/ked/readyz, /api/ked/version, and run the conformance URL below.
              </Step>
            </div>
          </div>
          <div className="grid content-start gap-3">
            <div>
              <div className="kicker">post-deploy verification</div>
              <h2 className="mt-1 text-[22px] font-bold tracking-tight">Three commands. No guesswork.</h2>
            </div>
            <Copyable value="curl -fsS https://YOUR-HOST/api/ked/readyz" label="1 · readiness probe" />
            <Copyable value="curl -fsS https://YOUR-HOST/api/ked/version" label="2 · version + adapter matrix" />
            <Copyable
              value='curl -fsS "https://YOUR-HOST/api/dev-selftest?relay=1&invite=YOUR-CI-INVITE" | jq ".allOk"'
              label="3 · full crypto + relay conformance"
            />
            <div className="rounded-xl border border-[rgba(255,190,85,.3)] bg-[rgba(255,190,85,.07)] p-3">
              <p className="mono text-[10.5px] leading-relaxed text-[#ffdca6]">
                Do not leave <b>SHER_INVITE_ONLY=0</b> in production. It exists only to bootstrap the first operator identity. Once an
                admin invite exists, turn it back on and keep it on.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] px-5 py-7">
        <div className="mx-auto row max-w-[1180px] flex-wrap justify-between gap-3">
          <span className="mono text-[10.5px] text-[var(--ink-faint)]">MIT licensed · one codebase · no telemetry · no lock-in</span>
          <div className="row gap-1.5">
            <a className="btn btn-sm" href="/guide">
              Full guide
            </a>
            <a className="btn btn-sm" href="/">
              Showcase
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
