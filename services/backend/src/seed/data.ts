// `dateOfBirth` drives the senior scam check-in (src/lib/risk.ts). Ammi is deliberately
// the only user over 60 — the v6 demo turns on her being asked and the others not.
export const SEED_USERS = [
  { name: 'Ammi Jaan', urduName: 'امی', email: 'ammi@payo.demo', phone: '+923001110001', targetBalancePaisa: 8_450_000, dateOfBirth: '1961-03-15', language: 'en' },
  { name: 'Bilal Ahmed', urduName: 'بلال احمد', email: 'bilal@payo.demo', phone: '+923001110002', targetBalancePaisa: 6_230_000, dateOfBirth: '1993-08-02', language: 'en' },
  { name: 'Sara Khan', urduName: 'سارہ خان', email: 'sara.khan@payo.demo', phone: '+923001110003', targetBalancePaisa: 4_780_000, dateOfBirth: '1990-11-20', language: 'en' },
  { name: 'Sara Malik', urduName: 'سارہ ملک', email: 'sara.malik@payo.demo', phone: '+923001110004', targetBalancePaisa: 5_120_000, dateOfBirth: '1981-06-09', language: 'en' },
  { name: 'Hamza', urduName: 'حمزہ', email: 'hamza@payo.demo', phone: '+923001110005', targetBalancePaisa: 3_940_000, dateOfBirth: '1998-01-27', language: 'en' },
  { name: 'Ayesha', urduName: 'عائشہ', email: 'ayesha@payo.demo', phone: '+923001110006', targetBalancePaisa: 7_310_000, dateOfBirth: '2000-10-04', language: 'en' },
] as const;

// Wallets + banks per spec §2 — 5 wallets + 33 banks. `popular` = the 5 wallets plus
// HBL, Meezan, UBL, MCB, Allied.
export const SEED_INSTITUTIONS = [
  { name: 'PAYO', urduName: 'پیو', kind: 'wallet', code: 'PAYO', popular: true, domain: 'payo.app' },
  { name: 'Easypaisa', urduName: 'ایزی پیسہ', kind: 'wallet', code: 'EASYPAISA', popular: true, domain: 'easypaisa.com.pk' },
  { name: 'JazzCash', urduName: 'جاز کیش', kind: 'wallet', code: 'JAZZCASH', popular: true, domain: 'jazzcash.com.pk' },
  { name: 'SadaPay', urduName: 'سادہ پے', kind: 'wallet', code: 'SADAPAY', popular: true, domain: 'sadapay.pk' },
  { name: 'NayaPay', urduName: 'نیا پے', kind: 'wallet', code: 'NAYAPAY', popular: true, domain: 'nayapay.com' },

  { name: 'HBL', urduName: 'ایچ بی ایل', kind: 'bank', code: 'HBL', popular: true, domain: 'hbl.com' },
  { name: 'Meezan Bank', urduName: 'میزان بینک', kind: 'bank', code: 'MEEZAN', popular: true, domain: 'meezanbank.com' },
  { name: 'UBL', urduName: 'یو بی ایل', kind: 'bank', code: 'UBL', popular: true, domain: 'ubl.com.pk' },
  { name: 'MCB', urduName: 'ایم سی بی', kind: 'bank', code: 'MCB', popular: true, domain: 'mcb.com.pk' },
  { name: 'Allied Bank', urduName: 'الائیڈ بینک', kind: 'bank', code: 'ABL', popular: true, domain: 'abl.com' },

  { name: 'Bank Alfalah', urduName: 'بینک الفلاح', kind: 'bank', code: 'BAFL', popular: false, domain: 'bankalfalah.com' },
  { name: 'Askari Bank', urduName: 'عسکری بینک', kind: 'bank', code: 'AKBL', popular: false, domain: 'askaribank.com' },
  { name: 'Faysal Bank', urduName: 'فیصل بینک', kind: 'bank', code: 'FAYSAL', popular: false, domain: 'faysalbank.com' },
  { name: 'Habib Metropolitan Bank', urduName: 'حبیب میٹروپولیٹن بینک', kind: 'bank', code: 'HMB', popular: false, domain: 'habibmetro.com' },
  { name: 'JS Bank', urduName: 'جے ایس بینک', kind: 'bank', code: 'JSBL', popular: false, domain: 'jsbl.com' },
  { name: 'Soneri Bank', urduName: 'سونیری بینک', kind: 'bank', code: 'SONERI', popular: false, domain: 'soneribank.com' },
  { name: 'Standard Chartered', urduName: 'اسٹینڈرڈ چارٹرڈ', kind: 'bank', code: 'SCB', popular: false, domain: 'sc.com' },
  { name: 'Bank Al Habib', urduName: 'بینک الحبیب', kind: 'bank', code: 'BAHL', popular: false, domain: 'bankalhabib.com' },
  { name: 'Bank of Punjab', urduName: 'بینک آف پنجاب', kind: 'bank', code: 'BOP', popular: false, domain: 'bop.com.pk' },
  { name: 'National Bank of Pakistan', urduName: 'نیشنل بینک آف پاکستان', kind: 'bank', code: 'NBP', popular: false, domain: 'nbp.com.pk' },
  { name: 'Sindh Bank', urduName: 'سندھ بینک', kind: 'bank', code: 'SINDHBANK', popular: false, domain: 'sindhbank.com.pk' },
  { name: 'Al Baraka Bank', urduName: 'البرکہ بینک', kind: 'bank', code: 'ALBARAKA', popular: false, domain: 'albaraka.com.pk' },
  { name: 'Dubai Islamic Bank', urduName: 'دبئی اسلامک بینک', kind: 'bank', code: 'DIB', popular: false, domain: 'dibpak.com' },
  { name: 'BankIslami', urduName: 'بینک اسلامی', kind: 'bank', code: 'BIPL', popular: false, domain: 'bankislami.com.pk' },
  { name: 'Silk Bank', urduName: 'سلک بینک', kind: 'bank', code: 'SILK', popular: false, domain: 'silkbank.com.pk' },
  { name: 'Summit Bank', urduName: 'سمٹ بینک', kind: 'bank', code: 'SUMMIT', popular: false, domain: 'summitbank.com.pk' },
  { name: 'Zarai Taraqiati Bank', urduName: 'زرعی ترقیاتی بینک', kind: 'bank', code: 'ZTBL', popular: false, domain: 'ztbl.com.pk' },
  { name: 'First Women Bank', urduName: 'فرسٹ ویمن بینک', kind: 'bank', code: 'FWBL', popular: false, domain: 'fwbl.com.pk' },
  { name: 'U Microfinance Bank', urduName: 'یو مائیکروفنانس بینک', kind: 'bank', code: 'UMICRO', popular: false, domain: 'ubank.com.pk' },
  { name: 'Telenor Microfinance Bank', urduName: 'ٹیلی نار مائیکروفنانس بینک', kind: 'bank', code: 'TMFB', popular: false, domain: 'telenorbank.pk' },
  { name: 'Mobilink Microfinance Bank', urduName: 'موبی لنک مائیکروفنانس بینک', kind: 'bank', code: 'MMFB', popular: false, domain: 'mobilinkbank.com' },
  { name: 'ABHI Microfinance Bank', urduName: 'ابھی مائیکروفنانس بینک', kind: 'bank', code: 'ABHI', popular: false, domain: 'abhi.com.pk' },
  { name: 'Advans Microfinance Bank', urduName: 'ایڈوانس مائیکروفنانس بینک', kind: 'bank', code: 'ADVANS', popular: false, domain: 'advanspakistan.com' },
  { name: 'Al Meezan Investments', urduName: 'المیزان انویسٹمنٹس', kind: 'bank', code: 'ALMEEZAN', popular: false, domain: 'almeezangroup.com' },
  { name: 'Khushhali Microfinance Bank', urduName: 'خوشحالی مائیکروفنانس بینک', kind: 'bank', code: 'KHUSHHALI', popular: false, domain: 'khushhalibank.com.pk' },
  { name: 'FINCA Microfinance Bank', urduName: 'فنکا مائیکروفنانس بینک', kind: 'bank', code: 'FINCA', popular: false, domain: 'finca.pk' },
  { name: 'NRSP Microfinance Bank', urduName: 'این آر ایس پی مائیکروفنانس بینک', kind: 'bank', code: 'NRSP', popular: false, domain: 'nrspbank.com' },
  { name: 'Bank Makramah', urduName: 'بینک مکرمہ', kind: 'bank', code: 'MAKRAMAH', popular: false, domain: 'bankmakramah.com' },
] as const;

// 12 billers per spec §2 — electricity/gas/internet/water/mobile.
export const SEED_BILLERS = [
  { name: 'K-Electric', urduName: 'کے الیکٹرک', category: 'electricity', domain: 'ke.com.pk' },
  { name: 'LESCO', urduName: 'لیسکو', category: 'electricity', domain: 'lesco.gov.pk' },
  { name: 'SSGC', urduName: 'سوئی سدرن گیس', category: 'gas', domain: 'ssgc.com.pk' },
  { name: 'SNGPL', urduName: 'سوئی ناردرن گیس', category: 'gas', domain: 'sngpl.com.pk' },
  { name: 'PTCL', urduName: 'پی ٹی سی ایل', category: 'internet', domain: 'ptcl.com.pk' },
  { name: 'Nayatel', urduName: 'نایاٹیل', category: 'internet', domain: 'nayatel.com' },
  { name: 'KWSB', urduName: 'کے ڈبلیو ایس بی', category: 'water', domain: 'kwsb.gos.pk' },
  { name: 'WASA Lahore', urduName: 'واسا لاہور', category: 'water', domain: 'wasa.punjab.gov.pk' },
  { name: 'Jazz', urduName: 'جاز', category: 'mobile', domain: 'jazz.com.pk' },
  { name: 'Zong', urduName: 'زونگ', category: 'mobile', domain: 'zong.com.pk' },
  { name: 'Telenor', urduName: 'ٹیلی نار', category: 'mobile', domain: 'telenor.com.pk' },
  { name: 'Ufone', urduName: 'یوفون', category: 'mobile', domain: 'ufone.com' },
] as const;

export const SEED_TELCOS = [
  { name: 'Jazz', urduName: 'جاز' },
  { name: 'Zong', urduName: 'زونگ' },
  { name: 'Telenor', urduName: 'ٹیلی نار' },
  { name: 'Ufone', urduName: 'یوفون' },
] as const;

// Realistic out-spend templates the history generator draws from (category, name, urduName, min/max rupees)
export const SPEND_TEMPLATES = [
  { category: 'food', name: 'Imtiaz Super Market', urduName: 'امتیاز سپر مارکیٹ', minRs: 800, maxRs: 6500 },
  { category: 'food', name: 'Karachi Foods', urduName: 'کراچی فوڈز', minRs: 300, maxRs: 2200 },
  { category: 'food', name: 'Chaaye Khana', urduName: 'چائے خانہ', minRs: 250, maxRs: 1400 },
  { category: 'transport', name: 'Careem', urduName: 'کریم', minRs: 200, maxRs: 1200 },
  { category: 'transport', name: 'PSO Petrol', urduName: 'پی ایس او', minRs: 1000, maxRs: 5000 },
  { category: 'bills', name: 'K-Electric', urduName: 'کے الیکٹرک', minRs: 2500, maxRs: 8000 },
  { category: 'bills', name: 'PTCL', urduName: 'پی ٹی سی ایل', minRs: 1500, maxRs: 3500 },
  { category: 'recharge', name: 'Jazz', urduName: 'جاز', minRs: 100, maxRs: 1000 },
  { category: 'shopping', name: 'Chase Value', urduName: 'چیز ویلیو', minRs: 500, maxRs: 4500 },
  { category: 'health', name: 'Aga Khan Pharmacy', urduName: 'آغا خان فارمیسی', minRs: 300, maxRs: 2800 },
] as const;

export const SALARY_RS = [120_000, 95_000, 85_000, 90_000, 70_000, 110_000] as const;

export const AMMI = {
  dueBillConsumerNo: '0400012345678',
  dueBillAmountPaisa: 432_000, // Rs 4,320
  pocket: { name: 'Umrah Fund', urduName: 'عمرہ فنڈ', emoji: '🕋', goalPaisa: 50_000_000, balancePaisa: 12_000_000 },
};
