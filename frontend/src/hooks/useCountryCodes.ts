import { useState, useEffect } from "react";

export function useCountryCodes() {
  const [countryCodes, setCountryCodes] = useState<
    { name: string; dial_code: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("https://restcountries.com/v3.1/all?fields=name,cca2,idd")
      .then((res) => res.json())
      .then((data) => {
        // Prepare a sorted, unique list by name
        const codes = data
          .map((country: any) => ({
            name: country.name.common,
            dial_code: country.idd?.root
              ? country.idd.root +
                (country.idd.suffixes ? country.idd.suffixes[0] : "")
              : "",
          }))
          .filter((c) => c.dial_code)
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountryCodes(codes);
      })
      .finally(() => setLoading(false));
  }, []);

  return { countryCodes, loading };
}
