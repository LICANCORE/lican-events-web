import fs from "node:fs";

const file = new URL("../public/headbangdealers_the_game/assets/index-DlqHMLJa.js", import.meta.url);
let source = fs.readFileSync(file, "utf8");
const replacements = [
  ["dt=[1800,3800,5800,7800]", "dt=[0,0,0,0]"],
  ["let f=0,p=0,m=!1,h=window.setTimeout", "let f=0,p=0,w=0,m=!1,h=window.setTimeout"],
  ["let r=70+(e-1)*5.5;n.style.setProperty(`--landing-x`,`${r}%`),n.style.setProperty(`--apex-x`,`${61+(e-1)*4.2}%`)", "let r=62+Math.random()*32;n.style.setProperty(`--landing-x`,`${r}%`),n.style.setProperty(`--apex-x`,`${48+Math.random()*30}%`)"],
  ["if(p=e,s.textContent=", "if(p=e,w=performance.now(),s.textContent="],
  ["r<=4&&f>=r&&n>=dt[r-1]&&y(r),p===4&&f===4&&n>=st&&b()", "r<=4&&f>=r&&t-w>=560&&y(r),p===4&&f===4&&t-w>=560&&b()"],
];

for (const [before, after] of replacements) {
  const count = source.split(before).length - 1;
  if (count === 0 && source.includes(after)) continue;
  if (count !== 1) throw new Error(`Expected one loader match, found ${count}: ${before}`);
  source = source.replace(before, after);
}
fs.writeFileSync(file, source);
console.log("Loader runtime patched.");
