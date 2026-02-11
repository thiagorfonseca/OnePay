import type { ARCHETYPE_PROFILES } from './archetypeQuestions';

export type ArchetypeProfile = (typeof ARCHETYPE_PROFILES)[number];
export type AudienceType = 'INTERNAL' | 'EXTERNAL';

export type ArchetypeAnswer = {
  questionId: number;
  selectedIndex: number;
  selectedWord: string;
  scoredProfile: ArchetypeProfile;
};

export type ArchetypeScores = Record<ArchetypeProfile, number>;
export type ArchetypePercentages = Record<ArchetypeProfile, number>;

export type ArchetypeResult = {
  scores: ArchetypeScores;
  percentages: ArchetypePercentages;
  topProfile: ArchetypeProfile | 'EMPATE';
  topProfiles: ArchetypeProfile[];
};

export type PublicTokenResolution = {
  clinic_id: string;
  audience_type: AudienceType;
  is_active: boolean;
};

export type ArchetypeRespondentRow = {
  id: string;
  created_at: string;
  clinic_id: string;
  public_token: string;
  audience_type: AudienceType;
  name: string;
  email: string | null;
  phone: string | null;
  profession: string | null;
  city: string | null;
  consent_lgpd: boolean;
  scores: ArchetypeScores;
  top_profile: string;
  top_profiles: string[] | null;
};

export type ArchetypeAnswerRow = {
  id: string;
  created_at: string;
  clinic_id: string;
  respondent_id: string;
  question_id: number;
  selected_word: string;
  scored_profile: ArchetypeProfile;
};

export type PublicLinkRow = {
  id: string;
  created_at: string;
  clinic_id: string;
  token: string;
  audience_type: AudienceType;
  is_active: boolean;
  created_by_user_id: string | null;
  collaborator_id?: string | null;
};
