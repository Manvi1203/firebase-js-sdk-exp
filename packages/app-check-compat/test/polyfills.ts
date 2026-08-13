const g = globalThis as Record<string, unknown>;
if (typeof g.global === 'undefined') {
  g.global = globalThis;
}
if (typeof g.process === 'undefined') {
  g.process = { env: { NODE_ENV: 'test' } };
}
if (typeof g.before === 'undefined') {
  g.before = g.beforeAll;
}
if (typeof g.after === 'undefined') {
  g.after = g.afterAll;
}
if (typeof g.context === 'undefined') {
  g.context = g.describe;
}

