// Mirrors services/ai/app/cards.py (the authoritative card contract) so tsc
// catches drift between what the AI service emits and what CardView renders.
// Keep field names/optionality in lockstep with that file — do not invent
// fields here that cards.py doesn't have.

export interface Bilingual {
  en: string;
  ur: string;
}

export interface InstitutionRef {
  id: string;
  name: string;
  urduName?: string;
  kind: 'wallet' | 'bank';
}

export interface InstitutionChip {
  institutionId: string;
  name: string;
  urduName?: string;
  kind: 'wallet' | 'bank';
}

export interface InstitutionChipsCard {
  kind: 'institution_chips';
  prompt: Bilingual;
  institutions: InstitutionChip[];
}

export interface RecipientCard {
  kind: 'recipient';
  title: string;
  institution: InstitutionRef;
  identifier: string;
  linkedUserId?: string;
  prompt: Bilingual;
}

export interface RecipientChip {
  recipientId: string;
  nickname: string;
  title: string;
  institutionName: string;
  identifier: string;
}

export interface RecipientChipsCard {
  kind: 'recipient_chips';
  prompt: Bilingual;
  recipients: RecipientChip[];
}

export interface BillerChip {
  savedBillerId?: string;
  billerId: string;
  name: string;
  urduName?: string;
  consumerNo?: string;
}

export interface BillerChipsCard {
  kind: 'biller_chips';
  prompt: Bilingual;
  billers: BillerChip[];
}

export interface SavePromptCard {
  kind: 'save_prompt';
  target: 'recipient' | 'biller';
  institutionId?: string;
  identifier?: string;
  title?: string;
  billerId?: string;
  consumerNo?: string;
  consumerName?: string;
  prompt: Bilingual;
}
