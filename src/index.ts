async function main(): Promise<void> {
  console.log('open-api-proxy starting...');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
