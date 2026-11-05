// Only company names are copied to public QR settings; never publish the master.
export function publicContractorOptions(contractors: string[]): string[] {
  const options = [...new Set(contractors.map(company => company.trim()).filter(Boolean))];
  if (options.length > 300 || options.some(company => company.length > 200)) {
    throw new Error('会社名は1件200文字以内、公開QRの会社候補は300件以内で登録してください。');
  }
  return options;
}
