import "dotenv/config";
import prisma from "../lib/prisma";
const ms = (s:number)=>`${(performance.now()-s).toFixed(0)}ms`;
async function main(){
  const u = await prisma.user.findFirst({ select:{ id:true } });
  if(!u){console.log("no user");return;}
  const N = 30;
  const t = performance.now();
  const res = await Promise.allSettled([...Array(N)].map(()=>
    prisma.user.findUnique({ where:{id:u.id}, select:{id:true} })));
  const ok = res.filter(r=>r.status==="fulfilled").length;
  const fails = res.filter(r=>r.status==="rejected") as PromiseRejectedResult[];
  console.log(`${N} concurrent queries in ${ms(t)} — ok=${ok} failed=${fails.length}`);
  const codes: Record<string,number> = {};
  for(const f of fails){ const c=(f.reason?.code)||"?"; codes[c]=(codes[c]||0)+1; }
  if(fails.length) console.log("failure codes:", codes);
}
main().catch(e=>console.error("ERR",e?.code,e?.message)).finally(()=>prisma.$disconnect().then(()=>process.exit(0)));
