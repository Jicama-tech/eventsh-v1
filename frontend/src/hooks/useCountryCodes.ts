import { COUNTRIES, Country } from "@/data/countries";

const COUNTRY_CODES = COUNTRIES.map((c) => ({
  name: c.name,
  dial_code: c.dialCode,
}));

export function useCountryCodes(): {
  countries: Country[];
  countryCodes: { name: string; dial_code: string }[];
  loading: boolean;
} {
  return { countries: COUNTRIES, countryCodes: COUNTRY_CODES, loading: false };
}
