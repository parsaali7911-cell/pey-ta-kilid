import { BUILDING_SPECIALTIES } from '@peytakilid/shared-types';

/** Specialty options for professionals register / find forms. */
export const PROFESSIONAL_SPECIALTY_OPTIONS = BUILDING_SPECIALTIES.map((s) => ({
  value: s.code,
  labelEn: s.nameEn,
  labelFa: s.nameFa,
}));
