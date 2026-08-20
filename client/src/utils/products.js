export const sampleProducts = [
  { internalKey: '100_coins', name: '100 Coins', description: 'Adds 100 Coins instantly.', robuxPrice: 19, rewardType: 'Coins', rewardItem: 'Coins', rewardAmount: 100, productId: '', status: 'draft', error: '' },
  { internalKey: 'starter_pack', name: 'Starter Pack', description: 'Grants a starter boost bundle.', robuxPrice: 49, rewardType: 'Bundle', rewardItem: 'Starter Pack', rewardAmount: 1, productId: '', status: 'draft', error: '' }
];

export function validateProducts(products) {
  return products.map((p) => {
    const issues = [];
    if (!p.internalKey) issues.push('Internal key is required.');
    if (!p.name) issues.push('Name is required.');
    if (!Number(p.robuxPrice) || Number(p.robuxPrice) < 1) issues.push('Robux price must be at least 1.');
    if (!p.rewardType) issues.push('Reward type is required.');
    if (!p.rewardItem) issues.push('Reward item is required.');
    return { ...p, error: issues.join(' ') };
  });
}

export function luaMapping(products) {
  const lines = ['return {'];
  products.forEach((p) => {
    lines.push(`  ["${p.internalKey}"] = {`);
    lines.push(`    productId = ${p.productId || 0},`);
    lines.push(`    rewardType = "${p.rewardType}",`);
    lines.push(`    rewardItem = "${p.rewardItem}",`);
    lines.push(`    amount = ${Number(p.rewardAmount) || 0},`);
    lines.push('  },');
    lines.push('');
  });
  lines.push('}');
  return lines.join('\n');
}
