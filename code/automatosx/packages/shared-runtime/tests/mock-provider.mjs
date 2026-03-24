let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  const payload = JSON.parse(input || '{}');
  const provider = payload.provider || 'unknown';
  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  const firstLine = prompt.split(/\n+/)[0] || prompt;
  process.stdout.write(JSON.stringify({
    success: true,
    provider,
    model: `mock-${provider}`,
    content: `REAL:${provider}:${firstLine}`,
    usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 },
  }));
});
