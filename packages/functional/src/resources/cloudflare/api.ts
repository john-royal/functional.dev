import Cloudflare from "cloudflare";

export const cf = new Cloudflare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
});

export const requireCloudflareAccountId = async () => {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    return process.env.CLOUDFLARE_ACCOUNT_ID;
  }
  const accounts = await cf.accounts.list();
  if (!accounts.result || !accounts.result[0]) {
    throw new Error("No accounts found");
  }
  return accounts.result[0].id;
};
