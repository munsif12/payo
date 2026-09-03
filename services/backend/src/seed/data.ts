export const SEED_USERS = [
  { name: 'Ammi Jaan', urduName: 'امی', email: 'ammi@payo.demo', phone: '+923001110001', targetBalancePaisa: 8_450_000, language: 'en' },
  { name: 'Bilal Ahmed', urduName: 'بلال احمد', email: 'bilal@payo.demo', phone: '+923001110002', targetBalancePaisa: 6_230_000, language: 'en' },
  { name: 'Sara Khan', urduName: 'سارہ خان', email: 'sara.khan@payo.demo', phone: '+923001110003', targetBalancePaisa: 4_780_000, language: 'en' },
  { name: 'Sara Malik', urduName: 'سارہ ملک', email: 'sara.malik@payo.demo', phone: '+923001110004', targetBalancePaisa: 5_120_000, language: 'en' },
  { name: 'Hamza', urduName: 'حمزہ', email: 'hamza@payo.demo', phone: '+923001110005', targetBalancePaisa: 3_940_000, language: 'en' },
  { name: 'Ayesha', urduName: 'عائشہ', email: 'ayesha@payo.demo', phone: '+923001110006', targetBalancePaisa: 7_310_000, language: 'en' },
] as const;

// Wallets + banks per spec §2 — 5 wallets + 33 banks. `popular` = the 5 wallets plus
// HBL, Meezan, UBL, MCB, Allied.
export const SEED_INSTITUTIONS = [
  { name: 'PAYO', urduName: 'پیو', kind: 'wallet', code: 'PAYO', popular: true },
  { name: 'Easypaisa', urduName: 'ایزی پیسہ', kind: 'wallet', code: 'EASYPAISA', popular: true },
  { name: 'JazzCash', urduName: 'جاز کیش', kind: 'wallet', code: 'JAZZCASH', popular: true },
  { name: 'SadaPay', urduName: 'سادہ پے', kind: 'wallet', code: 'SADAPAY', popular: true },
  { name: 'NayaPay', urduName: 'نیا پے', kind: 'wallet', code: 'NAYAPAY', popular: true },

  { name: 'HBL', urduName: 'ایچ بی ایل', kind: 'bank', code: 'HBL', popular: true },
  { name: 'Meezan Bank', urduName: 'میزان بینک', kind: 'bank', code: 'MEEZAN', popular: true },
  { name: 'UBL', urduName: 'یو بی ایل', kind: 'bank', code: 'UBL', popular: true },
  { name: 'MCB', urduName: 'ایم سی بی', kind: 'bank', code: 'MCB', popular: true },
  { name: 'Allied Bank', urduName: 'الائیڈ بینک', kind: 'bank', code: 'ABL', popular: true },

  { name: 'Bank Alfalah', urduName: 'بینک الفلاح', kind: 'bank', code: 'BAFL', popular: false },
  { name: 'Askari Bank', urduName: 'عسکری بینک', kind: 'bank', code: 'AKBL', popular: false },
  { name: 'Faysal Bank', urduName: 'فیصل بینک', kind: 'bank', code: 'FAYSAL', popular: false },
  { name: 'Habib Metropolitan Bank', urduName: 'حبیب میٹروپولیٹن بینک', kind: 'bank', code: 'HMB', popular: false },
  { name: 'JS Bank', urduName: 'جے ایس بینک', kind: 'bank', code: 'JSBL', popular: false },
  { name: 'Soneri Bank', urduName: 'سونیری بینک', kind: 'bank', code: 'SONERI', popular: false },
  { name: 'Standard Chartered', urduName: 'اسٹینڈرڈ چارٹرڈ', kind: 'bank', code: 'SCB', popular: false },
  { name: 'Bank Al Habib', urduName: 'بینک الحبیب', kind: 'bank', code: 'BAHL', popular: false },
  { name: 'Bank of Punjab', urduName: 'بینک آف پنجاب', kind: 'bank', code: 'BOP', popular: false },
  { name: 'National Bank of Pakistan', urduName: 'نیشنل بینک آف پاکستان', kind: 'bank', code: 'NBP', popular: false },
  { name: 'Sindh Bank', urduName: 'سندھ بینک', kind: 'bank', code: 'SINDHBANK', popular: false },
  { name: 'Al Baraka Bank', urduName: 'البرکہ بینک', kind: 'bank', code: 'ALBARAKA', popular: false },
  { name: 'Dubai Islamic Bank', urduName: 'دبئی اسلامک بینک', kind: 'bank', code: 'DIB', popular: false },
  { name: 'BankIslami', urduName: 'بینک اسلامی', kind: 'bank', code: 'BIPL', popular: false },
  { name: 'Silk Bank', urduName: 'سلک بینک', kind: 'bank', code: 'SILK', popular: false },
  { name: 'Summit Bank', urduName: 'سمٹ بینک', kind: 'bank', code: 'SUMMIT', popular: false },
  { name: 'Zarai Taraqiati Bank', urduName: 'زرعی ترقیاتی بینک', kind: 'bank', code: 'ZTBL', popular: false },
  { name: 'First Women Bank', urduName: 'فرسٹ ویمن بینک', kind: 'bank', code: 'FWBL', popular: false },
  { name: 'U Microfinance Bank', urduName: 'یو مائیکروفنانس بینک', kind: 'bank', code: 'UMICRO', popular: false },
  { name: 'Telenor Microfinance Bank', urduName: 'ٹیلی نار مائیکروفنانس بینک', kind: 'bank', code: 'TMFB', popular: false },
  { name: 'Mobilink Microfinance Bank', urduName: 'موبی لنک مائیکروفنانس بینک', kind: 'bank', code: 'MMFB', popular: false },
  { name: 'ABHI Microfinance Bank', urduName: 'ابھی مائیکروفنانس بینک', kind: 'bank', code: 'ABHI', popular: false },
  { name: 'Advans Microfinance Bank', urduName: 'ایڈوانس مائیکروفنانس بینک', kind: 'bank', code: 'ADVANS', popular: false },
  { name: 'Al Meezan Investments', urduName: 'المیزان انویسٹمنٹس', kind: 'bank', code: 'ALMEEZAN', popular: false },
  { name: 'Khushhali Microfinance Bank', urduName: 'خوشحالی مائیکروفنانس بینک', kind: 'bank', code: 'KHUSHHALI', popular: false },
  { name: 'FINCA Microfinance Bank', urduName: 'فنکا مائیکروفنانس بینک', kind: 'bank', code: 'FINCA', popular: false },
  { name: 'NRSP Microfinance Bank', urduName: 'این آر ایس پی مائیکروفنانس بینک', kind: 'bank', code: 'NRSP', popular: false },
  { name: 'Bank Makramah', urduName: 'بینک مکرمہ', kind: 'bank', code: 'MAKRAMAH', popular: false },
] as const;

// 12 billers per spec §2 — electricity/gas/internet/water/mobile.
export const SEED_BILLERS = [
  { name: 'K-Electric', urduName: 'کے الیکٹرک', category: 'electricity' },
  { name: 'LESCO', urduName: 'لیسکو', category: 'electricity' },
  { name: 'SSGC', urduName: 'سوئی سدرن گیس', category: 'gas' },
  { name: 'SNGPL', urduName: 'سوئی ناردرن گیس', category: 'gas' },
  { name: 'PTCL', urduName: 'پی ٹی سی ایل', category: 'internet' },
  { name: 'Nayatel', urduName: 'نایاٹیل', category: 'internet' },
  { name: 'KWSB', urduName: 'کے ڈبلیو ایس بی', category: 'water' },
  { name: 'WASA Lahore', urduName: 'واسا لاہور', category: 'water' },
  { name: 'Jazz', urduName: 'جاز', category: 'mobile' },
  { name: 'Zong', urduName: 'زونگ', category: 'mobile' },
  { name: 'Telenor', urduName: 'ٹیلی نار', category: 'mobile' },
  { name: 'Ufone', urduName: 'یوفون', category: 'mobile' },
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
