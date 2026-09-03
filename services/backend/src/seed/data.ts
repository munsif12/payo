export const SEED_USERS = [
  { name: 'Ammi Jaan', urduName: 'امی', email: 'ammi@payo.demo', phone: '+923001110001', targetBalancePaisa: 8_450_000, language: 'en' },
  { name: 'Bilal Ahmed', urduName: 'بلال احمد', email: 'bilal@payo.demo', phone: '+923001110002', targetBalancePaisa: 6_230_000, language: 'en' },
  { name: 'Sara Khan', urduName: 'سارہ خان', email: 'sara.khan@payo.demo', phone: '+923001110003', targetBalancePaisa: 4_780_000, language: 'en' },
  { name: 'Sara Malik', urduName: 'سارہ ملک', email: 'sara.malik@payo.demo', phone: '+923001110004', targetBalancePaisa: 5_120_000, language: 'en' },
  { name: 'Hamza', urduName: 'حمزہ', email: 'hamza@payo.demo', phone: '+923001110005', targetBalancePaisa: 3_940_000, language: 'en' },
  { name: 'Ayesha', urduName: 'عائشہ', email: 'ayesha@payo.demo', phone: '+923001110006', targetBalancePaisa: 7_310_000, language: 'en' },
] as const;

export const SEED_BANKS = [
  { name: 'HBL', urduName: 'ایچ بی ایل' },
  { name: 'Meezan Bank', urduName: 'میزان بینک' },
  { name: 'UBL', urduName: 'یو بی ایل' },
  { name: 'MCB', urduName: 'ایم سی بی' },
  { name: 'Allied Bank', urduName: 'الائیڈ بینک' },
] as const;

export const SEED_BILLERS = [
  { name: 'K-Electric', urduName: 'کے الیکٹرک', category: 'electricity' },
  { name: 'SSGC', urduName: 'سوئی سدرن گیس', category: 'gas' },
  { name: 'PTCL', urduName: 'پی ٹی سی ایل', category: 'internet' },
  { name: 'Karachi Water', urduName: 'کراچی واٹر', category: 'water' },
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
  bhaiJanIban: 'PK36MEZN0000001123456702',
};
