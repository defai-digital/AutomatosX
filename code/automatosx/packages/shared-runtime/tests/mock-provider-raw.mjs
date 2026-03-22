let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  const firstLine = input.trim().split(/\n+/)[0] || '';
  process.stdout.write(`RAW:${firstLine}`);
});
