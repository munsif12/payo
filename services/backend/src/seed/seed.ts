import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  User, Account, Card, Bank, Biller, Telco, Bill, Pocket, Contact, Transaction,
} from '../models';
import { config } from '../config';
import { SEED_USERS, SEED_BANKS, SEED_BILLERS, SEED_TELCOS, SPEND_TEMPLATES, SALARY_RS, AMMI } from './data';

// Deterministic PRNG so the demo world is identical on every run.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let refCounter = 0;
const nextRef = () => `PAYO-SEED${String(++refCounter).padStart(6, '0')}`;

export async function runSeed() {
  if (config.mongoUri.includes('mongodb+srv'))
    throw new Error('Refusing to seed a remote cluster — local Mongo only');

  // Drop the whole database (not just documents) so stale indexes from an old schema
  // version never survive a reseed, then rebuild EVERY registered model's indexes to
  // match the current schema (dropDatabase wipes all of them, not just User/Bill's —
  // e.g. Transaction.refNo and OtpCode.phone are unique too).
  await mongoose.connection.dropDatabase();
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
  refCounter = 0;

  const pinHash = await bcrypt.hash('1234', 10);
  const now = new Date();

  const banks = await Bank.create([...SEED_BANKS]);
  const billers = await Biller.create([...SEED_BILLERS]);
  await Telco.create([...SEED_TELCOS]);

  const users = [];
  for (const [idx, su] of SEED_USERS.entries()) {
    const user = await User.create({
      name: su.name, urduName: su.urduName, email: su.email, phone: su.phone, pinHash, pinSet: true,
      language: su.language,
    });
    const rand = mulberry32(idx + 1);
    const panRest = String(Math.floor(rand() * 1e10)).padStart(10, '0');
    await Card.create({
      userId: user._id,
      pan: `4111 11${panRest.slice(0, 2)} ${panRest.slice(2, 6)} ${panRest.slice(6, 10)}`,
      cvv: String(100 + Math.floor(rand() * 900)),
      expiry: '09/29',
      frozen: false,
    });

    // 3 calendar months of history (previous 3 months), ~21 txns/month.
    const txns: Record<string, unknown>[] = [];
    let net = 0;
    for (let m = 3; m >= 1; m--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
      const salaryRs = SALARY_RS[idx];
      if (salaryRs === undefined) throw new Error(`No SALARY_RS entry for seed user index ${idx}`);
      const salaryPaisa = salaryRs * 100;
      txns.push({
        userId: user._id, type: 'p2p', direction: 'in', amountPaisa: salaryPaisa, feePaisa: 0,
        counterparty: { name: 'Salary', urduName: 'تنخواہ', detail: 'Employer' },
        category: 'income', status: 'completed', refNo: nextRef(),
        createdAt: new Date(monthStart.getFullYear(), monthStart.getMonth(), 1, 9, 0),
      });
      net += salaryPaisa;
      const outs = 18 + Math.floor(rand() * 4); // 18–21 spends per month
      for (let i = 0; i < outs; i++) {
        const tpl = SPEND_TEMPLATES[Math.floor(rand() * SPEND_TEMPLATES.length)]!;
        const rs = tpl.minRs + Math.floor(rand() * (tpl.maxRs - tpl.minRs));
        const amountPaisa = rs * 100;
        const day = 1 + Math.floor(rand() * (daysInMonth - 1));
        const type = tpl.category === 'bills' ? 'bill' : tpl.category === 'recharge' ? 'recharge' : 'p2p';
        txns.push({
          userId: user._id, type, direction: 'out', amountPaisa, feePaisa: 0,
          counterparty: { name: tpl.name, urduName: tpl.urduName, detail: tpl.category },
          category: tpl.category, status: 'completed', refNo: nextRef(),
          createdAt: new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 10 + Math.floor(rand() * 10), Math.floor(rand() * 60)),
        });
        net -= amountPaisa;
      }
    }

    // Adjusting txn so the final balance lands exactly on target:
    // a credit at history start when short, a savings sweep out at the end when over.
    const diff = su.targetBalancePaisa - net;
    if (diff > 0) {
      txns.push({
        userId: user._id, type: 'p2p', direction: 'in', amountPaisa: diff, feePaisa: 0,
        counterparty: { name: 'Opening balance', urduName: 'ابتدائی رقم', detail: 'PAYO' },
        category: 'income', status: 'completed', refNo: nextRef(),
        createdAt: new Date(now.getFullYear(), now.getMonth() - 3, 1, 8, 0),
      });
    } else if (diff < 0) {
      txns.push({
        userId: user._id, type: 'bank_transfer', direction: 'out', amountPaisa: -diff, feePaisa: 0,
        counterparty: { name: 'Meezan Savings', urduName: 'میزان بچت اکاؤنٹ', detail: 'Meezan ****8801' },
        category: 'transfer', status: 'completed', refNo: nextRef(),
        createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 28, 17, 30),
      });
    }

    await Transaction.create(txns);
    await Account.create({ userId: user._id, balancePaisa: su.targetBalancePaisa });
    users.push(user);
  }

  const [ammi, bilal, saraKhan, saraMalik] = users as [
    (typeof users)[number], (typeof users)[number], (typeof users)[number], (typeof users)[number],
  ];
  const kElectric = billers.find(b => b.name === 'K-Electric')!;
  const meezan = banks.find(b => b.name === 'Meezan Bank')!;

  await Bill.create({
    billerId: kElectric._id, consumerNo: AMMI.dueBillConsumerNo,
    consumerName: ammi.name, amountPaisa: AMMI.dueBillAmountPaisa,
    dueDate: new Date(now.getFullYear(), now.getMonth(), 10),
    month: `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`,
    status: 'due',
    userId: ammi._id,
  });

  await Pocket.create({ userId: ammi._id, ...AMMI.pocket });

  await Contact.create([
    { userId: ammi._id, name: bilal.name, urduName: bilal.urduName, kind: 'payo', phone: bilal.phone, linkedUserId: bilal._id },
    { userId: ammi._id, name: saraKhan.name, urduName: saraKhan.urduName, kind: 'payo', phone: saraKhan.phone, linkedUserId: saraKhan._id },
    { userId: ammi._id, name: saraMalik.name, urduName: saraMalik.urduName, kind: 'payo', phone: saraMalik.phone, linkedUserId: saraMalik._id },
    { userId: ammi._id, name: 'Bhai Jan', urduName: 'بھائی جان', kind: 'bank', bankId: meezan._id, iban: AMMI.bhaiJanIban },
  ]);
}

// npm run seed — connect to local Mongo, seed, exit.
if (require.main === module) {
  (async () => {
    await mongoose.connect(config.mongoUri);
    await runSeed();
    console.log('Seeded PAYO demo world ✔');
    await mongoose.disconnect();
  })().catch((e) => { console.error(e); process.exit(1); });
}
