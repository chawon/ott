/**
 * IndexNow ping script
 * Run after production deploy: node scripts/ping-indexnow.mjs
 */

const KEY = "6c1e0b0dc9235bd183249074aea603a6";
const HOST = "ottline.app";
const BASE_URL = `https://${HOST}`;

const URLS = [
  `${BASE_URL}/`,
  `${BASE_URL}/about`,
  `${BASE_URL}/faq`,
  `${BASE_URL}/public`,
  `${BASE_URL}/privacy`,
];

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: `${BASE_URL}/${KEY}.txt`,
  urlList: URLS,
};

const res = await fetch("https://api.indexnow.org/IndexNow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

console.log(`IndexNow: ${res.status} ${res.statusText}`);
if (res.status === 200) {
  console.log("Success — Bing/Copilot will recrawl submitted URLs shortly.");
} else {
  const text = await res.text();
  console.error("Response:", text);
  process.exit(1);
}
