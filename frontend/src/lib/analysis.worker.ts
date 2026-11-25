import type { AnalysisReply, AnalysisRequest } from './localAnalysis';
import { version } from 'pyodide/package.json';

const assets = new URL(`${import.meta.env.BASE_URL}analysis/`, self.location.origin);
const runtime = new URL(`pyodide-${version}/`, assets);
const engineFiles = import.meta.glob<string>('../../analysis/*.{py,txt}', {
  eager: true, query: '?raw', import: 'default',
});

async function loadEngine() {
  const loader = new URL('pyodide.mjs', runtime).href;
  const { loadPyodide } = await import(/* @vite-ignore */ loader) as typeof import('pyodide');
  const python = await loadPyodide({ indexURL: runtime.href, packageBaseUrl: runtime.href });

  python.FS.mkdirTree('/home/pyodide/analysis');
  for (const [path, contents] of Object.entries(engineFiles)) {
    python.FS.writeFile(`/home/pyodide/analysis/${path.split('/').pop()}`, contents);
  }
  await python.loadPackage(['pandas', new URL('emoji-2.16.0-py3-none-any.whl', runtime).href]);

  return python.runPython('from analysis.browser import analyze\nanalyze') as (
    bytes: Uint8Array, filename: string, start: string, end: string,
  ) => string;
}

let engine: ReturnType<typeof loadEngine> | undefined;

function reply(message: AnalysisReply) {
  self.postMessage(message);
}

self.onmessage = async ({ data: { file, range } }: MessageEvent<AnalysisRequest>) => {
  if (!engine) reply({ phase: 'preparing' });
  engine ??= loadEngine();

  let analyze: Awaited<typeof engine>;
  try {
    analyze = await engine;
  } catch (error) {
    console.error('Could not initialize local analysis.', error);
    engine = undefined;
    reply({ error: 'Could not load the analysis engine. Check your connection and try again.', restart: true });
    return;
  }

  reply({ phase: 'analysing' });
  try {
    const bytes = file ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
    reply(JSON.parse(analyze(bytes, file?.name ?? '', range.start ?? '', range.end ?? '')));
  } catch {
    reply({
      error: 'This browser could not complete the analysis. Try a smaller export or another browser.',
      restart: true,
    });
  }
};
